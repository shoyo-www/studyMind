import { extractJsonFromText, getGeminiClient, getGeminiModelName, runGeminiTask, shouldSkipGeminiDueToRecentQuota } from './gemini.js'
import { getAdminSupabase } from './helpers.js'

const MARKING_BATCH_SIZE = 5
const MARKING_BATCH_CONCURRENCY = 3

export const MOCK_TEST_SUBMISSION_STATUS = {
  queued: 'queued',
  processing: 'processing',
  ready: 'ready',
  failed: 'failed',
}

function createUnavailableError(message, status = 503, retryAfterSeconds = null) {
  const error = new Error(message)
  error.status = status
  if (retryAfterSeconds) {
    error.retryAfterSeconds = retryAfterSeconds
  }
  return error
}

function isAiAvailabilityError(error) {
  return error?.status === 429 || error?.status >= 500 || error?.geminiIssueType === 'busy' || error?.geminiIssueType === 'quota'
}

function getGrade(pct) {
  if (pct >= 90) return { grade: 'A+', label: 'Outstanding', color: '#16a34a' }
  if (pct >= 75) return { grade: 'A', label: 'Excellent', color: '#22c55e' }
  if (pct >= 60) return { grade: 'B', label: 'Good', color: '#3b82f6' }
  if (pct >= 45) return { grade: 'C', label: 'Average', color: '#f59e0b' }
  if (pct >= 33) return { grade: 'D', label: 'Needs Work', color: '#f97316' }
  return { grade: 'F', label: 'Fail', color: '#ef4444' }
}

function batchMarkingPrompt(items) {
  const questionsBlock = items.map(({ q, answer, num }) => `QUESTION ${num} [${q.marks} marks] — Type: ${q.type}
Question: ${q.question}
Expected length: ${q.expectedLength || 'appropriate'}
Correct answer: ${q.modelAnswer || 'Use general knowledge to evaluate'}
STUDENT'S ANSWER: "${answer || '[No answer]'}"`).join('\n\n')

  return `You are a strict but fair exam evaluator.

Evaluate each question independently and return ONLY a valid JSON array with exactly ${items.length} objects.
Keep the array in the same order as the questions below.

Each JSON object must have these exact fields:
{
  "questionNumber": <question number>,
  "marksAwarded": <0 to max marks for that question>,
  "feedback": "<2-3 sentences: what was right, what was missing, how to improve>",
  "isCorrect": <true if full marks>,
  "keyPointsCovered": ["point 1", "point 2"],
  "keyPointsMissed": ["point 1", "point 2"]
}

Marking rules:
- Blank/irrelevant answer = 0 marks
- Partial credit for partially correct answers
- Numerical: full marks only if method AND answer correct; partial for correct method
- Fill-blank: full marks for correct word only, else 0
- Do not inflate marks — be accurate

${questionsBlock}`
}

function singleMarkingPrompt(q, answer, num) {
  return `You are a strict but fair exam evaluator.

QUESTION ${num} [${q.marks} marks] — Type: ${q.type}
Question: ${q.question}
Expected length: ${q.expectedLength || 'appropriate'}
Correct answer: ${q.modelAnswer || 'Use general knowledge to evaluate'}

STUDENT'S ANSWER: "${answer || '[No answer]'}"

Return ONLY this JSON object — no prose, no markdown:
{
  "marksAwarded": <0 to ${q.marks}>,
  "feedback": "<2-3 sentences: what was right, what was missing, how to improve>",
  "isCorrect": <true if full marks>,
  "keyPointsCovered": ["point 1", "point 2"],
  "keyPointsMissed": ["point 1", "point 2"]
}

Marking rules:
- Blank/irrelevant answer = 0 marks
- Partial credit for partially correct answers
- Numerical: full marks only if method AND answer correct; partial for correct method
- Fill-blank: full marks for correct word only, else 0
- Do not inflate marks — be accurate`
}

