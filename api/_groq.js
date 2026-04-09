
const GROQ_API_URL      = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL     = process.env.GROQ_MODEL          || 'llama-3.3-70b-versatile'
const FALLBACK_MODEL    = process.env.GROQ_FALLBACK_MODEL  || 'llama-3.1-8b-instant'
const DEFAULT_CHAT_MODEL = process.env.CHAT_GROQ_MODEL || 'qwen/qwen3-32b'
const CHAT_FALLBACK_MODEL = process.env.CHAT_GROQ_FALLBACK_MODEL || FALLBACK_MODEL || DEFAULT_CHAT_MODEL
const MAX_TOKENS        = 2048
const TIMEOUT_MS        = 30_000

const CHAT_DOC_CHAR_BUDGETS = [12_000, 8_000, 5_000, 3_500]
const CHAT_HISTORY_CHAR_BUDGETS = [1_800, 1_000, 400, 0]
const CHAT_HISTORY_MESSAGE_LIMIT = 6
const CHAT_HISTORY_MESSAGE_CHAR_LIMIT = 500
const CHAT_MAX_TOKENS = 768
const STUDY_SET_DOC_CHAR_BUDGETS = {
  mcq: [14_000, 10_000, 7_000],
  truefalse: [14_000, 10_000, 7_000],
  flashcard: [12_000, 9_000, 6_000],
}
const MOCK_TEST_DOC_CHAR_BUDGETS = {
  50: [18_000, 14_000, 10_000],
  75: [16_000, 12_000, 9_000],
  100: [14_000, 10_000, 7_000],
}
const STUDY_SET_MAX_TOKENS = {
  mcq: 1_400,
  truefalse: 1_200,
  flashcard: 2_200,
}
const MOCK_TEST_MAX_TOKENS = 4_096

function clampDocumentText(text, maxChars) {
  const safeText = `${text || ''}`.trim()
  if (!safeText || safeText.length <= maxChars) {
    return safeText
  }

  const separator = '\n\n[... document truncated for length ...]\n\n'
  const availableChars = Math.max(maxChars - separator.length, 0)
  const headChars = Math.max(Math.floor(availableChars * 0.7), 0)
  const tailChars = Math.max(availableChars - headChars, 0)

  return [
    safeText.slice(0, headChars),
    separator.trim(),
    tailChars > 0 ? safeText.slice(-tailChars) : '',
  ].filter(Boolean).join('\n\n').trim()
}

function isGroqOversizedError(error) {
  const message = `${error?.message || ''}`.toLowerCase()

  return (
    error?.status === 429
    && (
      message.includes('request too large')
      || message.includes('tokens per minute')
      || message.includes('requested')
    )
  )
}

function getFriendlyGroqErrorMessage(errorMessage = '', status = 500) {
  const message = `${errorMessage || ''}`.toLowerCase()

  if (
    status === 429
    && (
      message.includes('request too large')
      || message.includes('tokens per minute')
      || message.includes('service tier')
      || message.includes('requested')
    )
  ) {
    return 'That question is a little too large for the AI right now. Please try a shorter question or wait a few seconds and try again.'
  }

  if (status === 429 || message.includes('rate limit')) {
    return 'The AI is a little busy right now. Please wait a few seconds and try again.'
  }

  if (message.includes('billing') || message.includes('upgrade to dev tier')) {
    return 'The AI is temporarily unavailable right now. Please try again shortly.'
  }

  return null
}

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}

async function groqFetch(messages, { model = DEFAULT_MODEL, temperature = 0.3, maxTokens = MAX_TOKENS } = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set in environment variables.')
  }

  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(GROQ_API_URL, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens:  maxTokens,
        temperature,
        stream:      false,
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const providerMessage = errBody?.error?.message || `Groq API error ${res.status}`
      const friendlyMessage = getFriendlyGroqErrorMessage(providerMessage, res.status)
      const err     = new Error(friendlyMessage || providerMessage)
      err.status    = res.status
      err.groqModel = model
      err.providerMessage = providerMessage

      const retryAfterMatch = `${providerMessage}`.match(/retry in about\s+(\d+)s/i)
      if (retryAfterMatch) {
        err.retryAfterSeconds = Number(retryAfterMatch[1]) || undefined
      }

      throw err
    }

    const data = await res.json()
    return (data?.choices?.[0]?.message?.content || '').trim()

  } finally {
    clearTimeout(timeout)
  }
}

export async function groqChat(messages, options = {}) {
  const { model = DEFAULT_MODEL, fallbackModel = FALLBACK_MODEL, ...requestOptions } = options

  try {
    return await groqFetch(messages, { ...requestOptions, model })
  } catch (err) {
    if (err.status === 429 && model !== fallbackModel) {
      console.warn(`[Groq] ${model} rate-limited → retrying with ${fallbackModel}`)
      return groqFetch(messages, { ...requestOptions, model: fallbackModel })
    }
    throw err
  }
}

