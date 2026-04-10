import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  setCors,
} from '../server/helpers.js'
import {
  extractPdfText,
  isMissingDocumentTextColumnError,
  isSupabaseNoRowsError,
} from '../server/documentText.js'
import { buildRoadmapTopicsFromText } from '../server/roadmapTopics.js'

async function loadDocumentWithFallback({
  supabase,
  documentId,
  userId,
  selectWithText,
  selectWithoutText,
}) {
  let canPersistDocumentText = true
  let { data: document, error } = await supabase
    .from('documents')
    .select(selectWithText)
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && isMissingDocumentTextColumnError(error)) {
    canPersistDocumentText = false
    ;({ data: document, error } = await supabase
      .from('documents')
      .select(selectWithoutText)
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle())
  }

  if (error && !isSupabaseNoRowsError(error)) {
    throw error
  }

  return { document, canPersistDocumentText }
}

async function handleDocumentTextRequest(req, res, { supabase, user }) {
  const documentId = req.query?.documentId

  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const { document, canPersistDocumentText } = await loadDocumentWithFallback({
    supabase,
    documentId,
    userId: user.id,
    selectWithText: 'id, title, mime_type, storage_path, document_text',
    selectWithoutText: 'id, title, mime_type, storage_path',
  })

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

  return ok(res, {
    documentId: document.id,
    title: document.title,
    mimeType: document.mime_type,
    text: documentText,
    available: Boolean(documentText.trim()),
  })
}

async function handleRoadmapGeneration(req, res, { supabase, user }) {
  checkRateLimit(`roadmap:${user.id}:${getClientIp(req)}`, { limit: 20, windowMs: 60 * 60 * 1000 })

  const documentId = req.body?.documentId
  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const { document, canPersistDocumentText } = await loadDocumentWithFallback({
    supabase,
    documentId,
    userId: user.id,
    selectWithText: 'id, user_id, title, subject, mime_type, storage_path, total_pages, summary, topics, document_text, created_at, file_size, pct_covered',
    selectWithoutText: 'id, user_id, title, subject, mime_type, storage_path, total_pages, summary, topics, created_at, file_size, pct_covered',
  })

  if (!document) {
    return fail(res, { status: 404, message: 'We could not find that document. Please refresh and try again.' })
  }

  if (document.mime_type !== 'application/pdf') {
    return fail(res, { status: 400, message: 'Roadmaps work with PDF documents right now. Please choose a PDF to continue.' })
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
    return fail(res, { status: 422, message: 'We could not build a roadmap from this document yet. Please try another PDF.' })
  }

  const updatePayload = {
    topics,
    total_pages: totalPages,
  }

  if (canPersistDocumentText && documentText.trim()) {
    updatePayload.document_text = documentText
  }

  let { data: updatedDocument, error: updateError } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', document.id)
    .eq('user_id', user.id)
    .select('id, title, subject, total_pages, summary, topics, created_at, file_size, mime_type, pct_covered')
    .single()

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
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = await requireAuth(req)
    const supabase = getAdminSupabase()

    if (req.method === 'GET') {
      if (req.query?.mode === 'text') {
        return handleDocumentTextRequest(req, res, { supabase, user })
      }

      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, title, subject, total_pages, summary, topics, created_at, file_size, mime_type, pct_covered')
        .eq('user_id', user.id) 
        .order('created_at', { ascending: false })

      if (error) throw error
      return ok(res, { documents })
    }

    if (req.method === 'POST') {
      if (req.body?.action === 'analyze') {
        return handleRoadmapGeneration(req, res, { supabase, user })
      }

      return fail(res, { status: 405, message: 'That action is not available here.' })
    }

    if (req.method === 'DELETE') {
      const { documentId } = req.body
      if (!documentId) return fail(res, { status: 400, message: 'Please choose a document first.' })

      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('id, storage_path, user_id')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !doc) {
        return fail(res, { status: 404, message: 'We could not find that document. Please refresh and try again.' })
      }
      await supabase.storage.from('documents').remove([doc.storage_path])
      await supabase.from('messages').delete().eq('document_id', documentId)
      await supabase.from('quizzes').delete().eq('document_id', documentId)
      await supabase.from('documents').delete().eq('id', documentId)

      return ok(res, { deleted: true })
    }

    return fail(res, { status: 405, message: 'That action is not available here.' })

  } catch (err) {
    return fail(res, err)
  }
}