function buildAnalysisEntry(q, answer, num, payload = {}) {
  return {
    questionNumber: num,
    questionId: q.id || num,
    section: q.section,
    topic: q.topic,
    type: q.type,
    question: q.question,
    studentAnswer: answer || '',
    marksAwarded: Math.min(Math.max(Number(payload.marksAwarded || 0), 0), q.marks),
    maxMarks: q.marks,
    feedback: payload.feedback || 'No feedback available.',
    isCorrect: Boolean(payload.isCorrect),
    keyPointsCovered: Array.isArray(payload.keyPointsCovered) ? payload.keyPointsCovered : [],
    keyPointsMissed: Array.isArray(payload.keyPointsMissed) ? payload.keyPointsMissed : [],
    modelAnswer: q.modelAnswer || '',
  }
}

function buildFailedAnalysisEntry(q, answer, num, feedback = 'Evaluation failed.') {
  return {
    questionNumber: num,
    questionId: q.id || num,
    section: q.section,
    topic: q.topic,
    type: q.type,
    question: q.question,
    studentAnswer: answer || '',
    marksAwarded: 0,
    maxMarks: q.marks,
    feedback,
    isCorrect: false,
    keyPointsCovered: [],
    keyPointsMissed: [],
    modelAnswer: q.modelAnswer || '',
  }
}

function chunkItems(items, size) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function countCompletedItems(items = []) {
  return items.filter(Boolean).length
}

function ensureItemsLength(items = [], total = 0) {
  return Array.from({ length: total }, (_, index) => items[index] || null)
}

export function createQueuedSubmissionAnalysis(questionCount = 0) {
  return {
    status: MOCK_TEST_SUBMISSION_STATUS.queued,
    progressDone: 0,
    progressTotal: questionCount,
    items: Array(questionCount).fill(null),
    errorMessage: '',
    startedAt: null,
    completedAt: null,
  }
}

export function normaliseSubmissionAnalysis(rawAnalysis, questionCount = 0) {
  if (Array.isArray(rawAnalysis)) {
    return {
      status: MOCK_TEST_SUBMISSION_STATUS.ready,
      progressDone: rawAnalysis.length,
      progressTotal: questionCount || rawAnalysis.length,
      items: ensureItemsLength(rawAnalysis, questionCount || rawAnalysis.length),
      errorMessage: '',
      startedAt: null,
      completedAt: null,
    }
  }

  if (rawAnalysis && typeof rawAnalysis === 'object') {
    const progressTotal = Math.max(0, Number(rawAnalysis.progressTotal) || questionCount || 0)
    const items = ensureItemsLength(Array.isArray(rawAnalysis.items) ? rawAnalysis.items : [], progressTotal)

    return {
      status: rawAnalysis.status || MOCK_TEST_SUBMISSION_STATUS.queued,
      progressDone: Math.max(0, Number(rawAnalysis.progressDone) || countCompletedItems(items)),
      progressTotal,
      items,
      errorMessage: `${rawAnalysis.errorMessage || ''}`.trim(),
      startedAt: rawAnalysis.startedAt || null,
      completedAt: rawAnalysis.completedAt || null,
    }
  }

  return createQueuedSubmissionAnalysis(questionCount)
}

function buildSectionBreakdown(analysis = []) {
  const sectionMap = new Map()

  analysis.forEach((entry) => {
    const current = sectionMap.get(entry.section) || {
      section: entry.section,
      marks: 0,
      maxMarks: 0,
      count: 0,
    }
    current.marks += Number(entry.marksAwarded || 0)
    current.maxMarks += Number(entry.maxMarks || 0)
    current.count += 1
    sectionMap.set(entry.section, current)
  })

  return [...sectionMap.values()].map((entry) => ({
    ...entry,
    percentage: entry.maxMarks > 0 ? Math.round((entry.marks / entry.maxMarks) * 100) : 0,
  }))
}

