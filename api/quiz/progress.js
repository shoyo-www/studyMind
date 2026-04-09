import {
  fail,
  getAdminSupabase,
  ok,
  requireAuth,
  setCors,
} from '../_helpers.js'

function sanitizeAnswers(answers) {
  if (!Array.isArray(answers)) return []
  return answers.map((answer) => {
    if (answer === null || answer === undefined) return null
    const numericAnswer = Number(answer)
    return Number.isInteger(numericAnswer) && numericAnswer >= 0 ? numericAnswer : null
  })
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    const { quizId, answers = [], currentIndex = 0 } = req.body || {}

    if (!quizId) {
      return fail(res, { status: 400, message: 'We could not find that quiz. Please refresh and try again.' })
    }

    const safeCurrentIndex = Math.max(0, Number(currentIndex) || 0)
    const safeAnswers = sanitizeAnswers(answers)
    const supabase = getAdminSupabase()

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update({
        answers: safeAnswers,
        current_index: safeCurrentIndex,
      })
      .eq('id', quizId)
      .eq('user_id', user.id)
      .eq('attempted', false)
      .select('id, answers, current_index, attempted')
      .single()

    if (error || !quiz) {
      return fail(res, { status: 404, message: 'We could not save your quiz progress. Please try again.' })
    }

    return ok(res, { quiz })
  } catch (error) {
    return fail(res, error)
  }
}
