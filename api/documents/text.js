import {
  fail,
  getAdminSupabase,
  requireAuth,
  setCors,
} from '../_helpers.js'
import {
  extractPdfText,
  isMissingDocumentTextColumnError,
  isSupabaseNoRowsError,
} from '../_documentText.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    const documentId = req.query?.documentId

    if (!documentId) {
      return fail(res, { status: 400, message: 'Please choose a document first.' })
    }

    const supabase = getAdminSupabase()
    let canPersistDocumentText = true
    let query = supabase
      .from('documents')
      .select('id, title, mime_type, storage_path, document_text')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .maybeSingle()

    let { data: document, error } = await query

    if (error && isMissingDocumentTextColumnError(error)) {
      canPersistDocumentText = false
      ;({ data: document, error } = await supabase
        .from('documents')
        .select('id, title, mime_type, storage_path')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .maybeSingle())
    }

    if (error && !isSupabaseNoRowsError(error)) {
      throw error
    }

    if (!document) {
      return fail(res, { status: 404, message: 'We could not find that document. Please refresh and try again.' })
    }

    let documentText = document.document_text || ''

    if (!documentText.trim() && document.mime_type === 'application/pdf' && document.storage_path) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(document.storage_path)

      if (fileError) {
        throw fileError
      }

      const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
      const extractedPdf = await extractPdfText(pdfBuffer)
      documentText = extractedPdf.text || ''

      if (documentText && canPersistDocumentText) {
        await supabase
          .from('documents')
          .update({ document_text: documentText })
          .eq('id', document.id)
          .eq('user_id', user.id)
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        documentId: document.id,
        title: document.title,
        mimeType: document.mime_type,
        text: documentText,
        available: Boolean(documentText.trim()),
      },
    })
  } catch (error) {
    return fail(res, error)
  }
}
