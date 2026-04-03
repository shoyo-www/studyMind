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
  if (!session) throw new Error('Not logged in')
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  }
}

// ── Base fetch with error handling ────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = await getAuthHeaders()
  const res     = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const json    = await res.json().catch(() => null)

  if (!res.ok || !json?.success) {
    const err = new Error(json?.error || 'Something went wrong')
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
    if (!session) throw new Error('Not logged in')

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
          else reject(new Error(json?.error || 'Upload failed'))
        } catch {
          reject(new Error('Upload failed'))
        }
      }

      xhr.onerror = () => reject(new Error('Upload failed'))
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
  saveScore: (quizId, score) =>
    apiFetch('/quiz/score', {
      method: 'POST',
      body:   JSON.stringify({ quizId, score }),
    }),
}

// ── User / Profile ─────────────────────────────────────────────────
export const profileApi = {
  get: () => apiFetch('/profile'),

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
