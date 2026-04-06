// api/chat.js

import {
  checkRateLimit,
  ensureProfile,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  sanitizeFileName,
  setCors,
} from './_helpers.js'
import {
  getGeminiClient,
  getGeminiModelName,
  makeGeminiFilePart,
  runGeminiTask,
  shouldSkipGeminiDueToRecentQuota,
  uploadPdfToGemini,
} from './_gemini.js'

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

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return fail(res, { status: 405, message: 'Method not allowed' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`chat:${user.id}:${getClientIp(req)}`, { limit: 50, windowMs: 60_000 })

    const { documentId, message, history = [] } = req.body || {}
    if (!documentId)           return fail(res, { status: 400, message: 'documentId is required' })
    if (!message?.trim())      return fail(res, { status: 400, message: 'message is required' })
    if (message.length > 2000) return fail(res, { status: 400, message: 'Message too long (max 2000 chars)' })

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
        message: `Daily message limit reached (${dailyLimit}/day). ${profile?.plan === 'pro' ? 'Limit resets at midnight.' : 'Upgrade to Pro for 200 messages/day.'}`,
      })
    }

    // ── Fetch document ───────────────────────────────────────────
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, title, storage_path, user_id, mime_type')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docErr || !doc) return fail(res, { status: 404, message: 'Document not found or access denied' })
    if (doc.mime_type !== 'application/pdf') return fail(res, { status: 400, message: 'AI chat supports PDF documents only.' })

    let reply = ''
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      throw createUnavailableError('AI is temporarily unavailable. Please try again later.')
    }

    if (shouldSkipGeminiDueToRecentQuota()) {
      throw createUnavailableError('AI is temporarily unavailable. Please try again in about a minute.', 429, 60)
    }

    const { data: fileData, error: fileErr } = await supabase.storage
      .from('documents').download(doc.storage_path)
    if (fileErr) throw fileErr

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    const ai = getGeminiClient(geminiApiKey)
    const geminiFile = await uploadPdfToGemini(ai, {
      buffer: pdfBuffer,
      displayName: sanitizeFileName(doc.title || 'notes.pdf'),
    })

    const recentHistory = Array.isArray(history)
      ? history.slice(-10)
          .map(e => ({ role: e?.role === 'user' ? 'user' : 'assistant', text: `${e?.text || ''}`.trim().slice(0, 2000) }))
          .filter(e => e.text)
      : []
    const historyText = recentHistory.length
      ? recentHistory.map(e => `${e.role === 'user' ? 'Student' : 'Assistant'}: ${e.text}`).join('\n')
      : 'No previous conversation.'

    const result = await runGeminiTask(() => ai.models.generateContent({
      model: getGeminiModelName(),
      contents: [
        { text: [`Conversation so far:\n${historyText}`, `Student: ${message.trim()}`].join('\n\n') },
        makeGeminiFilePart(geminiFile),
      ],
      config: {
        systemInstruction: [
          'You are StudyMind, an AI study assistant.',
          `The student uploaded a document titled "${doc.title}".`,
          'Answer ONLY from the content in the provided PDF.',
          'If the answer is not in the PDF, say exactly: "I could not find that in your document."',
          'Be concise, clear, and student-friendly.',
        ].join(' '),
      },
    }), {
      label: 'Document chat',
      userMessage: 'AI is temporarily busy. Please try again in about a minute.',
      quotaUserMessage: 'AI is temporarily unavailable. Please try again later.',
    })

    reply = `${result.text || ''}`.trim() || 'I could not find that in your document.'

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
    return fail(res, error)
  }
}
