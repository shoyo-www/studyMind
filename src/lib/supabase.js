// src/lib/supabase.js
// ─────────────────────────────────────────────────────────────────────
// Frontend Supabase client — uses a publishable or legacy anon key only
//
// The publishable/anon key is safe to expose IF you have Row Level Security (RLS)
// enabled on all your tables. It can ONLY do what RLS policies allow.
//
// We use this ONLY for:
//   1. Google / Email auth (login/logout/signup)
//   2. Listening to auth state changes
//
// We do NOT use this to query tables directly from the frontend.
// All data fetching goes through our backend API (src/lib/api.js)
// ─────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

export const missingSupabaseEnvMessage =
  'Missing VITE_SUPABASE_URL and a frontend Supabase key in .env. Set VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY.'

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

function getSupabaseClient() {
  if (!supabase) throw new Error(missingSupabaseEnvMessage)
  return supabase
}

// ── Auth helpers ───────────────────────────────────────────────────

export const auth = {
  // Sign in with Google
  signInWithGoogle: () =>
    getSupabaseClient().auth.signInWithOAuth({
      provider:  'google',
      options:   { redirectTo: window.location.origin },
    }),

  // Sign in with email + password
  signIn: (email, password) =>
    getSupabaseClient().auth.signInWithPassword({ email, password }),

  // Sign up with email + password
  signUp: (email, password) =>
    getSupabaseClient().auth.signUp({ email, password }),

  // Sign out
  signOut: () => getSupabaseClient().auth.signOut(),

  // Get current session
  getSession: () => getSupabaseClient().auth.getSession(),

  // Listen to auth state changes (login/logout)
  onAuthChange: (callback) =>
    getSupabaseClient().auth.onAuthStateChange(callback),
}
