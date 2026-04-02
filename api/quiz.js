import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  sanitizeFileName,
  setCors,
} from './_helpers.js'
import {
  extractJsonFromText,
  getGeminiClient,
  getGeminiModelName,
  makeGeminiFilePart,
  runGeminiTask,
  uploadPdfToGemini,
} from './_gemini.js'

const ALLOWED_TYPES = new Set(['mcq', 'truefalse', 'flashcard'])
const QUIZ_STATUS = {
  pending: 'pending',
  ready: 'ready',
  failed: 'failed',
}
const QUIZ_SOURCE = {
  manual: 'manual',
  autoUpload: 'auto_upload',
}
const QUIZ_COLUMNS = [
  'id',
  'document_id',
  'user_id',
  'topic',
  'type',
  'questions',
  'score',
  'attempted',
  'status',
  'source',
  'error_message',
  'requested_count',
  'generated_with_model',
  'generation_started_at',
  'generation_completed_at',
  'created_at',
].join(', ')
const DEFAULT_COUNT_BY_TYPE = {
  mcq: 10,
  truefalse: 10,
  flashcard: 50,
}
const MAX_COUNT_BY_TYPE = {
  mcq: 20,
  truefalse: 20,
  flashcard: 50,
}
const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash-lite'

function buildPrompt({ type, count, topic }) {
  const topicInstruction = topic
    ? `Focus only on the topic "${topic}".`
    : 'Cover the most important concepts across the document.'

  if (type === 'truefalse') {
    return [
      `Generate exactly ${count} true/false questions from this document.`,
      topicInstruction,
      'Return only a JSON array.',
      'Each item must contain question, correct, explanation, and topic.',
    ].join(' ')
  }

  if (type === 'flashcard') {
    return [
      `Generate exactly ${count} flashcards from this document.`,
      topicInstruction,
      'Return only a JSON array.',
      'Each item must contain front, back, and topic.',
    ].join(' ')
  }

  return [
    `Generate exactly ${count} multiple-choice questions from this document.`,
    topicInstruction,
    'Return only a JSON array.',
    'Each item must contain question, options, correct, explanation, and topic.',
    'options must contain exactly four strings.',
    'correct must be the zero-based index of the right answer.',
    'Make wrong answers plausible but clearly distinguishable from the correct answer.',
  ].join(' ')
}

