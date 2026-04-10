import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  sanitizeFileName,
  setCors,
} from '../server/helpers.js'
import {
  buildRelevantExcerpt,
  extractPdfText,
  isMissingDocumentTextColumnError,
} from '../server/documentText.js'
import {
  extractJsonFromText,
  getGeminiClient,
  getGeminiModelName,
  runGeminiTask,
  shouldSkipGeminiDueToRecentQuota,
  shouldTryAnotherGeminiModel,
} from '../server/gemini.js'

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
  'language',
  'topic',
  'type',
  'questions',
  'answers',
  'current_index',
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
  mcq: 20,
  truefalse: 10,
  flashcard: 50,
}
const MAX_COUNT_BY_TYPE = {
  mcq: 20,
  truefalse: 20,
  flashcard: 50,
}
const DEFAULT_FALLBACK_MODEL = 'gemma-4-31b-it'
const MAX_QUIZ_SOURCE_TEXT_CHARS = 60_000

function getLanguageDefaults(lang = 'en') {
  const isHindi = lang === 'hi'

  return {
    generalTopic: isHindi ? 'सामान्य' : 'General',
    questionLabel: isHindi ? 'प्रश्न' : 'Question',
    flashcardLabel: isHindi ? 'फ्लैशकार्ड' : 'Flashcard',
    answerUnavailable: isHindi ? 'उत्तर उपलब्ध नहीं है' : 'Answer unavailable',
    optionLabel: isHindi ? 'विकल्प' : 'Option',
    trueLabel: isHindi ? 'सही' : 'True',
    falseLabel: isHindi ? 'गलत' : 'False',
  }
}

function createUnavailableError(message, status = 503, retryAfterSeconds = null) {
  const error = new Error(message)
  error.status = status
  if (retryAfterSeconds) {
    error.retryAfterSeconds = retryAfterSeconds
  }
  return error
}

function buildPrompt({ type, count, topic, lang = 'en' }) {
  const topicInstruction = topic
    ? `Focus only on the topic "${topic}".`
    : 'Cover the most important concepts across the document.'
  const languageInstruction = lang === 'hi'
    ? 'Write every question, option, explanation, flashcard front, flashcard back, and topic in Hindi using Devanagari script.'
    : 'Write every question, option, explanation, flashcard front, flashcard back, and topic in English.'

  if (type === 'truefalse') {
    return [
      `Generate exactly ${count} true/false questions from this document.`,
      topicInstruction,
      languageInstruction,
      'Return only a JSON array.',
      'Each item must contain question, correct, explanation, and topic.',
    ].join(' ')
  }

  if (type === 'flashcard') {
    return [
      `Generate exactly ${count} flashcards from this document.`,
      topicInstruction,
      languageInstruction,
      'Return only a JSON array.',
      'Each item must contain front, back, and topic.',
    ].join(' ')
  }

  return [
    `Generate exactly ${count} multiple-choice questions from this document.`,
    topicInstruction,
    languageInstruction,
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
    process.env.QUIZ_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemma-4-31b-it',
    process.env.QUIZ_GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ].filter((modelName, index, list) => modelName && list.indexOf(modelName) === index)
}

function getRequestedCount(type, rawCount) {
  const fallbackCount = DEFAULT_COUNT_BY_TYPE[type] || DEFAULT_COUNT_BY_TYPE.mcq
  const maxCount = MAX_COUNT_BY_TYPE[type] || MAX_COUNT_BY_TYPE.mcq
  return Math.min(maxCount, Math.max(1, Number(rawCount) || fallbackCount))
}