export function extractJsonFromGroqText(rawText) {
  const cleaned = `${rawText || ''}`
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')

  const fb = cleaned.indexOf('['), lb = cleaned.lastIndexOf(']')
  const fo = cleaned.indexOf('{'), lo = cleaned.lastIndexOf('}')

  const candidates = []
  if (fb !== -1 && lb > fb) candidates.push(cleaned.slice(fb, lb + 1))
  if (fo !== -1 && lo > fo) candidates.push(cleaned.slice(fo, lo + 1))
  candidates.push(cleaned)

  for (const c of candidates) {
    try { JSON.parse(c); return c } catch { /* next */ }
  }
  return cleaned
}

export function stripReasoningBlocks(rawText = '') {
  const text = `${rawText || ''}`
  const withoutClosedThinkBlocks = text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')

  const withoutLeadingOpenThinkBlock = withoutClosedThinkBlocks
    .replace(/^\s*<think\b[^>]*>[\s\S]*$/i, '')
    .replace(/^\s*<thinking\b[^>]*>[\s\S]*$/i, '')

  return withoutLeadingOpenThinkBlock.trim()
}

function buildHistoryText(history = [], maxChars = CHAT_HISTORY_CHAR_BUDGETS[0]) {
  if (!Array.isArray(history) || maxChars <= 0) {
    return ''
  }

  const historyText = history
    .slice(-CHAT_HISTORY_MESSAGE_LIMIT)
    .map((m) => {
      const role = m?.role === 'user' ? 'Student' : 'Assistant'
      const text = `${m?.text || ''}`.trim().slice(0, CHAT_HISTORY_MESSAGE_CHAR_LIMIT)
      return text ? `${role}: ${text}` : ''
    })
    .filter(Boolean)
    .join('\n')

  return clampDocumentText(historyText, maxChars)
}

export async function groqChatWithText({
  documentTitle,
  documentText,
  message,
  history = [],
  model = DEFAULT_CHAT_MODEL,
  fallbackModel = CHAT_FALLBACK_MODEL,
}) {
  const safeText = `${documentText || ''}`.trim()
  const historyText = buildHistoryText(history)

  const systemPrompt = `You are PrepPal AI, a focused study assistant working like NotebookLM.

CRITICAL RULES:
1. You ONLY answer from the DOCUMENT SOURCE TEXT provided below — nothing else
2. The document is "${documentTitle}"
3. If the answer is in the document, give a clear, helpful explanation
4. If you cannot find the answer in the document, say: "I couldn't find that in your document. Try asking about [suggest a related topic from the document]."
5. NEVER say the document was not provided — it IS provided as "DOCUMENT SOURCE TEXT" below
6. Be student-friendly: use simple language, examples, bullet points where helpful
7. Remember the conversation history and build on previous answers`

  const messages = [
    { role: 'system', content: systemPrompt },
  ]

  let lastError = null

  for (const [index, maxChars] of CHAT_DOC_CHAR_BUDGETS.entries()) {
    const clampedText = clampDocumentText(safeText, maxChars)
    const historyText = buildHistoryText(
      history,
      CHAT_HISTORY_CHAR_BUDGETS[Math.min(index, CHAT_HISTORY_CHAR_BUDGETS.length - 1)],
    )

    if (!clampedText) {
      console.warn('[Groq Chat] Document text is empty — model will have no context')
    }

    try {
      const reply = await groqChat([
        ...messages,
        {
          role: 'user',
          content: [
            '═══ DOCUMENT SOURCE TEXT ═══',
            clampedText || '[Document text could not be extracted. Please re-upload the PDF.]',
            '═══ END OF DOCUMENT ═══',
            '',
            historyText ? `Previous conversation:\n${historyText}\n` : '',
            `Student question: ${message.trim()}`,
          ].filter(Boolean).join('\n'),
        },
      ], {
        model,
        fallbackModel,
        temperature: 0.3,
        maxTokens: CHAT_MAX_TOKENS,
      })

      const cleanedReply = stripReasoningBlocks(reply)
      return cleanedReply || 'I could not find an answer in your document. Please try rephrasing your question.'
    } catch (error) {
      lastError = error
      if (!isGroqOversizedError(error) || maxChars === CHAT_DOC_CHAR_BUDGETS[CHAT_DOC_CHAR_BUDGETS.length - 1]) {
        throw error
      }

      console.warn(`[Groq Chat] Request too large with ${maxChars} chars. Retrying with less document text.`)
    }
  }

  throw lastError || new Error('Groq chat failed. Please try again.')
}