function getQuizGeminiClient() {
  return getGeminiClient(process.env.QUIZ_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
}

function getQuizModelCandidates() {
  return [
    process.env.QUIZ_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    process.env.QUIZ_GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ].filter((modelName, index, list) => modelName && list.indexOf(modelName) === index)
}

function shouldTryFallbackModel(error) {
  const status = Number(error?.status || error?.error?.code || 0)
  const message = `${error?.message || ''}`.toUpperCase()

  return (
    [429, 500, 503, 504].includes(status)
    || message.includes('UNAVAILABLE')
    || message.includes('HIGH DEMAND')
    || message.includes('RESOURCE_EXHAUSTED')
    || message.includes('TEMPORARILY BUSY')
  )
}

function getRequestedCount(type, rawCount) {
  const fallbackCount = DEFAULT_COUNT_BY_TYPE[type] || DEFAULT_COUNT_BY_TYPE.mcq
  const maxCount = MAX_COUNT_BY_TYPE[type] || MAX_COUNT_BY_TYPE.mcq
  return Math.min(maxCount, Math.max(1, Number(rawCount) || fallbackCount))
}

function normalizeQuestions(rawQuestions = [], type = 'mcq') {
  return rawQuestions
    .map((question, index) => {
      if (type === 'flashcard') {
        const front = question?.front || question?.question || `Flashcard ${index + 1}`
        const back = question?.back || question?.explanation || 'Answer unavailable'
        return {
          question: front,
          front,
          options: [back],
          correct: 0,
          explanation: back,
          back,
          topic: question?.topic || 'General',
        }
      }

      if (type === 'truefalse') {
        const correct = question?.correct === true || question?.correct === 0 ? 0 : 1
        return {
          question: question?.question || `Question ${index + 1}`,
          options: ['True', 'False'],
          correct,
          explanation: question?.explanation || '',
          topic: question?.topic || 'General',
        }
      }

      const options = Array.isArray(question?.options)
        ? question.options.filter(Boolean).slice(0, 4)
        : []

      while (options.length < 4) {
        options.push(`Option ${options.length + 1}`)
      }

      const parsedCorrect = Number(question?.correct)
      const correct = Number.isInteger(parsedCorrect) && parsedCorrect >= 0 && parsedCorrect < options.length
        ? parsedCorrect
        : 0

      return {
        question: question?.question || `Question ${index + 1}`,
        options,
        correct,
        explanation: question?.explanation || '',
        topic: question?.topic || 'General',
      }
    })
    .filter((question) => question.question)
}

function serializeQuiz(quiz) {
  if (!quiz) {
    return null
  }

  return {
    ...quiz,
    questions: Array.isArray(quiz.questions) ? quiz.questions : [],
    status: quiz.status || QUIZ_STATUS.ready,
    source: quiz.source || QUIZ_SOURCE.manual,
    requested_count: Number(quiz.requested_count || 0),
  }
}

function buildQuizResponse(quiz) {
  const safeQuiz = serializeQuiz(quiz)
  return {
    quiz: safeQuiz,
    questions: safeQuiz?.status === QUIZ_STATUS.ready ? safeQuiz.questions : [],
    status: safeQuiz?.status || 'missing',
  }
}

async function fetchDocument(supabase, userId, documentId) {
  const { data: document, error } = await supabase
    .from('documents')
    .select('id, title, storage_path, user_id, mime_type')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single()

  if (error || !document) {
    const notFoundError = new Error('Document not found')
    notFoundError.status = 404
    throw notFoundError
  }

  return document
}

function chooseLatestQuiz(quizzes = []) {
  if (!quizzes.length) {
    return null
  }

  return (
    quizzes.find((quiz) => quiz.status === QUIZ_STATUS.ready)
    || quizzes.find((quiz) => quiz.status === QUIZ_STATUS.pending)
    || quizzes[0]
  )
}

async function loadLatestQuiz(supabase, userId, documentId, options = {}) {
  const {
    source = null,
    type = null,
  } = options

  let query = supabase
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (source) {
    query = query.eq('source', source)
  }

  if (type && ALLOWED_TYPES.has(type)) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) throw error
  return serializeQuiz(chooseLatestQuiz(data || []))
}

async function createQuizShell(supabase, payload) {
  const { data, error } = await supabase
    .from('quizzes')
    .insert(payload)
    .select(QUIZ_COLUMNS)
    .single()

  if (error) throw error
  return serializeQuiz(data)
}

async function updateQuizRecord(supabase, quizId, payload) {
  const { data, error } = await supabase
    .from('quizzes')
    .update(payload)
    .eq('id', quizId)
    .select(QUIZ_COLUMNS)
    .single()

  if (error) throw error
  return serializeQuiz(data)
}

