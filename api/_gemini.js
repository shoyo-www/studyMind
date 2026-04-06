import { GoogleGenAI, createPartFromUri } from '@google/genai'

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 40
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503, 504])
const DEFAULT_RETRY_DELAYS_MS = [1200, 2500, 5000]
const DEFAULT_RETRY_AFTER_SECONDS = 30
const LONG_RETRY_AFTER_THRESHOLD_MS = 10_000
let geminiQuotaCooldownUntil = 0

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

function parseJsonSafely(value) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function getGeminiErrorPayload(error) {
  const directPayload = error?.error && typeof error.error === 'object' ? error.error : null
  if (directPayload) return directPayload

  const messagePayload = parseJsonSafely(error?.message)
  if (messagePayload?.error && typeof messagePayload.error === 'object') return messagePayload.error
  if (messagePayload && typeof messagePayload === 'object') return messagePayload

  const causePayload = parseJsonSafely(error?.cause?.message)
  if (causePayload?.error && typeof causePayload.error === 'object') return causePayload.error
  if (causePayload && typeof causePayload === 'object') return causePayload

  return null
}

function getGeminiErrorDetails(error) {
  const details = getGeminiErrorPayload(error)?.details
  return Array.isArray(details) ? details : []
}

function getGeminiErrorMessage(error) {
  const payload = getGeminiErrorPayload(error)
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  return `${error?.message || ''}`.trim()
}

function parseRetryDelaySeconds(rawValue) {
  if (Number.isFinite(rawValue)) return Number(rawValue)
  if (typeof rawValue !== 'string') return null

  const match = rawValue.trim().match(/^([\d.]+)s$/i)
  if (!match) return null

  const seconds = Number(match[1])
  return Number.isFinite(seconds) ? seconds : null
}

function getGeminiRetryAfterSeconds(error) {
  if (Number.isFinite(error?.retryAfterSeconds)) {
    return Number(error.retryAfterSeconds)
  }

  for (const detail of getGeminiErrorDetails(error)) {
    const retryDelay = parseRetryDelaySeconds(detail?.retryDelay)
    if (retryDelay !== null) {
      return Math.max(1, Math.ceil(retryDelay))
    }
  }

  const match = getGeminiErrorMessage(error).match(/retry in\s+([\d.]+)s/i)
  if (match) {
    const seconds = Number(match[1])
    if (Number.isFinite(seconds)) {
      return Math.max(1, Math.ceil(seconds))
    }
  }

  return null
}

function isRetryableGeminiError(error) {
  const status = getGeminiErrorStatus(error)
  const message = getGeminiErrorMessage(error).toUpperCase()

  return (
    (status !== null && RETRYABLE_STATUS_CODES.has(status))
    || message.includes('UNAVAILABLE')
    || message.includes('HIGH DEMAND')
    || message.includes('RESOURCE_EXHAUSTED')
  )
}

function isGeminiQuotaError(error) {
  const status = getGeminiErrorStatus(error)
  const message = getGeminiErrorMessage(error).toUpperCase()

  return (
    status === 429
    || message.includes('QUOTA EXCEEDED')
    || message.includes('RESOURCE_EXHAUSTED')
    || message.includes('GENERATE_CONTENT_FREE_TIER')
    || message.includes('BILLING DETAILS')
  )
}

function isPermanentGeminiQuotaError(error) {
  if (!isGeminiQuotaError(error)) return false

  const message = getGeminiErrorMessage(error).toUpperCase()
  return (
    message.includes('LIMIT: 0')
    || message.includes('CHECK YOUR PLAN AND BILLING DETAILS')
    || message.includes('FREE_TIER')
  )
}

function shouldRetryGeminiError(error, nextDelayMs) {
  if (!isRetryableGeminiError(error)) {
    return false
  }

  if (isPermanentGeminiQuotaError(error)) {
    return false
  }

  const retryAfterSeconds = getGeminiRetryAfterSeconds(error)
  if (retryAfterSeconds && retryAfterSeconds * 1000 > Math.max(nextDelayMs, LONG_RETRY_AFTER_THRESHOLD_MS)) {
    return false
  }

  return true
}

function formatRetryHint(message, retryAfterSeconds) {
  if (!retryAfterSeconds) return message

  const safeMessage = `${message}`.trim().replace(/\s+$/, '').replace(/[.?!]$/, '')
  if (retryAfterSeconds >= 60) {
    const minutes = Math.ceil(retryAfterSeconds / 60)
    return `${safeMessage}. Please retry in about ${minutes} min.`
  }

  return `${safeMessage}. Please retry in about ${retryAfterSeconds}s.`
}

function createGeminiBusyError(message, error) {
  const retryAfterSeconds = getGeminiRetryAfterSeconds(error) || DEFAULT_RETRY_AFTER_SECONDS
  const friendlyError = new Error(message)
  friendlyError.status = 503
  friendlyError.retryAfterSeconds = retryAfterSeconds
  friendlyError.geminiIssueType = 'busy'
  friendlyError.upstreamStatus = getGeminiErrorStatus(error)
  friendlyError.cause = error
  return friendlyError
}

function createGeminiQuotaError(message, error) {
  const retryAfterSeconds = getGeminiRetryAfterSeconds(error) || DEFAULT_RETRY_AFTER_SECONDS
  geminiQuotaCooldownUntil = Math.max(
    geminiQuotaCooldownUntil,
    Date.now() + (retryAfterSeconds * 1000),
  )
  const friendlyError = new Error(message)
  friendlyError.status = 429
  friendlyError.retryAfterSeconds = retryAfterSeconds
  friendlyError.geminiIssueType = 'quota'
  friendlyError.upstreamStatus = getGeminiErrorStatus(error)
  friendlyError.cause = error
  return friendlyError
}

export function shouldSkipGeminiDueToRecentQuota() {
  return Date.now() < geminiQuotaCooldownUntil
}

export async function runGeminiTask(task, options = {}) {
  const {
    label = 'Gemini request',
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    userMessage = 'AI service is temporarily busy. Please try again in about a minute.',
    quotaUserMessage = 'AI service is temporarily unavailable because the Gemini API quota for this project has been exhausted. Please try again later.',
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

      const delayMs = retryDelaysMs[attempt]
      const retryAllowed = attempt < retryDelaysMs.length && shouldRetryGeminiError(error, delayMs)

      if (!retryAllowed) {
        if (isGeminiQuotaError(error)) {
          throw createGeminiQuotaError(formatRetryHint(quotaUserMessage, getGeminiRetryAfterSeconds(error)), error)
        }

        throw createGeminiBusyError(formatRetryHint(userMessage, getGeminiRetryAfterSeconds(error)), error)
      }

      console.warn(`[Gemini retry] ${label} failed with status ${getGeminiErrorStatus(error) ?? 'unknown'}. Retrying in ${delayMs}ms.`)
      await sleep(delayMs)
    }
  }

  throw lastError
}

export function shouldTryAnotherGeminiModel(error) {
  if (error?.geminiIssueType === 'quota' || error?.geminiIssueType === 'busy') {
    return true
  }

  return isRetryableGeminiError(error)
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
