// api/mocktest/get.js
// Fetches an existing mock test by ID for resuming
// Returns questions WITHOUT modelAnswer (server-side only)

import { fail, getAdminSupabase, ok, requireAuth, setCors } from '../../server/helpers.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user      = await requireAuth(req)
    const { id }    = req.query || {}
    if (!id) return fail(res, { status: 400, message: 'We could not find that mock test. Please refresh and try again.' })

    const supabase  = getAdminSupabase()

    const { data: mt, error } = await supabase
      .from('mock_tests')
      .select(`
        id, document_id, title, subject, duration_minutes, total_marks, questions, created_at,
        mock_test_submissions ( id, marks_obtained, percentage, submitted_at )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .single()

    if (error || !mt) return fail(res, { status: 404, message: 'We could not find that mock test. Please refresh and try again.' })

    const safeQuestions = (Array.isArray(mt.questions) ? mt.questions : []).map(q => ({
      id:             q.id,
      section:        q.section,
      type:           q.type,
      question:       q.question,
      marks:          q.marks,
      expectedLength: q.expectedLength || '',
      hint:           q.hint || '',
      topic:          q.topic,
    }))

    return ok(res, {
      mockTest: {
        id:              mt.id,
        documentId:      mt.document_id,
        title:           mt.title,
        subject:         mt.subject,
        durationMinutes: mt.duration_minutes,
        totalMarks:      mt.total_marks,
        questionCount:   safeQuestions.length,
        createdAt:       mt.created_at,
        isExisting:      true,
        hasSubmissions:  mt.mock_test_submissions?.length > 0,
      },
      questions:  safeQuestions,
      isExisting: true,
    })

  } catch (error) {
    return fail(res, error)
  }
}