async function generateQuestionsWithFallback({ document, count, topic, type, pdfBuffer }) {
  const ai = getQuizGeminiClient()
  const modelCandidates = getQuizModelCandidates()
  const geminiFile = await uploadPdfToGemini(ai, {
    buffer: pdfBuffer,
    displayName: sanitizeFileName(document.title || 'study-notes.pdf'),
  })

  let lastError = null

  for (const [index, modelName] of modelCandidates.entries()) {
    try {
      const result = await runGeminiTask(() => ai.models.generateContent({
        model: getGeminiModelName(modelName),
        contents: [
          { text: buildPrompt({ type, count, topic }) },
          makeGeminiFilePart(geminiFile),
        ],
        config: {
          responseMimeType: 'application/json',
          systemInstruction: [
            'Generate questions only from the uploaded PDF.',
            'Do not invent facts not present in the PDF.',
            'Keep explanations short and specific.',
          ].join(' '),
        },
      }), {
        label: `Gemini quiz generation (${modelName})`,
        userMessage: 'Quiz generation is temporarily busy due to AI demand. Please try again in about a minute.',
      })

      const parsed = JSON.parse(extractJsonFromText(result.text))
      if (!Array.isArray(parsed)) {
        throw new Error('Quiz response was not an array')
      }

      const questions = normalizeQuestions(parsed, type)
      if (!questions.length) {
        throw new Error('Quiz generation returned no usable questions')
      }

      return { questions, modelName }
    } catch (error) {
      lastError = error

      if (index < modelCandidates.length - 1 && shouldTryFallbackModel(error)) {
        console.warn(`[Quiz model fallback] ${modelName} failed. Trying next configured quiz model.`)
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('Quiz generation failed')
}

async function handleGet(req, res) {
  const user = await requireAuth(req)
  const documentId = req.query?.documentId
  const requestedType = req.query?.type
  const type = ALLOWED_TYPES.has(requestedType) ? requestedType : null

  if (!documentId) {
    return fail(res, { status: 400, message: 'documentId is required' })
  }

  const supabase = getAdminSupabase()
  await fetchDocument(supabase, user.id, documentId)

  const latestQuiz = await loadLatestQuiz(supabase, user.id, documentId, { type })
  return ok(res, buildQuizResponse(latestQuiz))
}

async function handlePost(req, res) {
  const user = await requireAuth(req)
  const rateLimitKey = `quiz:${user.id}:${getClientIp(req)}`
  checkRateLimit(rateLimitKey, { limit: 20, windowMs: 60 * 60 * 1000 })

  const {
    documentId,
    topic = null,
    count: rawCount,
    type: rawType = 'mcq',
    mode: rawMode = QUIZ_SOURCE.manual,
  } = req.body || {}

  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'mcq'
  const count = getRequestedCount(type, rawCount)
  const source = rawMode === QUIZ_SOURCE.autoUpload ? QUIZ_SOURCE.autoUpload : QUIZ_SOURCE.manual

  if (!documentId) {
    return fail(res, { status: 400, message: 'documentId is required' })
  }

  const supabase = getAdminSupabase()
  const document = await fetchDocument(supabase, user.id, documentId)

  if (document.mime_type !== 'application/pdf') {
    return fail(res, {
      status: 400,
      message: 'AI quiz generation currently supports PDF documents only.',
    })
  }

  if (source === QUIZ_SOURCE.autoUpload) {
    const existingAutoQuiz = await loadLatestQuiz(supabase, user.id, documentId, {
      source: QUIZ_SOURCE.autoUpload,
      type,
    })
    if (existingAutoQuiz && existingAutoQuiz.source === QUIZ_SOURCE.autoUpload && existingAutoQuiz.status !== QUIZ_STATUS.failed) {
      return ok(res, buildQuizResponse(existingAutoQuiz))
    }
  }

  const quizShell = await createQuizShell(supabase, {
    user_id: user.id,
    document_id: documentId,
    topic: topic || 'General',
    type,
    questions: [],
    score: null,
    attempted: false,
    status: QUIZ_STATUS.pending,
    source,
    error_message: null,
    requested_count: count,
    generated_with_model: null,
    generation_started_at: new Date().toISOString(),
    generation_completed_at: null,
  })

  try {
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (fileError) throw fileError

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    const { questions, modelName } = await generateQuestionsWithFallback({
      document,
      count,
      topic,
      type,
      pdfBuffer,
    })

    const readyQuiz = await updateQuizRecord(supabase, quizShell.id, {
      questions,
      status: QUIZ_STATUS.ready,
      error_message: null,
      generated_with_model: modelName,
      generation_completed_at: new Date().toISOString(),
    })

    return ok(res, buildQuizResponse(readyQuiz), 201)
  } catch (error) {
    try {
      await updateQuizRecord(supabase, quizShell.id, {
        status: QUIZ_STATUS.failed,
        error_message: error?.message || 'Quiz generation failed',
        generation_completed_at: new Date().toISOString(),
      })
    } catch (updateError) {
      console.error('[Quiz failure persistence error]', updateError)
    }

    return fail(res, error)
  }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res)
    }

    if (req.method === 'POST') {
      return await handlePost(req, res)
    }

    return fail(res, { status: 405, message: 'Method not allowed' })
  } catch (error) {
    return fail(res, error)
  }
}
