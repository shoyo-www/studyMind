import { GoogleGenAI, createPartFromUri } from '@google/genai'

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 40
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503, 504])
const DEFAULT_RETRY_DELAYS_MS = [1200, 2500, 5000]
const DEFAULT_RETRY_AFTER_SECONDS = 30

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getGeminiErrorStatus(error) {
  if (Number.isFinite(error?.status)) {
    return Number(error.status)
  }

  if (Number.isFinite(error?.error?.code)) {
    return Number(error.error.code)
  }

  return null
}

function isRetryableGeminiError(error) {
  const status = getGeminiErrorStatus(error)
  const message = `${error?.message || ''}`.toUpperCase()

  return (
    (status !== null && RETRYABLE_STATUS_CODES.has(status))
    || message.includes('UNAVAILABLE')
    || message.includes('HIGH DEMAND')
    || message.includes('RESOURCE_EXHAUSTED')
  )
}

function createGeminiBusyError(message, error) {
  const friendlyError = new Error(message)
  friendlyError.status = 503
  friendlyError.retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS
  friendlyError.cause = error
  return friendlyError
}

export async function runGeminiTask(task, options = {}) {
  const {
    label = 'Gemini request',
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    userMessage = 'AI service is temporarily busy. Please try again in about a minute.',
  } = options

  let lastError

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error

      if (!isRetryableGeminiError(error)) {
        throw error
      }

      if (attempt === retryDelaysMs.length) {
        throw createGeminiBusyError(userMessage, error)
      }

      const delayMs = retryDelaysMs[attempt]
      console.warn(`[Gemini retry] ${label} failed with status ${getGeminiErrorStatus(error) ?? 'unknown'}. Retrying in ${delayMs}ms.`)
      await sleep(delayMs)
    }
  }

  throw lastError
}

export function getGeminiClient(apiKey = process.env.GEMINI_API_KEY) {

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  return new GoogleGenAI({ apiKey })
}

export function getGeminiModelName(modelName = DEFAULT_MODEL) {
  return modelName
}

export async function uploadPdfToGemini(ai, { buffer, displayName }) {
  const file = await runGeminiTask(() => ai.files.upload({
    file: new Blob([buffer], { type: 'application/pdf' }),
    config: {
      displayName,
      mimeType: 'application/pdf',
    },
  }), {
    label: 'Gemini file upload',
    userMessage: 'AI document processing is temporarily busy. Please try again in about a minute.',
  })

  let current = file
  let attempts = 0

  while (current.state === 'PROCESSING' && attempts < MAX_POLL_ATTEMPTS) {
    await sleep(POLL_INTERVAL_MS)
    current = await runGeminiTask(
      () => ai.files.get({ name: file.name }),
      {
        label: 'Gemini file status check',
        userMessage: 'AI document processing is temporarily busy. Please try again in about a minute.',
      },
    )
    attempts += 1
  }

  if (current.state === 'FAILED') {
    throw new Error('Gemini file processing failed')
  }

  if (current.state === 'PROCESSING') {
    throw new Error('Gemini file processing timed out')
  }

  if (!current.uri || !current.mimeType) {
    throw new Error('Gemini file upload did not return a usable file reference')
  }

  return current
}

export function makeGeminiFilePart(file) {
  return createPartFromUri(file.uri, file.mimeType)
}

export function extractJsonFromText(rawText) {
  const cleaned = `${rawText || ''}`.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  const firstBracket = cleaned.indexOf('[')
  const lastBracket = cleaned.lastIndexOf(']')

  const candidates = []

  if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    candidates.push({
      start: firstBracket,
      text: cleaned.slice(firstBracket, lastBracket + 1),
    })
  }

  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    candidates.push({
      start: firstBrace,
      text: cleaned.slice(firstBrace, lastBrace + 1),
    })
  }

  candidates.push({ start: Number.MAX_SAFE_INTEGER, text: cleaned })

  const seen = new Set()

  for (const candidate of candidates.sort((a, b) => a.start - b.start)) {
    const text = candidate.text.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)

    try {
      JSON.parse(text)
      return text
    } catch {
      // Try the next candidate.
    }
  }

  return cleaned
}
