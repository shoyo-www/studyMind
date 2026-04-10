import { waitUntil } from '@vercel/functions'
import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  setCors,
} from '../../server/helpers.js'
import { createQueuedSubmissionAnalysis, markMockTestSubmissionInBackground, MOCK_TEST_SUBMISSION_STATUS } from '../../server/mocktestMarking.js'

function createUnavailableError(message, status = 503, retryAfterSeconds = null) {
  const error = new Error(message)
  error.status = status
  if (retryAfterSeconds) {
    error.retryAfterSeconds = retryAfterSeconds
  }
  return error
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`mocktest-sub:${user.id}:${getClientIp(req)}`, { limit: 10, windowMs: 60 * 60_000 })

    const { mockTestId, answers = [], timeTakenSecs = 0 } = req.body || {}
    if (!mockTestId) return fail(res, { status: 400, message: 'We could not find that mock test. Please refresh and try again.' })
    if (!answers.length) return fail(res, { status: 400, message: 'Please answer at least one question before submitting.' })

    if (!process.env.GEMINI_API_KEY) {
      return fail(res, createUnavailableError('Auto-marking is not available right now. Please try again a little later.'))
    }

    const supabase = getAdminSupabase()
    const { data: test, error: testErr } = await supabase
      .from('mock_tests')
      .select('id, questions, total_marks, user_id')
      .eq('id', mockTestId)
      .eq('user_id', user.id)
      .single()

    if (testErr || !test) {
      return fail(res, { status: 404, message: 'We could not find that mock test. Please refresh and try again.' })
    }

    const questionCount = Array.isArray(test.questions) ? test.questions.length : 0
    const queuedAnalysis = createQueuedSubmissionAnalysis(questionCount)

    const { data: submission, error: submissionError } = await supabase
      .from('mock_test_submissions')
      .insert({
        user_id: user.id,
        mock_test_id: mockTestId,
        answers,
        analysis: queuedAnalysis,
        total_marks: Number(test.total_marks || 0) || null,
        time_taken_secs: Number(timeTakenSecs) || 0,
        analysed_at: null,
      })
      .select('id, submitted_at')
      .single()

    if (submissionError || !submission) {
      throw submissionError || new Error('We could not save your submission right now.')
    }

    waitUntil(
      markMockTestSubmissionInBackground({
        submissionId: submission.id,
        userId: user.id,
      }).catch((error) => {
        console.error('[MockTest/submit] Background marking failed', error)
      }),
    )

    return ok(res, {
      submissionId: submission.id,
      status: MOCK_TEST_SUBMISSION_STATUS.queued,
      progressDone: 0,
      progressTotal: questionCount,
      submittedAt: submission.submitted_at,
    }, 202)
  } catch (error) {
    return fail(res, error)
  }
}