export async function groqGenerateStudySet({ documentTitle, documentText, count, type = 'mcq', topic = null }) {
  const safeText = `${documentText || ''}`.trim()

  if (!safeText) {
    throw new Error('Document text is empty. Please re-upload your PDF to enable quiz generation.')
  }

  const topicLine = topic
    ? `Focus ONLY on the topic "${topic}".`
    : 'Cover the most important concepts across the whole document.'

  let formatInstruction = ''
  if (type === 'flashcard') {
    formatInstruction = [
      `Generate exactly ${count} flashcards from the document text below.`,
      topicLine,
      'Return ONLY a valid JSON array, absolutely no other text:',
      '[{"front":"term or question","back":"definition or answer","topic":"subject area"}]',
    ].join(' ')
  } else if (type === 'truefalse') {
    formatInstruction = [
      `Generate exactly ${count} true/false questions from the document text below.`,
      topicLine,
      'Return ONLY a valid JSON array, absolutely no other text:',
      '[{"question":"clear statement to evaluate","correct":true,"explanation":"brief reason from document","topic":"subject"}]',
    ].join(' ')
  } else {
    formatInstruction = [
      `Generate exactly ${count} multiple-choice questions from the document text below.`,
      topicLine,
      'Return ONLY a valid JSON array, absolutely no other text:',
      '[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"brief reason from document","topic":"..."}]',
      'correct is the zero-based index (0–3) of the right answer.',
      'Make wrong options plausible but clearly distinguishable.',
    ].join(' ')
  }

  const docBudgets = STUDY_SET_DOC_CHAR_BUDGETS[type] || STUDY_SET_DOC_CHAR_BUDGETS.mcq
  const maxTokens = STUDY_SET_MAX_TOKENS[type] || MAX_TOKENS
  let lastError = null

  for (const maxChars of docBudgets) {
    const clampedText = clampDocumentText(safeText, maxChars)
    const messages = [
      {
        role: 'system',
        content: [
          'You are PrepPal AI, a study content generator.',
          'Generate questions and flashcards ONLY from the document text provided.',
          'Never invent facts not present in the document.',
          'Return only valid JSON.',
          'Keep each explanation short and concise.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Document: "${documentTitle}"`,
          '',
          '═══ DOCUMENT TEXT ═══',
          clampedText,
          '═══ END OF DOCUMENT ═══',
          '',
          formatInstruction,
        ].join('\n'),
      },
    ]

    try {
      const rawText = await groqChat(messages, { temperature: 0.2, maxTokens })
      const jsonStr = extractJsonFromGroqText(rawText)

      let parsed
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        throw new Error(`Groq returned invalid JSON for ${type} generation. Please try again.`)
      }

      const items = Array.isArray(parsed) ? parsed : []
      if (!items.length) {
        throw new Error(`Groq generated no ${type} items. Please try again.`)
      }

      return items
    } catch (error) {
      lastError = error
      if (!isGroqOversizedError(error) || maxChars === docBudgets[docBudgets.length - 1]) {
        throw error
      }

      console.warn(`[Groq ${type}] Request too large with ${maxChars} chars. Retrying with less document text.`)
    }
  }

  throw lastError || new Error(`Groq ${type} generation failed. Please try again.`)
}

export async function groqGenerateMockTest({ documentTitle, documentText, prompt, totalMarks = 100 }) {
  const safeText = `${documentText || ''}`.trim()
  const docBudgets = MOCK_TEST_DOC_CHAR_BUDGETS[Number(totalMarks)] || MOCK_TEST_DOC_CHAR_BUDGETS[100]
  let lastError = null

  for (const maxChars of docBudgets) {
    const clampedText = clampDocumentText(safeText, maxChars)
    const messages = [
      {
        role: 'system',
        content: [
          'You are an expert exam paper setter.',
          'Generate exam questions ONLY from the provided document text.',
          'Return only valid JSON arrays.',
          'No markdown and no extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Document: "${documentTitle}"`,
          '',
          '═══ DOCUMENT TEXT ═══',
          clampedText,
          '═══ END OF DOCUMENT ═══',
          '',
          prompt,
        ].join('\n'),
      },
    ]

    try {
      const rawText = await groqChat(messages, {
        temperature: 0.4,
        maxTokens: MOCK_TEST_MAX_TOKENS,
      })
      const jsonStr = extractJsonFromGroqText(rawText)

      let parsed
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        throw new Error('Groq returned invalid JSON for mock test generation. Please try again.')
      }

      const items = Array.isArray(parsed) ? parsed : []
      if (!items.length) {
        throw new Error('Groq returned no mock test questions. Please try again.')
      }

      return items
    } catch (error) {
      lastError = error
      if (!isGroqOversizedError(error) || maxChars === docBudgets[docBudgets.length - 1]) {
        throw error
      }

      console.warn(`[Groq mocktest] Request too large with ${maxChars} chars. Retrying with less document text.`)
    }
  }

  throw lastError || new Error('Groq mock test generation failed. Please try again.')
}
