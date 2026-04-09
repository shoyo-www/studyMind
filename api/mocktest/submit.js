// api/mocktest/submit.js
// Receives student's written answers → AI marks each one → returns full result

import {
  fail, getAdminSupabase, ok, requireAuth, setCors,
  checkRateLimit, getClientIp,
} from '../_helpers.js'
import { getGeminiClient, getGeminiModelName, runGeminiTask, shouldSkipGeminiDueToRecentQuota } from '../_gemini.js'

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
  if (pct >= 90) return { grade: 'A+', label: 'Outstanding',  color: '#16a34a' }
  if (pct >= 75) return { grade: 'A',  label: 'Excellent',    color: '#22c55e' }
  if (pct >= 60) return { grade: 'B',  label: 'Good',         color: '#3b82f6' }
  if (pct >= 45) return { grade: 'C',  label: 'Average',      color: '#f59e0b' }
  if (pct >= 33) return { grade: 'D',  label: 'Needs Work',   color: '#f97316' }
  return               { grade: 'F',  label: 'Fail',          color: '#ef4444' }
}

function markingPrompt(q, answer, num) {
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

async function markQuestion(q, answer, num) {
  const prompt = markingPrompt(q, answer, num)
  const ai = getGeminiClient()
  const result = await runGeminiTask(() => ai.models.generateContent({
    model:    getGeminiModelName(),
    contents: [{ text: prompt }],
    config:   { responseMimeType: 'application/json' },
  }), {
    label: `Mark Q${num}`,
    userMessage: 'Auto-marking is a little busy right now. Please try again in about a minute.',
    quotaUserMessage: 'Auto-marking is temporarily unavailable right now. Please try again shortly.',
  })
  const raw = result.text || ''

  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    const p = JSON.parse(cleaned)
    return {
      questionNumber:   num,
      questionId:       q.id || num,
      section:          q.section,
      topic:            q.topic,
      type:             q.type,
      question:         q.question,
      studentAnswer:    answer || '',
      marksAwarded:     Math.min(Math.max(Number(p.marksAwarded || 0), 0), q.marks),
      maxMarks:         q.marks,
      feedback:         p.feedback || 'No feedback available.',
      isCorrect:        Boolean(p.isCorrect),
      keyPointsCovered: Array.isArray(p.keyPointsCovered) ? p.keyPointsCovered : [],
      keyPointsMissed:  Array.isArray(p.keyPointsMissed)  ? p.keyPointsMissed  : [],
    }
  } catch {
    return {
      questionNumber: num, questionId: q.id || num,
      section: q.section, topic: q.topic, type: q.type,
      question: q.question, studentAnswer: answer || '',
      marksAwarded: 0, maxMarks: q.marks,
      feedback: 'Auto-marking unavailable for this question.',
      isCorrect: false, keyPointsCovered: [], keyPointsMissed: [],
    }
  }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`mocktest-sub:${user.id}:${getClientIp(req)}`, { limit: 10, windowMs: 60 * 60_000 })

    const { mockTestId, answers = [], timeTakenSecs = 0 } = req.body || {}
    if (!mockTestId)     return fail(res, { status: 400, message: 'We could not find that mock test. Please refresh and try again.' })
    if (!answers.length) return fail(res, { status: 400, message: 'Please answer at least one question before submitting.' })

    if (!process.env.GEMINI_API_KEY) {
      return fail(res, createUnavailableError('Auto-marking is not available right now. Please try again a little later.'))
    }

    if (shouldSkipGeminiDueToRecentQuota()) {
      return fail(res, createUnavailableError('Auto-marking is taking a short break right now. Please try again in about a minute.', 429, 60))
    }

    const supabase = getAdminSupabase()

    // Fetch test with model answers (server-side only)
    const { data: test, error: testErr } = await supabase
      .from('mock_tests')
      .select('id, title, subject, total_marks, duration_minutes, questions, user_id')
      .eq('id', mockTestId).eq('user_id', user.id).single()

    if (testErr || !test) return fail(res, { status: 404, message: 'We could not find that mock test. Please refresh and try again.' })

    const questions   = Array.isArray(test.questions) ? test.questions : []
    const answerMap   = new Map(answers.map(a => [Number(a.questionIndex), `${a.answer || ''}`.trim()]))

    const analysis = []

    for (let i = 0; i < questions.length; i++) {
      const q      = questions[i]
      const answer = answerMap.get(i) || ''

      try {
        const result = await markQuestion(q, answer, i + 1)
        analysis.push(result)
      } catch (err) {
        if (isAiAvailabilityError(err)) {
          throw createUnavailableError(
            err?.status === 429
              ? 'Auto-marking is taking a short break right now. Please try again in about a minute.'
              : 'Auto-marking is not available right now. Please try again a little later.',
            err?.status === 429 ? 429 : 503,
            err?.retryAfterSeconds || null,
          )
        }

        analysis.push({ questionNumber: i+1, questionId: q.id||i+1, section: q.section, topic: q.topic, type: q.type, question: q.question, studentAnswer: answer, marksAwarded: 0, maxMarks: q.marks, feedback: 'Evaluation failed.', isCorrect: false, keyPointsCovered: [], keyPointsMissed: [] })
      }
    }

    // Totals
    const totalMarks    = test.total_marks
    const marksObtained = analysis.reduce((s, a) => s + a.marksAwarded, 0)
    const percentage    = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 10000) / 100 : 0
    const { grade, label: gradeLabel, color: gradeColor } = getGrade(percentage)

    // Section breakdown
    const secMap = new Map()
    analysis.forEach(a => {
      const s = secMap.get(a.section) || { section: a.section, marks: 0, maxMarks: 0, count: 0 }
      s.marks += a.marksAwarded; s.maxMarks += a.maxMarks; s.count++
      secMap.set(a.section, s)
    })
    const sectionBreakdown = [...secMap.values()].map(s => ({
      ...s, percentage: s.maxMarks > 0 ? Math.round((s.marks / s.maxMarks) * 100) : 0,
    }))

    // Topic breakdown
    const topMap = new Map()
    analysis.forEach(a => {
      const t = topMap.get(a.topic) || { topic: a.topic, marks: 0, maxMarks: 0 }
      t.marks += a.marksAwarded; t.maxMarks += a.maxMarks
      topMap.set(a.topic, t)
    })
    const topicBreakdown = [...topMap.values()].map(t => ({
      ...t, percentage: t.maxMarks > 0 ? Math.round((t.marks / t.maxMarks) * 100) : 0,
    })).sort((a, b) => a.percentage - b.percentage)

    // Save to DB
    const { data: submission } = await supabase
      .from('mock_test_submissions')
      .insert({
        user_id: user.id, mock_test_id: mockTestId,
        answers, analysis, total_marks: totalMarks,
        marks_obtained: marksObtained, percentage,
        time_taken_secs: Number(timeTakenSecs) || 0,
        analysed_at: new Date().toISOString(),
      })
      .select('id, submitted_at').single()

    return ok(res, {
      submissionId: submission?.id,
      result: {
        title: test.title, subject: test.subject,
        marksObtained, totalMarks, percentage,
        grade, gradeLabel, gradeColor,
        timeTakenSecs: Number(timeTakenSecs) || 0,
        durationMinutes: test.duration_minutes,
        questionsCount: questions.length,
        correctCount: analysis.filter(a => a.isCorrect).length,
        sectionBreakdown,
        topicBreakdown,
        weakTopics:   topicBreakdown.filter(t => t.percentage <  50),
        strongTopics: topicBreakdown.filter(t => t.percentage >= 75),
        analysis,
      },
    })

  } catch (error) {
    return fail(res, error)
  }
}