function buildTopicBreakdown(analysis = []) {
  const topicMap = new Map()

  analysis.forEach((entry) => {
    const current = topicMap.get(entry.topic) || {
      topic: entry.topic,
      marks: 0,
      maxMarks: 0,
    }
    current.marks += Number(entry.marksAwarded || 0)
    current.maxMarks += Number(entry.maxMarks || 0)
    topicMap.set(entry.topic, current)
  })

  return [...topicMap.values()]
    .map((entry) => ({
      ...entry,
      percentage: entry.maxMarks > 0 ? Math.round((entry.marks / entry.maxMarks) * 100) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage)
}

export function buildMockTestResult({ test, submission, analysisItems }) {
  const totalMarks = Number(submission?.total_marks || test?.total_marks || 0)
  const marksObtained = Number(submission?.marks_obtained || 0)
  const percentage = Number.isFinite(Number(submission?.percentage))
    ? Number(submission.percentage)
    : (totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 10000) / 100 : 0)
  const { grade, label: gradeLabel, color: gradeColor } = getGrade(percentage)
  const sectionBreakdown = buildSectionBreakdown(analysisItems)
  const topicBreakdown = buildTopicBreakdown(analysisItems)

  return {
    title: test.title,
    subject: test.subject,
    marksObtained,
    totalMarks,
    percentage,
    grade: submission?.grade || grade,
    gradeLabel,
    gradeColor,
    timeTakenSecs: Number(submission?.time_taken_secs || 0),
    durationMinutes: test.duration_minutes,
    questionsCount: Array.isArray(test.questions) ? test.questions.length : analysisItems.length,
    correctCount: analysisItems.filter((entry) => entry?.isCorrect).length,
    sectionBreakdown,
    topicBreakdown,
    weakTopics: topicBreakdown.filter((entry) => entry.percentage < 50),
    strongTopics: topicBreakdown.filter((entry) => entry.percentage >= 75),
    analysis: analysisItems,
  }
}

async function markQuestion(q, answer, num) {
  const ai = getGeminiClient()
  const result = await runGeminiTask(() => ai.models.generateContent({
    model: getGeminiModelName(),
    contents: [{ text: singleMarkingPrompt(q, answer, num) }],
    config: { responseMimeType: 'application/json' },
  }), {
    label: `Mark Q${num}`,
    userMessage: 'Auto-marking is a little busy right now. Please try again in about a minute.',
    quotaUserMessage: 'Auto-marking is temporarily unavailable right now. Please try again shortly.',
  })

  try {
    const parsed = JSON.parse(extractJsonFromText(result.text || '{}'))
    return buildAnalysisEntry(q, answer, num, parsed)
  } catch {
    return buildFailedAnalysisEntry(q, answer, num, 'Auto-marking unavailable for this question.')
  }
}

async function markQuestionBatch(items) {
  const ai = getGeminiClient()
  const result = await runGeminiTask(() => ai.models.generateContent({
    model: getGeminiModelName(),
    contents: [{ text: batchMarkingPrompt(items) }],
    config: { responseMimeType: 'application/json' },
  }), {
    label: `Mark batch Q${items[0]?.num || ''}-Q${items[items.length - 1]?.num || ''}`,
    userMessage: 'Auto-marking is a little busy right now. Please try again in about a minute.',
    quotaUserMessage: 'Auto-marking is temporarily unavailable right now. Please try again shortly.',
  })

  const parsed = JSON.parse(extractJsonFromText(result.text || '[]'))
  if (!Array.isArray(parsed)) {
    throw new Error('Batch marking response was not an array')
  }

  const resultMap = new Map(parsed.map((entry) => [Number(entry?.questionNumber), entry]))

  return items.map(({ q, answer, num }) => {
    const payload = resultMap.get(num)
    return payload
      ? buildAnalysisEntry(q, answer, num, payload)
      : buildFailedAnalysisEntry(q, answer, num, 'Auto-marking was incomplete for this question.')
  })
}

async function markQuestionBatchWithFallback(batch) {
  try {
    return await markQuestionBatch(batch)
  } catch (error) {
    if (isAiAvailabilityError(error)) {
      throw error
    }

    const fallbackResults = []

    for (const item of batch) {
      try {
        fallbackResults.push(await markQuestion(item.q, item.answer, item.num))
      } catch (singleError) {
        if (isAiAvailabilityError(singleError)) {
          throw singleError
        }

        fallbackResults.push(buildFailedAnalysisEntry(item.q, item.answer, item.num))
      }
    }

    return fallbackResults
  }
}

async function updateSubmissionRecord(supabase, submissionId, payload) {
  const { error } = await supabase
    .from('mock_test_submissions')
    .update(payload)
    .eq('id', submissionId)

  if (error) {
    throw error
  }
}

async function loadSubmissionContext(supabase, submissionId, userId) {
  const { data: submission, error: submissionError } = await supabase
    .from('mock_test_submissions')
    .select('id, user_id, mock_test_id, answers, analysis, total_marks, marks_obtained, percentage, grade, time_taken_secs, submitted_at, analysed_at')
    .eq('id', submissionId)
    .eq('user_id', userId)
    .single()

  if (submissionError || !submission) {
    const error = new Error('We could not find that submission. Please refresh and try again.')
    error.status = 404
    throw error
  }

  const { data: test, error: testError } = await supabase
    .from('mock_tests')
    .select('id, title, subject, total_marks, duration_minutes, questions, user_id')
    .eq('id', submission.mock_test_id)
    .eq('user_id', userId)
    .single()

  if (testError || !test) {
    const error = new Error('We could not find that mock test. Please refresh and try again.')
    error.status = 404
    throw error
  }

  return { submission, test }
}

export async function getMockTestSubmissionSnapshot({ submissionId, userId, supabase = getAdminSupabase() }) {
  const { submission, test } = await loadSubmissionContext(supabase, submissionId, userId)
  const questionCount = Array.isArray(test.questions) ? test.questions.length : 0
  const analysisState = normaliseSubmissionAnalysis(submission.analysis, questionCount)
  const response = {
    submissionId: submission.id,
    status: analysisState.status,
    progressDone: analysisState.progressDone,
    progressTotal: analysisState.progressTotal,
    errorMessage: analysisState.errorMessage || '',
    submittedAt: submission.submitted_at,
    startedAt: analysisState.startedAt,
    completedAt: analysisState.completedAt || submission.analysed_at,
  }

  if (analysisState.status === MOCK_TEST_SUBMISSION_STATUS.ready) {
    response.result = buildMockTestResult({
      test,
      submission,
      analysisItems: analysisState.items.filter(Boolean),
    })
  }

  return response
}

export async function markMockTestSubmissionInBackground({ submissionId, userId, supabase = getAdminSupabase() }) {
  let latestState = null

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw createUnavailableError('Auto-marking is not available right now. Please try again a little later.')
    }

    if (shouldSkipGeminiDueToRecentQuota()) {
      throw createUnavailableError('Auto-marking is taking a short break right now. Please try again in about a minute.', 429, 60)
    }

    const { submission, test } = await loadSubmissionContext(supabase, submissionId, userId)
    const questionCount = Array.isArray(test.questions) ? test.questions.length : 0
    const currentState = normaliseSubmissionAnalysis(submission.analysis, questionCount)

    if (currentState.status === MOCK_TEST_SUBMISSION_STATUS.ready) {
      return buildMockTestResult({
        test,
        submission,
        analysisItems: currentState.items.filter(Boolean),
      })
    }

    latestState = {
      ...currentState,
      status: MOCK_TEST_SUBMISSION_STATUS.processing,
      progressTotal: questionCount,
      items: ensureItemsLength(currentState.items, questionCount),
      progressDone: countCompletedItems(currentState.items),
      errorMessage: '',
      startedAt: currentState.startedAt || new Date().toISOString(),
      completedAt: null,
    }

    await updateSubmissionRecord(supabase, submissionId, {
      analysis: latestState,
      analysed_at: null,
    })

    const answerMap = new Map((Array.isArray(submission.answers) ? submission.answers : []).map((entry) => [
      Number(entry?.questionIndex),
      `${entry?.answer || ''}`.trim(),
    ]))
    const itemsToProcess = (Array.isArray(test.questions) ? test.questions : [])
      .map((question, index) => ({
        q: question,
        answer: answerMap.get(index) || '',
        num: index + 1,
        index,
      }))
      .filter((item) => !latestState.items[item.index])
    const batches = chunkItems(itemsToProcess, MARKING_BATCH_SIZE)
    const markingStartedAt = Date.now()

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += MARKING_BATCH_CONCURRENCY) {
      const roundBatches = batches.slice(batchIndex, batchIndex + MARKING_BATCH_CONCURRENCY)
      const settled = await Promise.allSettled(roundBatches.map((batch) => markQuestionBatchWithFallback(batch)))

      for (let resultIndex = 0; resultIndex < settled.length; resultIndex += 1) {
        const settledResult = settled[resultIndex]

        if (settledResult.status === 'rejected') {
          const failure = settledResult.reason
          if (isAiAvailabilityError(failure)) {
            throw createUnavailableError(
              failure?.status === 429
                ? 'Auto-marking is taking a short break right now. Please try again in about a minute.'
                : 'Auto-marking is not available right now. Please try again a little later.',
              failure?.status === 429 ? 429 : 503,
              failure?.retryAfterSeconds || null,
            )
          }

          throw failure
        }

        const batch = roundBatches[resultIndex]
        const entries = settledResult.value

        entries.forEach((entry, entryIndex) => {
          latestState.items[batch[entryIndex].index] = entry
        })
        latestState.progressDone = countCompletedItems(latestState.items)

        await updateSubmissionRecord(supabase, submissionId, {
          analysis: latestState,
        })
      }
    }

    const analysisItems = latestState.items.filter(Boolean)
    const totalMarks = Number(test.total_marks || 0)
    const marksObtained = analysisItems.reduce((sum, entry) => sum + Number(entry.marksAwarded || 0), 0)
    const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 10000) / 100 : 0
    const { grade } = getGrade(percentage)
    const completedAt = new Date().toISOString()

    latestState = {
      ...latestState,
      status: MOCK_TEST_SUBMISSION_STATUS.ready,
      progressDone: questionCount,
      progressTotal: questionCount,
      errorMessage: '',
      completedAt,
    }

    await updateSubmissionRecord(supabase, submissionId, {
      analysis: latestState,
      total_marks: totalMarks,
      marks_obtained: marksObtained,
      percentage,
      grade,
      analysed_at: completedAt,
    })

    console.log(
      `[MockTest/submit] Marked ${questionCount} question(s) in ${Date.now() - markingStartedAt}ms using ${batches.length} batch request(s).`,
    )

    return buildMockTestResult({
      test,
      submission: {
        ...submission,
        total_marks: totalMarks,
        marks_obtained: marksObtained,
        percentage,
        grade,
        analysed_at: completedAt,
      },
      analysisItems,
    })
  } catch (error) {
    if (submissionId && userId) {
      try {
        const failedState = {
          ...(latestState || createQueuedSubmissionAnalysis(0)),
          status: MOCK_TEST_SUBMISSION_STATUS.failed,
          errorMessage: error.message || 'Auto-marking failed. Please try again.',
          completedAt: new Date().toISOString(),
        }

        await updateSubmissionRecord(getAdminSupabase(), submissionId, {
          analysis: failedState,
          analysed_at: failedState.completedAt,
        })
      } catch (updateError) {
        console.error('[MockTest/submit] Failed to persist submission failure state', updateError)
      }
    }

    throw error
  }
}
