import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  setCors,
} from '../_helpers.js'
import {
  extractPdfText,
  isMissingDocumentTextColumnError,
  isSupabaseNoRowsError,
} from '../_documentText.js'
import { buildRoadmapTopicsFromText } from '../_roadmapTopics.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'Method not allowed' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`roadmap:${user.id}:${getClientIp(req)}`, { limit: 20, windowMs: 60 * 60 * 1000 })

    const documentId = req.body?.documentId
    if (!documentId) {
      return fail(res, { status: 400, message: 'documentId is required' })
    }

    const supabase = getAdminSupabase()
    let canPersistDocumentText = true
    let { data: document, error } = await supabase
      .from('documents')
      .select('id, user_id, title, subject, mime_type, storage_path, total_pages, summary, topics, document_text, created_at, file_size, pct_covered')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error && isMissingDocumentTextColumnError(error)) {
      canPersistDocumentText = false
      ;({ data: document, error } = await supabase
        .from('documents')
        .select('id, user_id, title, subject, mime_type, storage_path, total_pages, summary, topics, created_at, file_size, pct_covered')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .maybeSingle())
    }

    if (error && !isSupabaseNoRowsError(error)) {
      throw error
    }

    if (!document) {
      return fail(res, { status: 404, message: 'Document not found or access denied' })
    }

    if (document.mime_type !== 'application/pdf') {
      return fail(res, { status: 400, message: 'Roadmaps are currently available for PDF documents only.' })
    }

    let documentText = document.document_text || ''
    let totalPages = Number(document.total_pages) || 0

    if (!documentText.trim()) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(document.storage_path)

      if (fileError) throw fileError

      const extractedPdf = await extractPdfText(Buffer.from(await fileData.arrayBuffer()))
      documentText = extractedPdf.text || ''
      totalPages = extractedPdf.totalPages || totalPages
    }

    const topics = buildRoadmapTopicsFromText(documentText)

    if (!topics.length) {
      return fail(res, { status: 422, message: 'We could not prepare a roadmap for this document yet. Please try another PDF.' })
    }

    const updatePayload = {
      topics,
      total_pages: totalPages,
    }

    if (canPersistDocumentText && documentText.trim()) {
      updatePayload.document_text = documentText
    }

    let updateQuery = supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', document.id)
      .eq('user_id', user.id)
      .select('id, title, subject, total_pages, summary, topics, created_at, file_size, mime_type, pct_covered')
      .single()

    let { data: updatedDocument, error: updateError } = await updateQuery

    if (updateError && isMissingDocumentTextColumnError(updateError)) {
      const { document_text, ...legacyPayload } = updatePayload
      ;({ data: updatedDocument, error: updateError } = await supabase
        .from('documents')
        .update(legacyPayload)
        .eq('id', document.id)
        .eq('user_id', user.id)
        .select('id, title, subject, total_pages, summary, topics, created_at, file_size, mime_type, pct_covered')
        .single())
    }

    if (updateError) throw updateError

    return ok(res, {
      document: updatedDocument,
      topics,
      roadmapReady: true,
    })
  } catch (error) {
    return fail(res, error)
  }
}
