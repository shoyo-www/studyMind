// api/chat.js

import {
  checkRateLimit,
  ensureProfile,
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
import { groqChatWithText, isGroqConfigured } from '../server/groq.js'

function getNextMidnightIso() {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.toISOString()
}

function createUnavailableError(message, status = 503, retryAfterSeconds = null) {
  const error = new Error(message)
  error.status = status
  if (retryAfterSeconds) {
    error.retryAfterSeconds = retryAfterSeconds
  }
  return error
}

async function loadChatDocument({ supabase, userId, documentId }) {
  let canPersistDocumentText = true
  let { data: doc, error } = await supabase
    .from('documents')
    .select('id, title, storage_path, user_id, mime_type, document_text')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && isMissingDocumentTextColumnError(error)) {
    canPersistDocumentText = false
    ;({ data: doc, error } = await supabase
      .from('documents')
      .select('id, title, storage_path, user_id, mime_type')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle())
  }

  if (error && !isSupabaseNoRowsError(error)) {
    throw error
  }

  return { doc, canPersistDocumentText }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`chat:${user.id}:${getClientIp(req)}`, { limit: 50, windowMs: 60_000 })

    const { documentId, message, history = [] } = req.body || {}
    if (!documentId)           return fail(res, { status: 400, message: 'Please choose a document before starting the chat.' })
    if (!message?.trim())      return fail(res, { status: 400, message: 'Please type a message first.' })
    if (message.length > 2000) return fail(res, { status: 400, message: 'That message is a bit too long. Please keep it under 2000 characters.' })

    const supabase = getAdminSupabase()
    const profile  = await ensureProfile(supabase, user)

    // ── Daily limit ──────────────────────────────────────────────
    let messagesToday  = profile?.messages_today || 0
    const dailyLimit   = profile?.plan === 'pro' ? 200 : 20
    const resetAt      = profile?.messages_reset_at ? new Date(profile.messages_reset_at) : null
    const now          = new Date()
    let nextResetAtIso = profile?.messages_reset_at || getNextMidnightIso()

    if (!resetAt || now >= resetAt) {
      messagesToday = 0; nextResetAtIso = getNextMidnightIso()
      await supabase.from('profiles')
        .update({ messages_today: 0, messages_reset_at: nextResetAtIso })
        .eq('id', user.id)
    }
    if (messagesToday >= dailyLimit) {
      return fail(res, {
        status: 429,
        message: `You've reached your daily chat limit (${dailyLimit} messages today). ${profile?.plan === 'pro' ? 'It resets at midnight.' : 'Upgrade to Pro to unlock 200 messages per day.'}`,
      })
    }

    // ── Fetch document ───────────────────────────────────────────
    const { doc, canPersistDocumentText } = await loadChatDocument({
      supabase,
      userId: user.id,
      documentId,
    })

    if (!doc) return fail(res, { status: 404, message: 'We could not find that document. Please refresh and try again.' })
    if (doc.mime_type !== 'application/pdf') return fail(res, { status: 400, message: 'Chat works with PDF documents right now. Please choose a PDF to continue.' })

    if (!isGroqConfigured()) {
      throw createUnavailableError('Chat is not available right now. Please try again a little later.')
    }

    let documentText = doc.document_text || ''
    if (!documentText.trim()) {
      const { data: fileData, error: fileErr } = await supabase.storage
        .from('documents')
        .download(doc.storage_path)

      if (fileErr) throw fileErr

      const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
      const extractedPdf = await extractPdfText(pdfBuffer)
      documentText = extractedPdf.text || ''

      if (documentText.trim() && canPersistDocumentText) {
        await supabase
          .from('documents')
          .update({ document_text: documentText })
          .eq('id', doc.id)
          .eq('user_id', user.id)
          .then(() => {})
          .catch((persistError) => {
            console.warn('[chat] Could not store extracted document text:', persistError?.message)
          })
      }
    }

    if (!documentText.trim()) {
      return fail(res, {
        status: 422,
        message: 'We could not read enough text from this PDF yet. Please try uploading a clearer PDF and ask again.',
      })
    }

    const recentHistory = Array.isArray(history)
      ? history.slice(-10)
          .map(e => ({ role: e?.role === 'user' ? 'user' : 'assistant', text: `${e?.text || ''}`.trim().slice(0, 2000) }))
          .filter(e => e.text)
      : []
    const reply = await groqChatWithText({
      documentTitle: doc.title || 'notes.pdf',
      documentText,
      message,
      history: recentHistory,
    })

    // ── Save + update counter ────────────────────────────────────
    await supabase.from('messages').insert([
      { user_id: user.id, document_id: documentId, role: 'user',      content: message.trim() },
      { user_id: user.id, document_id: documentId, role: 'assistant', content: reply },
    ])
    await supabase.from('profiles')
      .update({ messages_today: messagesToday + 1, messages_reset_at: nextResetAtIso })
      .eq('id', user.id)

    return ok(res, {
      reply,
      messagesUsed:  messagesToday + 1,
      messagesLimit: dailyLimit,
    })

  } catch (error) {
    if (error?.status === 429 && error?.groqModel) {
      return fail(res, {
        status: 429,
        retryAfterSeconds: error.retryAfterSeconds || 10,
        message: error.message || 'Chat is a little busy right now. Please wait a few seconds and try again.',
      })
    }
    return fail(res, error)
  }
}
