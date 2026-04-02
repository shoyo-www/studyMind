import {
  fail,
  getAdminSupabase,
  ok,
  requireAuth,
  setCors,
} from '../_helpers.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'Method not allowed' })

  try {
    const user = await requireAuth(req)
    const { quizId, score } = req.body || {}
    const numericScore = Number(score)

    if (!quizId) {
      return fail(res, { status: 400, message: 'quizId is required' })
    }

    if (!Number.isFinite(numericScore) || numericScore < 0) {
      return fail(res, { status: 400, message: 'score must be a non-negative number' })
    }

    const supabase = getAdminSupabase()
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update({
        score: Math.round(numericScore),
        attempted: true,
      })
      .eq('id', quizId)
      .eq('user_id', user.id)
      .select('id, score, attempted')
      .single()

    if (error || !quiz) {
      return fail(res, { status: 404, message: 'Quiz not found or access denied' })
    }

    return ok(res, { quiz })
  } catch (error) {
    return fail(res, error)
  }
}
