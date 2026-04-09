import {
  ensureProfile,
  fail,
  getAdminSupabase,
  ok,
  requireAuth,
  setCors,
} from '../server/helpers.js'

function getTopicCount(document) {
  return Array.isArray(document?.topics) ? document.topics.length : 0
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = await requireAuth(req)
    const supabase = getAdminSupabase()

    if (req.method === 'PATCH') {
      await ensureProfile(supabase, user)
      const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : ''

      if (!fullName) {
        return fail(res, { status: 400, message: 'Please enter your full name.' })
      }

      if (fullName.length > 80) {
        return fail(res, { status: 400, message: 'Please keep your name under 80 characters.' })
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)
        .select('id, email, full_name, avatar_url, plan, uploads_this_month, messages_today, messages_reset_at')
        .single()

      if (updateError) throw updateError

      return ok(res, { profile: updatedProfile })
    }

    if (req.method !== 'GET') return fail(res, { status: 405, message: 'That action is not available here.' })

    const profile = await ensureProfile(supabase, user)

    const [{ data: documents, error: documentsError }, { data: quizzes, error: quizzesError }] = await Promise.all([
      supabase
        .from('documents')
        .select('id, subject, topics, pct_covered')
        .eq('user_id', user.id),
      supabase
        .from('quizzes')
        .select('score, attempted')
        .eq('user_id', user.id),
    ])

    if (documentsError) throw documentsError
    if (quizzesError) throw quizzesError

    const safeDocuments = documents || []
    const safeQuizzes = quizzes || []
    const attemptedQuizzes = safeQuizzes.filter((quiz) => quiz.attempted && Number.isFinite(quiz.score))
    const averageQuizScore = attemptedQuizzes.length
      ? Math.round(attemptedQuizzes.reduce((sum, quiz) => sum + Number(quiz.score || 0), 0) / attemptedQuizzes.length)
      : 0
    const bestQuizScore = attemptedQuizzes.length
      ? Math.max(...attemptedQuizzes.map((quiz) => Number(quiz.score || 0)))
      : 0
    const documentCount = safeDocuments.length
    const totalTopics = safeDocuments.reduce((sum, document) => sum + getTopicCount(document), 0)
    const readinessPct = documentCount
      ? Math.round(safeDocuments.reduce((sum, document) => sum + Number(document.pct_covered || 0), 0) / documentCount)
      : 0
    const subjects = [...new Set(safeDocuments.map((document) => document.subject).filter(Boolean))]

    return ok(res, {
      profile,
      stats: {
        documentCount,
        totalTopics,
        averageQuizScore,
        readinessPct,
        bestQuizScore,
        attemptedQuizCount: attemptedQuizzes.length,
        subjects,
      },
    })
  } catch (error) {
    return fail(res, error)
  }
}
