import { createClient } from '@supabase/supabase-js'

const DEFAULT_WINDOW_MS = 60_000
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i
const rateLimitMap = new Map()
const LOCAL_DEV_MAX_WINDOW_MS = 30_000

function isLocalDevelopmentRuntime() {
  const nodeEnv = `${process.env.NODE_ENV || ''}`.trim().toLowerCase()
  const vercelEnv = `${process.env.VERCEL_ENV || ''}`.trim().toLowerCase()

  return nodeEnv !== 'production' && vercelEnv !== 'production'
}

function getServerEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : '')
}

export function getSupabaseUrl() {
  return getServerEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
}

export function getSupabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ''
  )
}

export function getAdminSupabase() {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing server-side Supabase environment variables')
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false } },
  )
}

export function getUserSupabase(userToken) {
  const supabaseUrl = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase URL or anon key')
  }

  return createClient(
    supabaseUrl,
    anonKey,
    {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
      auth: { persistSession: false },
    },
  )
}

export async function requireAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (!authHeader?.startsWith('Bearer ')) {
    const err = new Error('Please sign in to continue.')
    err.status = 401
    throw err
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    const err = new Error('Please sign in to continue.')
    err.status = 401
    throw err
  }

  const supabase = getAdminSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    const err = new Error('Your session has expired. Please sign in again.')
    err.status = 401
    throw err
  }

  return user
}

export async function ensureProfile(supabase, user) {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, plan, uploads_this_month, messages_today, messages_reset_at')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfileError) throw existingProfileError

  const payload = {
    id: user.id,
    email: user.email || existingProfile?.email || null,
    full_name: existingProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
    avatar_url: existingProfile?.avatar_url || user.user_metadata?.avatar_url || null,
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, email, full_name, avatar_url, plan, uploads_this_month, messages_today, messages_reset_at')
    .single()

  if (error) throw error
  return data
}

export function getCurrentMonthStartIso(now = new Date()) {
  const date = new Date(now)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString()
}

export async function getCurrentMonthUploadCount(supabase, userId, now = new Date()) {
  const monthStartIso = getCurrentMonthStartIso(now)
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStartIso)

  if (error) throw error
  return Number(count || 0)
}

export async function syncProfileUploadCount(supabase, profile, userId, nextCount) {
  const normalizedCount = Math.max(0, Number(nextCount) || 0)
  if (Number(profile?.uploads_this_month || 0) === normalizedCount) {
    return {
      ...profile,
      uploads_this_month: normalizedCount,
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ uploads_this_month: normalizedCount })
    .eq('id', userId)
    .select('id, email, full_name, avatar_url, plan, uploads_this_month, messages_today, messages_reset_at')
    .single()

  if (error) throw error
  return data
}

export function sanitizeFileName(fileName = 'upload.pdf') {
  const cleaned = fileName
    .normalize('NFKC')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120)

  return cleaned || 'upload.pdf'
}

export function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (Array.isArray(forwardedFor)) return forwardedFor[0]
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

function pruneRateLimitMap(now) {
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(key)
    }
  }
}

export function checkRateLimit(key, options = {}) {
  const requestedLimit = Number.isFinite(options.limit) ? options.limit : 30
  const requestedWindowMs = Number.isFinite(options.windowMs) ? options.windowMs : DEFAULT_WINDOW_MS
  const isLocalDev = isLocalDevelopmentRuntime()
  const limit = isLocalDev
    ? Math.max(requestedLimit, Math.ceil(requestedLimit * 3))
    : requestedLimit
  const windowMs = isLocalDev
    ? Math.min(requestedWindowMs, LOCAL_DEV_MAX_WINDOW_MS)
    : requestedWindowMs
  const now = Date.now()

  if (rateLimitMap.size > 1000) {
    pruneRateLimitMap(now)
  }

  const entry = rateLimitMap.get(key)

  if (entry && isLocalDev && (entry.resetAt - now) > windowMs) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  entry.count += 1
  rateLimitMap.set(key, entry)

  if (entry.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    const err = new Error(`You're doing that a little too quickly. Please wait about ${retryAfterSeconds}s and try again.`)
    err.status = 429
    err.retryAfterSeconds = retryAfterSeconds
    throw err
  }
}

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export function fail(res, error) {
  const status = error.status || 500
  const message = error.message || 'Internal server error'

  if (status >= 500) {
    console.error('[API Error]', error)
  } else {
    console.error(`[API Error ${status}]`, message)
  }

  if (error.retryAfterSeconds) {
    res.setHeader('Retry-After', String(error.retryAfterSeconds))
  }

  return res.status(status).json({ success: false, error: message })
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function setCors(req, res) {
  const origin = req.headers.origin
  const allowedOrigins = getAllowedOrigins()
  const isAllowedOrigin =
    origin &&
    (allowedOrigins.includes(origin) || LOCALHOST_PATTERN.test(origin))

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
