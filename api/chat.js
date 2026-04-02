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
  uploadPdfToGemini,
} from './_gemini.js'

function getNextMidnightIso() {
  const nextMidnight = new Date()
  nextMidnight.setHours(24, 0, 0, 0)
  return nextMidnight.toISOString()
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'Method not allowed' })

  try {
    const user = await requireAuth(req)
    const rateLimitKey = `chat:${user.id}:${getClientIp(req)}`
    checkRateLimit(rateLimitKey, { limit: 50, windowMs: 60_000 })

    const { documentId, message, history = [] } = req.body || {}

    if (!documentId) {
      return fail(res, { status: 400, message: 'documentId is required' })
    }

    if (!message?.trim()) {
      return fail(res, { status: 400, message: 'message is required' })
    }

    if (message.length > 2000) {
      return fail(res, { status: 400, message: 'Message too long (max 2000 chars)' })
    }

    const supabase = getAdminSupabase()
    const profile = await ensureProfile(supabase, user)

    let messagesToday = profile?.messages_today || 0
    const dailyLimit = profile?.plan === 'pro' ? 200 : 20
    const resetAt = profile?.messages_reset_at ? new Date(profile.messages_reset_at) : null
    const now = new Date()
    let nextResetAtIso = profile?.messages_reset_at || getNextMidnightIso()

    if (!resetAt || now >= resetAt) {
      messagesToday = 0
      nextResetAtIso = getNextMidnightIso()
      await supabase
        .from('profiles')
        .update({
          messages_today: 0,
          messages_reset_at: nextResetAtIso,
        })
        .eq('id', user.id)
    }

    if (messagesToday >= dailyLimit) {
      return fail(res, {
        status: 429,
        message: `Daily message limit reached (${dailyLimit}/day). ${profile?.plan === 'pro' ? 'Limit resets at midnight.' : 'Upgrade to Pro for 200 messages/day.'}`,
      })
    }

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('id, title, storage_path, user_id, mime_type')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (documentError || !document) {
      return fail(res, { status: 404, message: 'Document not found or access denied' })
    }

    if (document.mime_type !== 'application/pdf') {
      return fail(res, {
        status: 400,
        message: 'AI chat currently supports PDF documents only.',
      })
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (fileError) throw fileError

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    const ai = getGeminiClient()
    const geminiFile = await uploadPdfToGemini(ai, {
      buffer: pdfBuffer,
      displayName: sanitizeFileName(document.title || 'study-notes.pdf'),
    })

    const recentHistory = Array.isArray(history)
      ? history.slice(-10).map((entry) => ({
          role: entry?.role === 'user' ? 'user' : 'assistant',
          text: `${entry?.text || ''}`.trim().slice(0, 2000),
        })).filter((entry) => entry.text)
      : []

    const historyText = recentHistory.length
      ? recentHistory
          .map((entry) => `${entry.role === 'user' ? 'Student' : 'Assistant'}: ${entry.text}`)
          .join('\n')
      : 'No previous conversation.'

    const result = await runGeminiTask(() => ai.models.generateContent({
      model: getGeminiModelName(),
      contents: [
        {
          text: [
            `Conversation so far:\n${historyText}`,
            `Student: ${message.trim()}`,
          ].join('\n\n'),
        },
        makeGeminiFilePart(geminiFile),
      ],
      config: {
        systemInstruction: [
          'You are StudyMind, an AI study assistant.',
          `The user uploaded a document titled "${document.title}".`,
          'Answer only from the content in the provided PDF.',
          'If the answer is not in the PDF, say "I could not find that in your document."',
          'Keep answers concise, clear, and student-friendly.',
          'Do not invent facts or cite sources outside the uploaded PDF.',
        ].join(' '),
      },
    }), {
      label: 'Gemini chat generation',
      userMessage: 'AI chat is temporarily busy due to high demand. Please try again in about a minute.',
    })

    const reply = `${result.text || ''}`.trim() || 'I could not find that in your document.'

    await supabase.from('messages').insert([
      { user_id: user.id, document_id: documentId, role: 'user', content: message.trim() },
      { user_id: user.id, document_id: documentId, role: 'assistant', content: reply },
    ])

    await supabase
      .from('profiles')
      .update({ messages_today: messagesToday + 1, messages_reset_at: nextResetAtIso })
      .eq('id', user.id)

    return ok(res, {
      reply,
      messagesUsed: messagesToday + 1,
      messagesLimit: dailyLimit,
    })
  } catch (error) {
    return fail(res, error)
  }
}
