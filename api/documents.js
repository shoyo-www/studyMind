import { requireAuth, getAdminSupabase, ok, fail, setCors } from './_helpers.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user     = await requireAuth(req)
    const supabase = getAdminSupabase()

    if (req.method === 'GET') {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, title, subject, total_pages, summary, topics, created_at, file_size, mime_type, pct_covered')
        .eq('user_id', user.id) 
        .order('created_at', { ascending: false })

      if (error) throw error
      return ok(res, { documents })
    }

    if (req.method === 'DELETE') {
      const { documentId } = req.body
      if (!documentId) return fail(res, { status: 400, message: 'documentId is required' })

      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('id, storage_path, user_id')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !doc) {
        return fail(res, { status: 404, message: 'Document not found or access denied' })
      }
      await supabase.storage.from('documents').remove([doc.storage_path])
      await supabase.from('messages').delete().eq('document_id', documentId)
      await supabase.from('quizzes').delete().eq('document_id', documentId)
      await supabase.from('documents').delete().eq('id', documentId)

      return ok(res, { deleted: true })
    }

    return fail(res, { status: 405, message: 'Method not allowed' })

  } catch (err) {
    return fail(res, err)
  }
}
