// api/chat.js
// Primary: Gemini (native PDF reading)
// Fallback: Groq (text-based, fires on ANY Gemini failure including billing errors)
//
// If GEMINI_API_KEY is not set at all → skip straight to Groq
// If Gemini returns ANY error (403 billing, 429 quota, 500 server) → fall back to Groq

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
import { groqChatWithText, isGroqConfigured } from './_groq.js'
import { extractPdfText, isMissingDocumentTextColumnError } from './_documentText.js'

function getNextMidnightIso() {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.toISOString()
}

// Any Gemini error that isn't a user validation error → try Groq
// This catches: 403 billing, 429 quota, 500/503 server, auth errors, all
function shouldFallbackToGroq(err) {
  const status  = err?.status || 0
  const message = `${err?.message || ''}`.toLowerCase()

  // Don't fall back for user input errors
  if (status === 400) return false
  if (status === 401 && message.includes('invalid api key')) return false

  // Fall back for everything else: billing (403), quota (429), server (500/503),
  // auth/billing errors, network errors, unknown errors
  return true
}

// ── Robust document text fetcher ────────────────────────────────────
// Tries 3 paths in order:
//   1. Stored document_text column (instant)
//   2. Extract from PDF in storage (slower but always works)
//   3. Returns empty string (Groq will still try its best)
async function getDocumentText(supabase, document) {
  // Path 1: Stored text column
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('document_text')
      .eq('id', document.id)
      .single()

    if (!error && data?.document_text?.trim()) {
      console.log(`[getDocumentText] Using stored text for doc ${document.id} (${data.document_text.length} chars)`)
      return data.document_text
    }
  } catch (e) {
    // Column may not exist yet — continue to extraction
    if (!isMissingDocumentTextColumnError(e)) {
      console.warn('[getDocumentText] Unexpected DB error:', e?.message)
    }
  }

  // Path 2: Extract directly from PDF
  console.log(`[getDocumentText] Extracting text from PDF for doc ${document.id}`)
  try {
    const { data: fileData, error: fileErr } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (fileErr) throw fileErr

    const buffer       = Buffer.from(await fileData.arrayBuffer())
    const { text, totalPages } = await extractPdfText(buffer)

    if (!text?.trim()) {
      console.warn(`[getDocumentText] PDF extraction returned empty text for doc ${document.id}`)
      return ''
    }

    console.log(`[getDocumentText] Extracted ${text.length} chars, ${totalPages} pages`)

    // Path 3: Persist for future requests (best-effort, don't block)
    supabase.from('documents')
      .update({ document_text: text })
      .eq('id', document.id)
      .then(() => console.log(`[getDocumentText] Persisted text for doc ${document.id}`))
      .catch(e => console.warn('[getDocumentText] Could not persist text:', e?.message))

    return text

  } catch (extractErr) {
    console.error('[getDocumentText] PDF extraction failed:', extractErr?.message)
    return ''
  }
}

// ── Groq NotebookLM-style chat ───────────────────────────────────────
async function chatWithGroq({ doc, documentText, message, history }) {
  if (!documentText?.trim()) {
    // If we somehow have no text, still try — Groq may know the topic
    console.warn('[Chat/Groq] No document text available, proceeding without context')
  }

  return groqChatWithText({
    documentTitle: doc.title,
    documentText,
    message,
    history,
  })
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
    let provider = 'gemini'

    const geminiApiKey = process.env.GEMINI_API_KEY
    const canUseGroq = isGroqConfigured()
    const shouldBypassGemini = canUseGroq && shouldSkipGeminiDueToRecentQuota()

    if (!geminiApiKey && canUseGroq) {
      console.log('[Chat] No GEMINI_API_KEY — using Groq directly')
      provider = 'groq'
      const documentText = await getDocumentText(supabase, doc)
      reply = await chatWithGroq({ doc, documentText, message, history })
    } else if (shouldBypassGemini) {
      console.log('[Chat] Skipping Gemini because project quota is still cooling down — using Groq directly')
      provider = 'groq'
      const documentText = await getDocumentText(supabase, doc)
      reply = await chatWithGroq({ doc, documentText, message, history })
    } else {
      // ── Try Gemini first ───────────────────────────────────────
      try {
        const { data: fileData, error: fileErr } = await supabase.storage
          .from('documents').download(doc.storage_path)
        if (fileErr) throw fileErr

        const pdfBuffer  = Buffer.from(await fileData.arrayBuffer())
        const ai         = getGeminiClient()
        const geminiFile = await uploadPdfToGemini(ai, {
          buffer:      pdfBuffer,
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
          model:    getGeminiModelName(),
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
        }), { label: 'Gemini chat', userMessage: 'AI is temporarily busy. Please try again.' })

        reply = `${result.text || ''}`.trim() || 'I could not find that in your document.'

      } catch (geminiErr) {
        // ── Groq fallback — catches billing, quota, server, ALL errors
        if (shouldFallbackToGroq(geminiErr) && canUseGroq) {
          console.warn(`[Chat] Gemini failed (${geminiErr.status || geminiErr.message}), falling back to Groq`)
          provider = 'groq'
          const documentText = await getDocumentText(supabase, doc)
          reply = await chatWithGroq({ doc, documentText, message, history })
        } else {
          throw geminiErr
        }
      }
    }

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
      provider,
      messagesUsed:  messagesToday + 1,
      messagesLimit: dailyLimit,
    })

  } catch (error) {
    return fail(res, error)
  }
}
