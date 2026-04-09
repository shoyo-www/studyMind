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
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    const { quizId, score, answers = [], currentIndex = 0 } = req.body || {}
    const numericScore = Number(score)

    if (!quizId) {
      return fail(res, { status: 400, message: 'We could not find that quiz. Please refresh and try again.' })
    }

    if (!Number.isFinite(numericScore) || numericScore < 0) {
      return fail(res, { status: 400, message: 'That score does not look valid. Please try again.' })
    }

    const supabase = getAdminSupabase()
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
        answers: Array.isArray(answers) ? answers : [],
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
  } catch (error) {
    return fail(res, error)
  }
}
