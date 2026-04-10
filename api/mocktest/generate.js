import {
  checkRateLimit,
  ensureProfile,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  sanitizeFileName,
  setCors,
} from '../../server/helpers.js'
import {
  buildRelevantExcerpt,
  extractPdfText,
} from '../../server/documentText.js'
import {
  extractJsonFromText,
  getGeminiClient,
  getGeminiModelName,
  runGeminiTask,
  shouldSkipGeminiDueToRecentQuota,
} from '../../server/gemini.js'
import { groqGenerateMockTest, isGroqConfigured } from '../../server/groq.js'
import { buildMockTestTitle } from '../../server/mockTestStage.js'

const DEFAULT_DURATION_MINUTES = 60
const MAX_QUESTION_COUNT = 15
const TARGET_TOTAL_MARKS = 40
const MAX_SOURCE_TEXT_CHARS = 60_000
const ALLOWED_TYPES = new Set(['short_answer', 'long_answer', 'numerical', 'fill_blank'])
const ALLOWED_SECTIONS = new Set(['Section A', 'Section B', 'Section C'])

function cleanValue(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim()
}

function shouldFallback(error) {
  return (error?.status || 0) !== 400
}

async function findExistingTest(supabase, userId, documentId, title) {
  const { data: tests } = await supabase
    .from('mock_tests')
    .select(`
      id, title, subject, duration_minutes, total_marks, questions, created_at,
      mock_test_submissions ( id )
    `)
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .eq('title', title)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!tests?.length) {
    return null
  }

  return tests[0]
}

function buildPrompt({ title, subject, durationMinutes, focusTopic, stageDayNumber }) {
  const stageLine = stageDayNumber ? `Roadmap stage day: ${stageDayNumber}.` : ''
  const focusLine = focusTopic
    ? `Focus only on this current study topic or stage: "${focusTopic}".`
    : 'Focus only on the current key topic from the document excerpt.'

  return `You are an expert teacher creating a focused topic-wise mock test for "${subject || title}".
Generate a realistic 1-hour mock test using ONLY the supplied document excerpt.
${stageLine}
${focusLine}
Duration: ${durationMinutes} minutes.

Return ONLY a valid JSON array with no markdown.
Generate exactly ${MAX_QUESTION_COUNT} questions. Never return more than ${MAX_QUESTION_COUNT}.

Each question object must contain:
- "id": number starting at 1
- "section": "Section A" | "Section B" | "Section C"
- "type": "short_answer" | "long_answer" | "numerical" | "fill_blank"
- "question": full question text
- "marks": integer marks for this question
- "expectedLength": short guidance such as "one word", "2-3 sentences", "show working", "1 paragraph"
- "hint": short hint, or empty string
- "topic": topic or subtopic name
- "modelAnswer": clear correct answer for marking

Target structure:
- Section A: 5 quick recall questions worth 1-2 marks each
- Section B: 5 understanding or application questions worth 2-4 marks each
- Section C: 5 deeper questions worth 3-6 marks each

Rules:
1. Every question must stay inside the provided topic/stage
2. Use only facts present in the excerpt
3. Keep the whole paper suitable for a 60-minute test
4. Keep total marks close to ${TARGET_TOTAL_MARKS}
5. Use "numerical" only if the topic genuinely needs calculation; otherwise prefer short_answer or long_answer
6. Fill in the blank questions must have one clear answer

Return the JSON array now.`
}

