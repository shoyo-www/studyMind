// api/mocktest/list.js
import { fail, getAdminSupabase, ok, requireAuth, setCors } from '../../server/helpers.js'
import { parseMockTestTitle } from '../../server/mockTestStage.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user     = await requireAuth(req)
    const supabase = getAdminSupabase()

    const { data, error } = await supabase
      .from('mock_tests')
      .select(`id, title, subject, document_id, duration_minutes, total_marks, questions, created_at,
        mock_test_submissions (id, marks_obtained, percentage, time_taken_secs, submitted_at)`)
      .eq('user_id', user.id).eq('status', 'ready')
      .order('created_at', { ascending: false }).limit(20)

    if (error) throw error

    return ok(res, {
      mockTests: (data || []).map((mt) => {
        const metadata = parseMockTestTitle(mt.title)

        return {
          id: mt.id,
          documentId: mt.document_id,
          title: mt.title,
          subject: mt.subject,
          durationMinutes: mt.duration_minutes,
          totalMarks: mt.total_marks,
          questionCount: Array.isArray(mt.questions) ? mt.questions.length : 0,
          createdAt: mt.created_at,
          lastSubmission: mt.mock_test_submissions?.[0] || null,
          attemptCount: mt.mock_test_submissions?.length || 0,
          focusTopic: metadata.focusTopic,
          stageDayNumber: metadata.stageDayNumber,
        }
      }),
    })
  } catch (error) {
    return fail(res, error)
  }
}
