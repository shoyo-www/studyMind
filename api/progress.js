import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  setCors,
} from './_helpers.js'

const ACTIVITY_DAYS = 28

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

function getTopicCount(document) {
  return Array.isArray(document?.topics) ? document.topics.length : 0
}

function getDateKey(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildSubjectReadiness(documents = []) {
  const subjectMap = new Map()

  for (const document of documents) {
    const label = document?.subject || 'General'
    const topicWeight = Math.max(1, getTopicCount(document))
    const current = subjectMap.get(label) || {
      label,
      totalWeight: 0,
      weightedScore: 0,
      documentCount: 0,
    }

    current.totalWeight += topicWeight
    current.weightedScore += clampPercentage(document?.pct_covered) * topicWeight
    current.documentCount += 1
    subjectMap.set(label, current)
  }

  const subjects = [...subjectMap.values()]
    .map((subject) => ({
      label: subject.label,
      pct: subject.totalWeight
        ? Math.round(subject.weightedScore / subject.totalWeight)
        : 0,
      documentCount: subject.documentCount,
    }))
    .sort((left, right) => right.pct - left.pct || left.label.localeCompare(right.label))

  const overallWeight = subjects.reduce((sum, subject) => sum + subject.documentCount, 0)
  const overallPct = overallWeight
    ? Math.round(subjects.reduce((sum, subject) => sum + (subject.pct * subject.documentCount), 0) / overallWeight)
    : 0

  return { subjects, overallPct }
}

function buildActivity(documents = [], quizzes = [], messages = []) {
  const activityCounts = new Map()

  const addEvent = (createdAt) => {
    const key = getDateKey(createdAt)
    if (!key) return
    activityCounts.set(key, (activityCounts.get(key) || 0) + 1)
  }

  documents.forEach((document) => addEvent(document.created_at))
  quizzes.forEach((quiz) => addEvent(quiz.created_at))
  messages.forEach((message) => addEvent(message.created_at))

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const heat = []
  let maxCount = 0

  for (let index = ACTIVITY_DAYS - 1; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - index)
    const key = getDateKey(date)
    const count = activityCounts.get(key) || 0
    maxCount = Math.max(maxCount, count)
    heat.push({ key, count })
  }

  const cells = heat.map(({ count }) => {
    if (count === 0) return 0
    if (count === 1) return 1
    if (count <= 3 || maxCount <= 3) return 2
    return 3
  })

  const activeDays = heat.filter(({ count }) => count > 0).length

  const activeKeys = [...new Set([...activityCounts.keys()])].sort().reverse()
  let streakDays = 0

  if (activeKeys.length) {
    let cursor = new Date(`${activeKeys[0]}T00:00:00.000Z`)

    while (activityCounts.get(getDateKey(cursor)) > 0) {
      streakDays += 1
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    }
  }

  return { cells, streakDays, activeDays }
}