function normalizeQuestion(rawQuestion = {}, index = 0, focusTopic = '') {
  const rawType = cleanValue(rawQuestion?.type).toLowerCase()
  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'short_answer'
  const rawSection = cleanValue(rawQuestion?.section)
  const section = ALLOWED_SECTIONS.has(rawSection)
    ? rawSection
    : type === 'fill_blank' || type === 'short_answer'
      ? 'Section A'
      : type === 'long_answer'
        ? 'Section B'
        : 'Section C'

  let marks = Math.round(Number(rawQuestion?.marks) || 0)

  if (type === 'fill_blank') {
    marks = Math.min(2, Math.max(1, marks || 1))
  } else if (type === 'short_answer') {
    marks = Math.min(4, Math.max(2, marks || 2))
  } else if (type === 'long_answer') {
    marks = Math.min(6, Math.max(4, marks || 5))
  } else {
    marks = Math.min(6, Math.max(3, marks || 4))
  }

  return {
    id: index + 1,
    section,
    type,
    question: cleanValue(rawQuestion?.question) || `Question ${index + 1}`,
    marks,
    expectedLength: cleanValue(rawQuestion?.expectedLength) || (
      type === 'fill_blank'
        ? 'one word'
        : type === 'long_answer'
          ? '1 paragraph'
          : type === 'numerical'
            ? 'show working'
            : '2-3 sentences'
    ),
    hint: cleanValue(rawQuestion?.hint),
    topic: cleanValue(rawQuestion?.topic) || focusTopic || 'General',
    modelAnswer: cleanValue(rawQuestion?.modelAnswer) || 'Answer unavailable.',
  }
}

function normalizeQuestions(rawQuestions = [], focusTopic = '') {
  return rawQuestions
    .filter((question) => question && typeof question === 'object')
    .slice(0, MAX_QUESTION_COUNT)
    .map((question, index) => normalizeQuestion(question, index, focusTopic))
    .filter((question) => question.question)
}

function safeQuestions(questions) {
  return questions.map((question) => ({
    id: question.id,
    section: question.section,
    type: question.type,
    question: question.question,
    marks: question.marks,
    expectedLength: question.expectedLength || '',
    hint: question.hint || '',
    topic: question.topic,
  }))
}

async function generateWithGemini({ doc, documentText, durationMinutes, focusTopic, stageDayNumber }) {
  const excerpt = buildRelevantExcerpt(documentText, {
    query: focusTopic || '',
    maxChars: MAX_SOURCE_TEXT_CHARS,
    maxParagraphs: focusTopic ? 12 : 16,
  })

  if (!excerpt.trim()) {
    throw new Error('We could not read enough text from this PDF to build a topic-wise mock test yet.')
  }

  const ai = getGeminiClient()
  const result = await runGeminiTask(() => ai.models.generateContent({
    model: getGeminiModelName(),
    contents: [{
      text: [
        buildPrompt({
          title: doc.title,
          subject: doc.subject,
          durationMinutes,
          focusTopic,
          stageDayNumber,
        }),
        `Document title: ${sanitizeFileName(doc.title || 'study-notes.pdf')}`,
        'Use only the provided excerpt.',
        `Document excerpt:\n${excerpt}`,
      ].join('\n\n'),
    }],
    config: {
      responseMimeType: 'application/json',
      systemInstruction: 'Return only a valid JSON array of question objects. No markdown.',
    },
  }), { label: 'MockTest/generate' })

  const parsed = JSON.parse(extractJsonFromText(result.text || '[]'))
  const questions = normalizeQuestions(Array.isArray(parsed) ? parsed : [], focusTopic)

  if (!questions.length) {
    throw new Error('No mock test questions were generated')
  }

  return { questions, model: getGeminiModelName() }
}