function normalizeQuestions(rawQuestions = [], type = 'mcq', lang = 'en') {
  const defaults = getLanguageDefaults(lang)

  return rawQuestions
    .map((question, index) => {
      if (type === 'flashcard') {
        const front = question?.front || question?.question || `${defaults.flashcardLabel} ${index + 1}`
        const back = question?.back || question?.explanation || defaults.answerUnavailable
        return {
          question: front,
          front,
          options: [back],
          correct: 0,
          explanation: back,
          back,
          topic: question?.topic || defaults.generalTopic,
        }
      }

      if (type === 'truefalse') {
        const correct = question?.correct === true || question?.correct === 0 ? 0 : 1
        return {
          question: question?.question || `${defaults.questionLabel} ${index + 1}`,
          options: [defaults.trueLabel, defaults.falseLabel],
          correct,
          explanation: question?.explanation || '',
          topic: question?.topic || defaults.generalTopic,
        }
      }

      const options = Array.isArray(question?.options)
        ? question.options.filter(Boolean).slice(0, 4)
        : []

      while (options.length < 4) {
        options.push(`${defaults.optionLabel} ${options.length + 1}`)
      }

      const parsedCorrect = Number(question?.correct)
      const correct = Number.isInteger(parsedCorrect) && parsedCorrect >= 0 && parsedCorrect < options.length
        ? parsedCorrect
        : 0

      return {
        question: question?.question || `${defaults.questionLabel} ${index + 1}`,
        options,
        correct,
        explanation: question?.explanation || '',
        topic: question?.topic || defaults.generalTopic,
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
    answers: Array.isArray(quiz.answers) ? quiz.answers : [],
    current_index: Math.max(0, Number(quiz.current_index) || 0),
    status: quiz.status || QUIZ_STATUS.ready,
    source: quiz.source || QUIZ_SOURCE.manual,
    requested_count: Number(quiz.requested_count || 0),
  }
}

function hasSavedQuizProgress(quiz) {
  return Array.isArray(quiz?.answers) && quiz.answers.some((answer) => answer !== null && answer !== undefined)
}

function sanitizeAnswers(answers) {
  if (!Array.isArray(answers)) return []
  return answers.map((answer) => {
    if (answer === null || answer === undefined) return null
    const numericAnswer = Number(answer)
    return Number.isInteger(numericAnswer) && numericAnswer >= 0 ? numericAnswer : null
  })
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
  let canPersistDocumentText = true
  let { data: document, error } = await supabase
    .from('documents')
    .select('id, title, storage_path, user_id, mime_type, document_text')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && isMissingDocumentTextColumnError(error)) {
    canPersistDocumentText = false
    ;({ data: document, error } = await supabase
      .from('documents')
      .select('id, title, storage_path, user_id, mime_type')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle())
  }

  if (error || !document) {
    const notFoundError = new Error('Document not found')
    notFoundError.status = 404
    throw notFoundError
  }

  return {
    document,
    canPersistDocumentText,
  }
}

async function loadDocumentText({ supabase, userId, document, canPersistDocumentText }) {
  let documentText = `${document?.document_text || ''}`.trim()

  if (documentText) {
    return documentText
  }

  const { data: fileData, error: fileError } = await supabase.storage
    .from('documents')
    .download(document.storage_path)

  if (fileError) throw fileError

  const extracted = await extractPdfText(Buffer.from(await fileData.arrayBuffer()))
  documentText = `${extracted.text || ''}`.trim()

  if (documentText && canPersistDocumentText) {
    await supabase
      .from('documents')
      .update({ document_text: documentText })
      .eq('id', document.id)
      .eq('user_id', userId)
      .then(() => {})
      .catch((persistError) => {
        console.warn('[Quiz] Could not persist extracted document text:', persistError?.message || persistError)
      })
  }

  return documentText
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
    topic = null,
    lang = 'en',
    resumeOnly = false,
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

  query = query.eq('language', lang === 'hi' ? 'hi' : 'en')

  if (topic) {
    query = query.eq('topic', topic)
  }

  const { data, error } = await query

  if (error) throw error
  if (resumeOnly) {
    return serializeQuiz((data || []).find((quiz) => (
      quiz?.status === QUIZ_STATUS.ready
      && !quiz?.attempted
      && hasSavedQuizProgress(quiz)
    )) || null)
  }
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

async function generateQuestionsWithGemini({ document, count, topic, type, documentText, lang = 'en' }) {
  const ai = getQuizGeminiClient()
  const modelCandidates = getQuizModelCandidates()
  const excerpt = buildRelevantExcerpt(documentText, {
    query: topic || '',
    maxChars: MAX_QUIZ_SOURCE_TEXT_CHARS,
    maxParagraphs: topic ? 10 : 14,
  })

  if (!excerpt.trim()) {
    throw createUnavailableError('We could not read enough text from this PDF to generate a quiz yet. Please try another PDF.')
  }

  let lastError = null

  for (const [index, modelName] of modelCandidates.entries()) {
    try {
      const result = await runGeminiTask(() => ai.models.generateContent({
        model: getGeminiModelName(modelName),
        contents: [{
          text: [
            buildPrompt({ type, count, topic, lang }),
            `Document title: ${sanitizeFileName(document.title || 'study-notes.pdf')}`,
            'Use only the provided document excerpt.',
            `Document excerpt:\n${excerpt}`,
          ].join('\n\n'),
        }],
        config: {
          responseMimeType: 'application/json',
          systemInstruction: [
            'Generate questions only from the provided document excerpt.',
            'Do not invent facts not present in the PDF.',
            'Keep explanations short and specific.',
          ].join(' '),
        },
      }), {
        label: `Gemini quiz generation (${modelName})`,
        userMessage: 'Quiz generation is temporarily busy due to AI demand. Please try again in about a minute.',
        quotaUserMessage: 'Quiz generation is temporarily unavailable right now. Please try again shortly.',
      })

      const parsed = JSON.parse(extractJsonFromText(result.text))
      if (!Array.isArray(parsed)) {
        throw new Error('Quiz response was not an array')
      }

      const questions = normalizeQuestions(parsed, type, lang)
      if (!questions.length) {
        throw new Error('Quiz generation returned no usable questions')
      }

      return { questions, modelName }
    } catch (error) {
      lastError = error

      if (
        index < modelCandidates.length - 1
        && shouldTryAnotherGeminiModel(error)
      ) {
        console.warn(`[Quiz model retry] ${modelName} failed. Trying next configured quiz model.`)
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('We could not generate a quiz right now. Please try again.')
}

async function handleGet(req, res) {
  const user = await requireAuth(req)
  const documentId = req.query?.documentId
  const requestedType = req.query?.type
  const topic = `${req.query?.topic || ''}`.trim() || null
  const lang = req.query?.lang === 'hi' ? 'hi' : 'en'
  const type = ALLOWED_TYPES.has(requestedType) ? requestedType : null
  const resumeOnly = req.query?.resumeOnly === '1'

  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const supabase = getAdminSupabase()
  await fetchDocument(supabase, user.id, documentId)

  const latestQuiz = await loadLatestQuiz(supabase, user.id, documentId, { type, topic, lang, resumeOnly })
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
    lang: rawLang = 'en',
  } = req.body || {}

  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'mcq'
  const count = getRequestedCount(type, rawCount)
  const source = rawMode === QUIZ_SOURCE.autoUpload ? QUIZ_SOURCE.autoUpload : QUIZ_SOURCE.manual
  const lang = rawLang === 'hi' ? 'hi' : 'en'

  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const supabase = getAdminSupabase()
  const { document, canPersistDocumentText } = await fetchDocument(supabase, user.id, documentId)

  if (document.mime_type !== 'application/pdf') {
    return fail(res, {
      status: 400,
      message: 'Quiz generation works with PDF documents right now. Please choose a PDF to continue.',
    })
  }

  if (source === QUIZ_SOURCE.autoUpload) {
    const existingAutoQuiz = await loadLatestQuiz(supabase, user.id, documentId, {
      source: QUIZ_SOURCE.autoUpload,
      type,
      lang,
    })
    if (existingAutoQuiz && existingAutoQuiz.source === QUIZ_SOURCE.autoUpload && existingAutoQuiz.status !== QUIZ_STATUS.failed) {
      return ok(res, buildQuizResponse(existingAutoQuiz))
    }
  }

  const documentText = await loadDocumentText({
    supabase,
    userId: user.id,
    document,
    canPersistDocumentText,
  })

  if (!documentText.trim()) {
    return fail(res, {
      status: 422,
      message: 'We could not read enough text from this PDF to generate a quiz yet. Please try another PDF.',
    })
  }

  const quizShell = await createQuizShell(supabase, {
    user_id: user.id,
    document_id: documentId,
    language: lang,
    topic: topic || getLanguageDefaults(lang).generalTopic,
    type,
    questions: [],
    answers: [],
    current_index: 0,
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

  let geminiError = null
  const geminiApiKey = process.env.QUIZ_GEMINI_API_KEY || process.env.GEMINI_API_KEY

  if (!geminiApiKey) {
    geminiError = createUnavailableError('Quiz generation is not available right now. Please try again a little later.')
  } else if (shouldSkipGeminiDueToRecentQuota()) {
    geminiError = createUnavailableError('Quiz generation is taking a short break right now. Please try again in about a minute.', 429, 60)
    geminiError.geminiIssueType = 'quota'
    console.warn('[Quiz] Skipping generation while AI service cooldown is active.')
  } else {
    try {
      const { questions, modelName } = await generateQuestionsWithGemini({
        document,
        count,
        topic,
        type,
        documentText,
        lang,
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
      geminiError = error
    }
  }

  try {
    await updateQuizRecord(supabase, quizShell.id, {
      status: QUIZ_STATUS.failed,
      error_message: geminiError?.message || 'We could not generate a quiz right now. Please try again.',
      generation_completed_at: new Date().toISOString(),
    })
  } catch (updateError) {
    console.error('[Quiz failure persistence error]', updateError)
  }

  return fail(res, geminiError)
}

async function handlePatch(req, res) {
  const user = await requireAuth(req)
  const supabase = getAdminSupabase()
  const { action, quizId, answers = [], currentIndex = 0, score } = req.body || {}

  if (!quizId) {
    return fail(res, { status: 400, message: 'We could not find that quiz. Please refresh and try again.' })
  }

  if (action === 'progress') {
    const safeCurrentIndex = Math.max(0, Number(currentIndex) || 0)
    const safeAnswers = sanitizeAnswers(answers)

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update({
        answers: safeAnswers,
        current_index: safeCurrentIndex,
      })
      .eq('id', quizId)
      .eq('user_id', user.id)
      .select('id, answers, current_index, attempted')
      .single()

    if (error || !quiz) {
      return fail(res, { status: 404, message: 'We could not save your quiz progress. Please try again.' })
    }

    return ok(res, { quiz })
  }

  if (action === 'score') {
    const numericScore = Number(score)

    if (!Number.isFinite(numericScore) || numericScore < 0) {
      return fail(res, { status: 400, message: 'That score does not look valid. Please try again.' })
    }

    const { data: existingQuiz, error: existingQuizError } = await supabase
      .from('quizzes')
      .select('id, document_id, attempted')
      .eq('id', quizId)
      .eq('user_id', user.id)
      .single()

    if (existingQuizError || !existingQuiz) {
      return fail(res, { status: 404, message: 'We could not find that quiz. Please refresh and try again.' })
    }

    const wasAlreadyAttempted = Boolean(existingQuiz.attempted)

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update({
        answers: sanitizeAnswers(answers),
        current_index: Math.max(0, Number(currentIndex) || 0),
        score: Math.round(numericScore),
        attempted: true,
      })
      .eq('id', quizId)
      .eq('user_id', user.id)
      .select('id, score, attempted, answers, current_index')
      .single()

    if (error || !quiz) {
      return fail(res, { status: 404, message: 'We could not find that quiz. Please refresh and try again.' })
    }

    if (!wasAlreadyAttempted && existingQuiz.document_id) {
      const { data: document, error: documentError } = await supabase
        .from('documents')
        .select('id, topics, pct_covered')
        .eq('id', existingQuiz.document_id)
        .eq('user_id', user.id)
        .single()

      if (!documentError && document) {
        const topicCount = Array.isArray(document.topics) ? document.topics.length : 0
        if (topicCount > 0) {
          const coveredCount = Math.round(topicCount * (Math.max(0, Math.min(100, Number(document.pct_covered) || 0)) / 100))
          const nextCoveredCount = Math.min(topicCount, coveredCount + 1)
          const nextPctCovered = Math.round((nextCoveredCount / topicCount) * 100)

          if (nextPctCovered !== Number(document.pct_covered || 0)) {
            await supabase
              .from('documents')
              .update({ pct_covered: nextPctCovered })
              .eq('id', document.id)
              .eq('user_id', user.id)
          }
        }
      }
    }

    return ok(res, { quiz })
  }

  return fail(res, { status: 400, message: 'That quiz action is not available here.' })
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

    if (req.method === 'PATCH') {
      return await handlePatch(req, res)
    }

    return fail(res, { status: 405, message: 'That action is not available here.' })
  } catch (error) {
    return fail(res, error)
  }
}
