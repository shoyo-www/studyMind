import { useState } from 'react'
import { auth } from '../lib/supabase'

const BENEFITS = [
  'Chat with your notes using AI',
  'Auto-generated quizzes & flashcards',
  'Learning roadmap from any PDF',
  'Track weak topics & exam readiness',
  'Hindi + English interface',
]

export default function Auth({ onBack, onSuccess, configError = '' }) {
  const [mode,     setMode]     = useState('login') // 'login' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  async function handleGoogle() {
    if (configError) return setError(configError)
    setLoading(true)
    setError('')
    try {
      await auth.signInWithGoogle()
      // Supabase redirects automatically — onSuccess fires via onAuthStateChange in App
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function handleEmail(e) {
    e.preventDefault()
    if (configError) return setError(configError)
    if (!email || !password) return setError('Please fill in all fields.')
    if (password.length < 6)  return setError('Password must be at least 6 characters.')
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { error } = await auth.signIn(email, password)
        if (error) throw error
        onSuccess?.()
      } else {
        const { error } = await auth.signUp(email, password)
        if (error) throw error
        setSent(true)
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Left panel — benefits */}
      <div className="hidden lg:flex flex-col w-[440px] shrink-0 relative overflow-hidden"
        style={{ background: '#111110' }}>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-20 -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, #6c63ff 0%, transparent 70%)' }} />

        <div className="relative flex flex-col flex-1 px-12 py-12">
          {/* Logo */}
          <button onClick={onBack} className="flex items-center gap-2 mb-16 group">
            <div className="font-bold text-xl" style={{ fontFamily: 'Syne,sans-serif', color: '#fff' }}>
              Study<span style={{ color: '#6c63ff' }}>Mind</span>
            </div>
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors ml-1">← Back</span>
          </button>

          {/* Headline */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white mb-3 leading-tight"
              style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.025em' }}>
              Your AI study partner,<br />available 24/7
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Upload your notes once. Get quizzes, roadmaps, and an AI tutor that knows your exact syllabus.
            </p>
          </div>

          {/* Benefits list */}
          <ul className="flex flex-col gap-4 mb-12">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.4)' }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5L3.5 6.5L7.5 2" stroke="#a99fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm text-zinc-400">{b}</span>
              </li>
            ))}
          </ul>

          {/* Price callout */}
          <div className="mt-auto p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>₹0</span>
              <span className="text-sm text-zinc-500">to get started</span>
            </div>
            <p className="text-xs text-zinc-600">No credit card needed. Upgrade to Pro for just ₹199/month when ready.</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-between mb-8">
            <div className="font-bold text-xl" style={{ fontFamily: 'Syne,sans-serif' }}>
              Study<span className="text-violet-600">Mind</span>
            </div>
            <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">← Back</button>
          </div>

          {/* Mode toggle */}
          <div className="flex p-1 rounded-xl mb-8" style={{ background: '#F5F4F1' }}>
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSent(false) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150 capitalize
                  ${mode === m ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          {sent ? (
            /* Email sent confirmation */
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke="#10b981" strokeWidth="1.5"/>
                  <path d="M22 6L12 13L2 6" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="font-semibold text-zinc-900 mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Check your email!</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                We sent a confirmation link to <strong className="text-zinc-700">{email}</strong>. Click it to activate your account.
              </p>
              <button
                onClick={() => { setSent(false); setMode('login') }}
                className="mt-6 text-sm text-violet-600 hover:text-violet-800 transition-colors"
              >
                Back to log in →
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight"
                  style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.02em' }}>
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-sm text-zinc-400">
                  {mode === 'login' ? 'Log in to continue studying smarter.' : 'Free forever. No credit card needed.'}
                </p>
              </div>

              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                disabled={loading || Boolean(configError)}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all mb-5 disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 0 0 8.98 17"/>
                  <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.52V5.41H1.88A8 8 0 0 0 .98 9c0 1.29.31 2.51.9 3.59z"/>
                  <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.1 4.41l2.63 2.07c.63-1.89 2.38-3.3 4.47-3.9"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-zinc-100" />
                <span className="text-xs text-zinc-400">or with email</span>
                <div className="flex-1 h-px bg-zinc-100" />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-xs px-4 py-3 rounded-lg mb-4">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M7 4V7.5M7 9.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              {configError && !error && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-lg mb-4">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M7 4V7.5M7 9.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {configError}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleEmail} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="rahul@example.com"
                    required
                    disabled={Boolean(configError)}
                    className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-300 outline-none transition-all"
                    onFocus={e => { e.target.style.borderColor = '#6c63ff'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = '#e4e4e7'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                    required
                    disabled={Boolean(configError)}
                    className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-300 outline-none transition-all"
                    onFocus={e => { e.target.style.borderColor = '#6c63ff'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = '#e4e4e7'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {mode === 'login' && (
                  <div className="text-right -mt-1">
                    <button type="button" className="text-xs text-zinc-400 hover:text-violet-600 transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || Boolean(configError)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-1 disabled:opacity-60 hover:opacity-90"
                  style={{ background: '#6c63ff' }}
                >
                  {loading
                    ? (mode === 'login' ? 'Logging in...' : 'Creating account...')
                    : (mode === 'login' ? 'Log in to StudyMind' : 'Create free account')
                  }
                </button>
              </form>

              {/* Switch mode */}
              <p className="text-center text-xs text-zinc-400 mt-5">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                  className="text-violet-600 font-medium hover:text-violet-800 transition-colors"
                >
                  {mode === 'login' ? 'Sign up free' : 'Log in'}
                </button>
              </p>

              {/* Terms */}
              {mode === 'signup' && (
                <p className="text-center text-[11px] text-zinc-300 mt-4 leading-relaxed">
                  By signing up, you agree to our{' '}
                  <span className="underline cursor-pointer">Terms of Service</span> and{' '}
                  <span className="underline cursor-pointer">Privacy Policy</span>.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
