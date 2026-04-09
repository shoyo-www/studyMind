import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  setCors,
} from '../server/helpers.js'

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
  const year  = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day   = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildSubjectReadiness(documents = []) {
  const subjectMap = new Map()
  for (const document of documents) {
    const label       = document?.subject || 'General'
    const topicWeight = Math.max(1, getTopicCount(document))
    const current     = subjectMap.get(label) || { label, totalWeight: 0, weightedScore: 0, documentCount: 0 }
    current.totalWeight   += topicWeight
    current.weightedScore += clampPercentage(document?.pct_covered) * topicWeight
    current.documentCount += 1
    subjectMap.set(label, current)
  }
  const subjects = [...subjectMap.values()]
    .map(s => ({ label: s.label, pct: s.totalWeight ? Math.round(s.weightedScore / s.totalWeight) : 0, documentCount: s.documentCount }))
    .sort((a, b) => b.pct - a.pct || a.label.localeCompare(b.label))
  const overallWeight = subjects.reduce((sum, s) => sum + s.documentCount, 0)
  const overallPct    = overallWeight ? Math.round(subjects.reduce((sum, s) => sum + s.pct * s.documentCount, 0) / overallWeight) : 0
  return { subjects, overallPct }
}

function buildActivity(documents = [], quizzes = [], messages = [], mockSubmissions = []) {
  const activityCounts = new Map()
  const addEvent = (createdAt) => {
    const key = getDateKey(createdAt)
    if (!key) return
    activityCounts.set(key, (activityCounts.get(key) || 0) + 1)
  }
  documents.forEach(d => addEvent(d.created_at))
  quizzes.forEach(q => addEvent(q.created_at))
  messages.forEach(m => addEvent(m.created_at))
  mockSubmissions.forEach(s => addEvent(s.submitted_at)) // ← mock tests count as activity

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const heat = []
  let maxCount = 0
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const date  = new Date(today)
    date.setUTCDate(today.getUTCDate() - i)
    const key   = getDateKey(date)
    const count = activityCounts.get(key) || 0
    maxCount    = Math.max(maxCount, count)
    heat.push({ key, count })
  }
  const cells = heat.map(({ count }) => {
    if (count === 0) return 0
    if (count === 1) return 1
    if (count <= 3 || maxCount <= 3) return 2
    return 3
  })
  const activeDays  = heat.filter(({ count }) => count > 0).length
  const activeKeys  = [...new Set([...activityCounts.keys()])].sort().reverse()
  let streakDays    = 0
  if (activeKeys.length) {
    let cursor = new Date(`${activeKeys[0]}T00:00:00.000Z`)
    while (activityCounts.get(getDateKey(cursor)) > 0) {
      streakDays++
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
    const current = quizTopicMap.get(quiz.topic) || { topic: quiz.topic, scoreTotal: 0, count: 0, documentId: quiz.document_id, detail: 'Based on quiz results' }
    current.scoreTotal += Number(quiz.score)
    current.count      += 1
    current.documentId  = current.documentId || quiz.document_id
    quizTopicMap.set(quiz.topic, current)
  }
  const quizWeakTopics = [...quizTopicMap.values()]
    .map(t => ({ id: `quiz-${t.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, topic: t.topic, score: Math.round(t.scoreTotal / t.count), detail: t.detail, documentId: t.documentId, source: 'quiz' }))
    .sort((a, b) => a.score - b.score)

  const uncoveredTopics = []
  for (const document of [...documents].sort((a, b) => clampPercentage(a?.pct_covered) - clampPercentage(b?.pct_covered))) {
    const topics      = Array.isArray(document?.topics) ? document.topics : []
    const coveredCount = Math.floor((clampPercentage(document?.pct_covered) / 100) * topics.length)
    for (let i = coveredCount; i < topics.length; i++) {
      uncoveredTopics.push({ id: `${document.id}-${i}`, topic: topics[i]?.title || `Topic ${i + 1}`, score: null, readinessPct: clampPercentage(document?.pct_covered), detail: `${document.subject || 'General'} • ${document.title || 'Untitled'}`, documentId: document.id, source: 'document' })
      if (uncoveredTopics.length >= 8) break
    }
    if (uncoveredTopics.length >= 8) break
  }

  const combined = []
  const seen     = new Set()
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
  const attempted = quizzes.filter(q => q.attempted && Number.isFinite(Number(q.score)))
  if (!attempted.length) return { score: 0, label: '' }
  const best     = attempted.reduce((b, c) => Number(c.score) > Number(b.score) ? c : b)
  const document = documentsById.get(best.document_id)
  return { score: Math.round(Number(best.score) || 0), label: best.topic && best.topic !== 'General' ? best.topic : document?.subject || document?.title || '' }
}

// ── Mock test stats builder ───────────────────────────────────────────
function buildMockTestStats(mockTests = [], mockSubmissions = []) {
  const totalTests   = mockTests.length
  const submitted    = mockSubmissions.filter(s => s.marks_obtained !== null)
  const inProgress   = mockTests.filter(mt => {
    const hasSub = mockSubmissions.some(s => s.mock_test_id === mt.id)
    return !hasSub
  })

  const avgScore = submitted.length
    ? Math.round(submitted.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) / submitted.length)
    : 0

  const bestSubmission = submitted.length
    ? submitted.reduce((best, s) => Number(s.percentage) > Number(best.percentage) ? s : best)
    : null

  const last7Days = submitted.filter(s => {
    const t = new Date(s.submitted_at)
    return !isNaN(t.getTime()) && Date.now() - t.getTime() <= 7 * 24 * 60 * 60 * 1000
  }).length

  return {
    totalTests,
    submittedCount:    submitted.length,
    inProgressCount:   inProgress.length,
    avgScore,
    bestScore:         bestSubmission ? Math.round(Number(bestSubmission.percentage)) : 0,
    bestGrade:         bestSubmission?.grade || '',
    testsLast7Days:    last7Days,
  }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`progress:${user.id}:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 })

    const supabase = getAdminSupabase()

    const [
      { data: documents,       error: docErr  },
      { data: quizzes,         error: quizErr },
      { data: messages,        error: msgErr  },
      { data: mockTests,       error: mtErr   },
      { data: mockSubmissions, error: msErr   },
    ] = await Promise.all([
      supabase.from('documents').select('id, title, subject, topics, pct_covered, created_at').eq('user_id', user.id),
      supabase.from('quizzes').select('id, document_id, topic, type, score, attempted, created_at, questions').eq('user_id', user.id),
      supabase.from('messages').select('created_at, document_id').eq('user_id', user.id),
      supabase.from('mock_tests').select('id, title, subject, total_marks, created_at').eq('user_id', user.id).eq('status', 'ready'),
      supabase.from('mock_test_submissions').select('id, mock_test_id, marks_obtained, percentage, grade, time_taken_secs, submitted_at').eq('user_id', user.id),
    ])

    if (docErr)  throw docErr
    if (quizErr) throw quizErr
    if (msgErr)  throw msgErr
    // mock test errors are non-fatal — table might not exist yet
    const safeDocs     = documents       || []
    const safeQuizzes  = quizzes         || []
    const safeMsgs     = messages        || []
    const safeMockTests = mockTests      || []
    const safeMockSubs  = mockSubmissions || []

    const documentsById      = new Map(safeDocs.map(d => [d.id, d]))
    const attemptedQuizzes   = safeQuizzes.filter(q => q.attempted && Number.isFinite(Number(q.score)))
    const quizzesLast7Days   = attemptedQuizzes.filter(q => {
      const t = new Date(q.created_at)
      return !isNaN(t.getTime()) && Date.now() - t.getTime() <= 7 * 24 * 60 * 60 * 1000
    }).length
    const flashcardSets  = safeQuizzes.filter(q => q.type === 'flashcard').length
    const flashcardsCount = safeQuizzes.filter(q => q.type === 'flashcard').reduce((sum, q) => sum + (Array.isArray(q.questions) ? q.questions.length : 0), 0)

    const readiness     = buildSubjectReadiness(safeDocs)
    const activity      = buildActivity(safeDocs, safeQuizzes, safeMsgs, safeMockSubs)
    const weakTopics    = buildWeakTopics(safeDocs, safeQuizzes)
    const bestQuiz      = getBestQuizMeta(safeQuizzes, documentsById)
    const mockTestStats = buildMockTestStats(safeMockTests, safeMockSubs)

    return ok(res, {
      stats: {
        streakDays:        activity.streakDays,
        activeDays:        activity.activeDays,
        quizzesDone:       attemptedQuizzes.length,
        quizzesLast7Days,
        bestScore:         bestQuiz.score,
        bestScoreLabel:    bestQuiz.label,
        flashcardsCount,
        flashcardSets,
        // ── Mock test stats ──
        mockTestsTaken:    mockTestStats.submittedCount,
        mockTestsTotal:    mockTestStats.totalTests,
        mockTestsInProgress: mockTestStats.inProgressCount,
        mockAvgScore:      mockTestStats.avgScore,
        mockBestScore:     mockTestStats.bestScore,
        mockBestGrade:     mockTestStats.bestGrade,
        mockTestsLast7Days: mockTestStats.testsLast7Days,
      },
      readiness,
      activity,
      weakTopics,
      mockTestStats,
    })
  } catch (error) {
    return fail(res, error)
  }
}