function buildWeakTopics(documents = [], quizzes = []) {
  const quizTopicMap = new Map()

  for (const quiz of quizzes) {
    if (!quiz?.attempted || !Number.isFinite(Number(quiz?.score))) continue
    if (!quiz?.topic || quiz.topic === 'General') continue

    const current = quizTopicMap.get(quiz.topic) || {
      topic: quiz.topic,
      scoreTotal: 0,
      count: 0,
      documentId: quiz.document_id,
      detail: 'Based on quiz results',
    }

    current.scoreTotal += Number(quiz.score)
    current.count += 1
    current.documentId = current.documentId || quiz.document_id
    quizTopicMap.set(quiz.topic, current)
  }

  const quizWeakTopics = [...quizTopicMap.values()]
    .map((topic) => ({
      id: `quiz-${topic.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      topic: topic.topic,
      score: Math.round(topic.scoreTotal / topic.count),
      detail: topic.detail,
      documentId: topic.documentId,
      source: 'quiz',
    }))
    .sort((left, right) => left.score - right.score)

  const uncoveredTopics = []

  for (const document of [...documents].sort((left, right) => clampPercentage(left?.pct_covered) - clampPercentage(right?.pct_covered))) {
    const topics = Array.isArray(document?.topics) ? document.topics : []
    const coveredCount = Math.floor((clampPercentage(document?.pct_covered) / 100) * topics.length)

    for (let index = coveredCount; index < topics.length; index += 1) {
      const topic = topics[index]
      uncoveredTopics.push({
        id: `${document.id}-${index}`,
        topic: topic?.title || `Topic ${index + 1}`,
        score: null,
        readinessPct: clampPercentage(document?.pct_covered),
        detail: `${document.subject || 'General'} • ${document.title || 'Untitled document'}`,
        documentId: document.id,
        source: 'document',
      })

      if (uncoveredTopics.length >= 8) break
    }

    if (uncoveredTopics.length >= 8) break
  }

  const combined = []
  const seen = new Set()

  for (const topic of [...quizWeakTopics, ...uncoveredTopics]) {
    const key = `${topic.topic.toLowerCase()}::${topic.documentId || 'none'}`
    if (seen.has(key)) continue
    seen.add(key)
    combined.push(topic)
    if (combined.length >= 6) break
  }

  return combined
}

function getBestQuizMeta(quizzes = [], documentsById = new Map()) {
  const attempted = quizzes.filter((quiz) => quiz.attempted && Number.isFinite(Number(quiz.score)))
  if (!attempted.length) {
    return { score: 0, label: '' }
  }

  const bestQuiz = attempted.reduce((best, current) => (
    Number(current.score) > Number(best.score) ? current : best
  ))
  const document = documentsById.get(bestQuiz.document_id)

  return {
    score: Math.round(Number(bestQuiz.score) || 0),
    label: bestQuiz.topic && bestQuiz.topic !== 'General'
      ? bestQuiz.topic
      : document?.subject || document?.title || '',
  }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return fail(res, { status: 405, message: 'Method not allowed' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`progress:${user.id}:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 })

    const supabase = getAdminSupabase()
    const [
      { data: documents, error: documentsError },
      { data: quizzes, error: quizzesError },
      { data: messages, error: messagesError },
    ] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, subject, topics, pct_covered, created_at')
        .eq('user_id', user.id),
      supabase
        .from('quizzes')
        .select('id, document_id, topic, type, score, attempted, created_at, questions')
        .eq('user_id', user.id),
      supabase
        .from('messages')
        .select('created_at, document_id')
        .eq('user_id', user.id),
    ])

    if (documentsError) throw documentsError
    if (quizzesError) throw quizzesError
    if (messagesError) throw messagesError

    const safeDocuments = documents || []
    const safeQuizzes = quizzes || []
    const safeMessages = messages || []
    const documentsById = new Map(safeDocuments.map((document) => [document.id, document]))
    const attemptedQuizzes = safeQuizzes.filter((quiz) => quiz.attempted && Number.isFinite(Number(quiz.score)))
    const quizzesLast7Days = attemptedQuizzes.filter((quiz) => {
      const createdAt = new Date(quiz.created_at)
      return !Number.isNaN(createdAt.getTime()) && Date.now() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000
    }).length
    const flashcardSets = safeQuizzes.filter((quiz) => quiz.type === 'flashcard').length
    const flashcardsCount = safeQuizzes
      .filter((quiz) => quiz.type === 'flashcard')
      .reduce((sum, quiz) => sum + (Array.isArray(quiz.questions) ? quiz.questions.length : 0), 0)

    const readiness = buildSubjectReadiness(safeDocuments)
    const activity = buildActivity(safeDocuments, safeQuizzes, safeMessages)
    const weakTopics = buildWeakTopics(safeDocuments, safeQuizzes)
    const bestQuiz = getBestQuizMeta(safeQuizzes, documentsById)

    return ok(res, {
      stats: {
        streakDays: activity.streakDays,
        activeDays: activity.activeDays,
        quizzesDone: attemptedQuizzes.length,
        quizzesLast7Days,
        bestScore: bestQuiz.score,
        bestScoreLabel: bestQuiz.label,
        flashcardsCount,
        flashcardSets,
      },
      readiness,
      activity,
      weakTopics,
    })
  } catch (error) {
    return fail(res, error)
  }
}
