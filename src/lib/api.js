// src/lib/api.js
// ─────────────────────────────────────────────────────────────────────
// ALL backend calls go through this file.
// The frontend NEVER calls Supabase or Gemini directly.
// This is the only file that knows about the API URL.
// ─────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || '/api'

// ── Auth token helper ──────────────────────────────────────────────
// Gets the current user's JWT from Supabase Auth (stored in memory/localStorage by Supabase SDK)
// We only use the Supabase ANON key for auth — nothing sensitive
import { supabase } from './supabase.js'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in to continue.')
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  }
}

function normaliseApiErrorMessage(message = '', status = 500) {
  const safeMessage = `${message || ''}`.trim()
  const lowerMessage = safeMessage.toLowerCase()

  if (
    lowerMessage.includes('request too large for model')
    || lowerMessage.includes('tokens per minute')
    || lowerMessage.includes('service tier')
    || lowerMessage.includes('need more tokens?')
  ) {
    return 'That question is a little too large for the AI right now. Please try a shorter question or wait a few seconds and try again.'
  }

  if (status === 429 && lowerMessage.includes('groq')) {
    return 'The AI is a little busy right now. Please wait a few seconds and try again.'
  }

  return safeMessage || 'Something went wrong'
}

// ── Base fetch with error handling ────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = await getAuthHeaders()
  const res     = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const json    = await res.json().catch(() => null)

  if (!res.ok || !json?.success) {
    const err = new Error(normaliseApiErrorMessage(json?.error, res.status))
    err.status = res.status
    const retryAfter = Number(res.headers.get('Retry-After'))
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      err.retryAfterSeconds = retryAfter
    }
    throw err
  }

  return json.data
}

function buildQuizQuery(documentId, options = {}) {
  const params = new URLSearchParams({ documentId })

  if (options.type) {
    params.set('type', options.type)
  }

  if (options.topic) {
    params.set('topic', options.topic)
  }

  if (options.resumeOnly) {
    params.set('resumeOnly', '1')
  }

  return `/quiz?${params.toString()}`
}

// ── Documents ──────────────────────────────────────────────────────
export const documentsApi = {
  // List all user's documents
  list: async () => {
    const data = await apiFetch('/documents')
    return Array.isArray(data?.documents) ? data.documents : []
  },

  // Upload a PDF file
  upload: async (file, onProgress) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Please sign in to continue.')

    const formData = new FormData()
    formData.append('file', file)

    // Use XMLHttpRequest for upload progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/upload`)
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && json?.success) resolve(json.data)
          else reject(new Error(json?.error || 'We could not upload that file. Please try again.'))
        } catch {
          reject(new Error('We could not upload that file. Please try again.'))
        }
      }

      xhr.onerror = () => reject(new Error('We could not upload that file. Please check your connection and try again.'))
      xhr.send(formData)
    })
  },

  // Delete a document
  delete: (documentId) =>
    apiFetch('/documents', {
      method: 'DELETE',
      body:   JSON.stringify({ documentId }),
    }),

  // Load extracted document text only when a browser-side AI fallback needs it
  getText: (documentId) =>
    apiFetch(`/documents/text?documentId=${encodeURIComponent(documentId)}`),

  generateRoadmap: (documentId) =>
    apiFetch('/documents/analyze', {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    }),
}

// ── Chat ───────────────────────────────────────────────────────────
export const chatApi = {
  // Send a message and get AI reply
  send: (documentId, message, history = []) =>
    apiFetch('/chat', {
      method: 'POST',
      body:   JSON.stringify({ documentId, message, history }),
    }),
}

// ── Quiz ───────────────────────────────────────────────────────────
export const quizApi = {
  // Generate quiz from a document
  generate: (documentId, options = {}) =>
    apiFetch('/quiz', {
      method: 'POST',
      body:   JSON.stringify({ documentId, mode: 'manual', ...options }),
    }),

  // Load the latest quiz state for a document
  getLatest: (documentId, options = {}) =>
    apiFetch(buildQuizQuery(documentId, options)),

  saveProgress: (quizId, answers, currentIndex) =>
    apiFetch('/quiz', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'progress', quizId, answers, currentIndex }),
    }),

  // Start a background pre-generation request after upload
  preGenerate: (documentId, options = {}) =>
    apiFetch('/quiz', {
      method: 'POST',
      keepalive: true,
      body: JSON.stringify({
        documentId,
        mode: 'auto_upload',
        ...options,
      }),
    }),

  // Save quiz score
  saveScore: (quizId, score, answers = [], currentIndex = 0) =>
    apiFetch('/quiz', {
      method: 'PATCH',
      body:   JSON.stringify({ action: 'score', quizId, score, answers, currentIndex }),
    }),
}

// ── User / Profile ─────────────────────────────────────────────────
export const profileApi = {
  get: () => apiFetch('/profile'),

  update: (payload) =>
    apiFetch('/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Upgrade to pro (triggers Razorpay payment)
  upgradeToPro: () =>
    apiFetch('/payment/create', {
      method: 'POST',
      body:   JSON.stringify({ plan: 'pro' }),
    }),
}

// ── Progress ────────────────────────────────────────────────
export const progressApi = {
  get: () => apiFetch('/progress'),
}

// ── Mock Test ──────────────────────────────────────────────────────
export const mockTestApi = {
  generate: (documentId, options = {}) =>
    apiFetch('/mocktest/generate', {
      method: 'POST',
      body:   JSON.stringify({ documentId, ...options }),
    }),
  submit: (mockTestId, answers, timeTakenSecs) =>
    apiFetch('/mocktest/submit', {
      method: 'POST',
      body:   JSON.stringify({ mockTestId, answers, timeTakenSecs }),
    }),
  getSubmission: (submissionId) => apiFetch(`/mocktest/submission?id=${encodeURIComponent(submissionId)}`),
  list: () => apiFetch('/mocktest/list'),
  get: (mockTestId) => apiFetch(`/mocktest/get?id=${encodeURIComponent(mockTestId)}`),
}