async function generateWithGroq({ doc, documentText, durationMinutes, focusTopic, stageDayNumber }) {
  const excerpt = buildRelevantExcerpt(documentText, {
    query: focusTopic || '',
    maxChars: 50_000,
    maxParagraphs: focusTopic ? 12 : 16,
  })

  if (!excerpt.trim()) {
    throw new Error('We could not read enough text from this PDF to build a topic-wise mock test yet.')
  }

  const prompt = [
    buildPrompt({
      title: doc.title,
      subject: doc.subject,
      durationMinutes,
      focusTopic,
      stageDayNumber,
    }),
    `Document title: ${doc.title}`,
    `Document excerpt:\n${excerpt}`,
  ].join('\n\n')

  const raw = await groqGenerateMockTest({
    documentTitle: doc.title,
    documentText: excerpt,
    prompt,
    totalMarks: TARGET_TOTAL_MARKS,
  })

  const questions = normalizeQuestions(Array.isArray(raw) ? raw : [], focusTopic)

  if (!questions.length) {
    throw new Error('Groq returned no questions')
  }

  return { questions, model: 'groq-fallback' }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`mocktest-gen:${user.id}:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 })

    const { documentId, focusTopic: rawFocusTopic = '', stageDayNumber = null } = req.body || {}
    if (!documentId) {
      return fail(res, { status: 400, message: 'Please choose a document first.' })
    }

    const focusTopic = cleanValue(rawFocusTopic)
    const duration = DEFAULT_DURATION_MINUTES

    const supabase = getAdminSupabase()
    await ensureProfile(supabase, user)

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, title, subject, storage_path, mime_type, document_text')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docErr || !doc) {
      return fail(res, { status: 404, message: 'We could not find that document. Please refresh and try again.' })
    }

    if (doc.mime_type !== 'application/pdf') {
      return fail(res, { status: 400, message: 'Mock tests work with PDF documents right now. Please choose a PDF to continue.' })
    }

    const mockTestTitle = buildMockTestTitle(doc.title, { focusTopic, stageDayNumber })
    const existing = await findExistingTest(supabase, user.id, documentId, mockTestTitle)

    if (existing) {
      return ok(res, {
        mockTest: {
          id: existing.id,
          documentId,
          title: existing.title,
          subject: existing.subject,
          durationMinutes: existing.duration_minutes,
          totalMarks: existing.total_marks,
          questionCount: Array.isArray(existing.questions) ? existing.questions.length : 0,
          createdAt: existing.created_at,
          isExisting: true,
          focusTopic,
          stageDayNumber: Number(stageDayNumber) || null,
        },
        questions: safeQuestions(Array.isArray(existing.questions) ? existing.questions : []),
        isExisting: true,
      })
    }

    let documentText = `${doc.document_text || ''}`.trim()
    if (!documentText && doc.storage_path) {
      const { data: fileData, error: fileError } = await supabase.storage.from('documents').download(doc.storage_path)
      if (fileError) throw fileError

      const extracted = await extractPdfText(Buffer.from(await fileData.arrayBuffer()))
      documentText = `${extracted.text || ''}`.trim()

      if (documentText) {
        supabase
          .from('documents')
          .update({ document_text: documentText })
          .eq('id', doc.id)
          .catch(() => {})
      }
    }

    if (!documentText) {
      return fail(res, {
        status: 422,
        message: 'We could not read enough text from this PDF to build a mock test yet. Please try another PDF.',
      })
    }

    let questions = []
    let model = 'unknown'

    try {
      if (!process.env.GEMINI_API_KEY || shouldSkipGeminiDueToRecentQuota()) {
        throw new Error('Gemini unavailable')
      }

      ;({ questions, model } = await generateWithGemini({
        doc,
        documentText,
        durationMinutes: duration,
        focusTopic,
        stageDayNumber,
      }))
    } catch (geminiError) {
      if (shouldFallback(geminiError) && isGroqConfigured()) {
        console.warn('[MockTest/generate] Gemini failed → Groq:', geminiError.message)
        ;({ questions, model } = await generateWithGroq({
          doc,
          documentText,
          durationMinutes: duration,
          focusTopic,
          stageDayNumber,
        }))
      } else {
        throw geminiError
      }
    }

    const totalMarks = questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0)

    const { data: mockTest, error: insertError } = await supabase
      .from('mock_tests')
      .insert({
        user_id: user.id,
        document_id: documentId,
        title: mockTestTitle,
        subject: doc.subject || 'General',
        duration_minutes: duration,
        total_marks: totalMarks,
        questions,
        status: 'ready',
        generated_with_model: model,
      })
      .select('id, title, subject, duration_minutes, total_marks, created_at')
      .single()

    if (insertError) {
      throw insertError
    }

    return ok(res, {
      mockTest: {
        id: mockTest.id,
        documentId,
        title: mockTest.title,
        subject: mockTest.subject,
        durationMinutes: mockTest.duration_minutes,
        totalMarks: mockTest.total_marks,
        questionCount: questions.length,
        createdAt: mockTest.created_at,
        isExisting: false,
        focusTopic,
        stageDayNumber: Number(stageDayNumber) || null,
      },
      questions: safeQuestions(questions),
      isExisting: false,
    }, 201)
  } catch (error) {
    return fail(res, error)
  }
}
