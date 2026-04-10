import { fail, ok, requireAuth, setCors } from '../../server/helpers.js'
import { getMockTestSubmissionSnapshot } from '../../server/mocktestMarking.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    const { id } = req.query || {}

    if (!id) {
      return fail(res, { status: 400, message: 'We could not find that submission. Please refresh and try again.' })
    }

    const snapshot = await getMockTestSubmissionSnapshot({
      submissionId: id,
      userId: user.id,
    })

    return ok(res, snapshot)
  } catch (error) {
    return fail(res, error)
  }
}
