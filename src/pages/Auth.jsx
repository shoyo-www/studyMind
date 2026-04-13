import { useState } from 'react'
import AppLoader from '../components/AppLoader'
import { auth } from '../lib/supabase'

const BENEFITS = [
  'Chat with your notes instead of generic AI answers',
  'Generate quizzes and flashcards from one uploaded PDF',
  'Run timed mock tests before the real exam',
  'Track weak topics and revise with intent',
  'Study in Hindi or English whenever needed',
]

export default function Auth({ onBack, onSuccess, onShowPrivacy, onShowTerms, configError = '' }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleGoogle() {
    if (configError) return setError(configError)
    setLoading(true)
    setError('')
    try {
      await auth.signInWithGoogle()
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function handleEmail(e) {
    e.preventDefault()
    if (configError) return setError(configError)
    if (!email || !password) return setError('Please fill in all fields.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
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
    <div className="pp-public-shell" style={{ fontFamily: "'Satoshi', 'DM Sans', system-ui, sans-serif" }}>
      <div className="pp-content min-h-screen px-4 py-5 sm:px-6 sm:py-6">
        <div className="max-w-6xl mx-auto">
          <div className="pp-glass rounded-full px-4 sm:px-6 py-3 flex items-center justify-between">
            <button onClick={onBack} className="pp-button-secondary px-4 py-2 text-sm">
              ← Back
            </button>
            <div className="text-center">
              <div className="font-display text-lg font-semibold text-white">PrepPal</div>
              <div className="text-[10px] uppercase tracking-[0.26em] pp-dim">Identity checkpoint</div>
            </div>
            <button onClick={onShowTerms} className="hidden sm:inline-flex pp-button-secondary px-4 py-2 text-sm">
              Terms
            </button>
          </div>

          <div className="mt-6 grid lg:grid-cols-[0.95fr_1.05fr] gap-6 items-stretch">
            <section className="pp-glass-strong rounded-[2rem] p-6 sm:p-8 lg:p-10 relative overflow-hidden">
              <div className="pp-orb -top-4 -left-4 w-28 h-28 bg-[rgba(255,118,105,0.18)]" />
              <div className="pp-orb bottom-8 right-2 w-24 h-24 bg-[rgba(102,247,226,0.14)]" />

              <div className="pp-section-label">Welcome back to the cockpit</div>
              <h1 className="mt-4 font-display text-4xl sm:text-5xl font-semibold tracking-[-0.05em] text-white leading-[0.95]">
                Sign in and pick up
                <span className="pp-gradient-text"> right where you left off.</span>
              </h1>
              <p className="mt-5 text-sm sm:text-base leading-8 pp-muted max-w-xl">
                This public flow now matches the new darker command-center style: less generic SaaS energy, more focus,
                signal, and momentum. Your study data still stays the star.
              </p>

              <div className="mt-8 pp-terminal">
                <div className="pp-terminal-bar">
                  <span className="pp-terminal-dot bg-[#ff5f57]" />
                  <span className="pp-terminal-dot bg-[#febc2e]" />
                  <span className="pp-terminal-dot bg-[#28c840]" />
                  <div className="ml-3 text-xs tracking-[0.28em] uppercase pp-dim">session-status.preppal</div>
                </div>
                <div className="p-5 space-y-4">
                  {BENEFITS.map((benefit, index) => (
                    <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                      <span className="pp-kbd mt-0.5">0{index + 1}</span>
                      <p className="text-sm leading-7 pp-muted">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid sm:grid-cols-3 gap-3">
                {[
                  { value: '₹0', label: 'to start' },
                  { value: '24/7', label: 'study companion' },
                  { value: '2x', label: 'faster revision loops' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.03)] p-4">
                    <div className="font-display text-2xl text-white">{item.value}</div>
                    <div className="mt-1 text-sm pp-dim">{item.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pp-glass rounded-[2rem] p-6 sm:p-8 lg:p-10 self-stretch">
              <div className="flex items-center justify-between gap-4 mb-8">
                <div>
                  <div className="pp-section-label">{mode === 'login' ? 'Log in' : 'Create account'}</div>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
                    {mode === 'login' ? 'Enter PrepPal' : 'Open your study workspace'}
                  </h2>
                </div>
                <div className="hidden sm:flex p-1 rounded-full border border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.02)]">
                  {['login', 'signup'].map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setError(''); setSent(false) }}
                      className={`px-4 py-2 rounded-full text-sm transition-colors ${mode === m ? 'bg-[rgba(255,118,105,0.18)] text-white' : 'text-[var(--pp-text-soft)] hover:text-white'}`}
                    >
                      {m === 'login' ? 'Log in' : 'Sign up'}
                    </button>
                  ))}
                </div>
              </div>

              {sent ? (
                <div className="rounded-[1.75rem] border border-[rgba(102,247,226,0.2)] bg-[rgba(102,247,226,0.08)] p-6 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full border border-[rgba(102,247,226,0.3)] bg-[rgba(102,247,226,0.12)] flex items-center justify-center text-xl text-[var(--pp-cyan)]">
                    ✓
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-white">Check your inbox</h3>
                  <p className="mt-3 text-sm leading-7 pp-muted">
                    We sent an activation link to <strong className="text-white">{email}</strong>. Open it to finish creating your PrepPal account.
                  </p>
                  <button
                    onClick={() => { setSent(false); setMode('login') }}
                    className="pp-button-primary px-5 py-3 text-sm mt-6"
                  >
                    Back to log in
                  </button>
                </div>
              ) : (
                <>
                  <div className="sm:hidden flex p-1 rounded-full border border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.02)] mb-6">
                    {['login', 'signup'].map((m) => (
                      <button
                        key={m}
                        onClick={() => { setMode(m); setError(''); setSent(false) }}
                        className={`flex-1 px-4 py-2 rounded-full text-sm transition-colors ${mode === m ? 'bg-[rgba(255,118,105,0.18)] text-white' : 'text-[var(--pp-text-soft)] hover:text-white'}`}
                      >
                        {m === 'login' ? 'Log in' : 'Sign up'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleGoogle}
                    disabled={loading || Boolean(configError)}
                    className="w-full flex items-center justify-center gap-3 rounded-2xl border border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-[rgba(102,247,226,0.3)] disabled:opacity-60"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18" />
                      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 0 0 8.98 17" />
                      <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.52V5.41H1.88A8 8 0 0 0 .98 9c0 1.29.31 2.51.9 3.59z" />
                      <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.1 4.41l2.63 2.07c.63-1.89 2.38-3.3 4.47-3.9" />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[rgba(130,147,183,0.16)]" />
                    <span className="text-xs uppercase tracking-[0.22em] pp-dim">or use email</span>
                    <div className="h-px flex-1 bg-[rgba(130,147,183,0.16)]" />
                  </div>

                  {error && (
                    <div className="mb-4 rounded-2xl border border-[rgba(255,118,105,0.24)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm text-[#ffd2cc]">
                      {error}
                    </div>
                  )}

                  {configError && !error && (
                    <div className="mb-4 rounded-2xl border border-[rgba(255,184,77,0.22)] bg-[rgba(255,184,77,0.08)] px-4 py-3 text-sm text-[#ffe4b8]">
                      {configError}
                    </div>
                  )}

                  <form onSubmit={handleEmail} className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase tracking-[0.22em] pp-dim mb-2">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rahul@example.com"
                        required
                        disabled={Boolean(configError)}
                        className="pp-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-[0.22em] pp-dim mb-2">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                        required
                        disabled={Boolean(configError)}
                        className="pp-input"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <button
                        type="button"
                        className="text-xs uppercase tracking-[0.2em] pp-dim hover:text-[var(--pp-cyan)] transition-colors"
                      >
                        Forgot password?
                      </button>
                      <span className="text-xs uppercase tracking-[0.2em] pp-dim">
                        {mode === 'login' ? 'Welcome back' : 'New account'}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || Boolean(configError)}
                      className="pp-button-primary w-full px-5 py-4 text-sm disabled:opacity-60"
                    >
                      {mode === 'login' ? 'Log in to PrepPal' : 'Create free account'}
                    </button>
                  </form>

                  <p className="mt-5 text-center text-sm pp-muted">
                    {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                      onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                      className="text-[var(--pp-cyan)] hover:text-white transition-colors"
                    >
                      {mode === 'login' ? 'Sign up free' : 'Log in'}
                    </button>
                  </p>

                  <p className="mt-5 text-center text-xs leading-7 pp-dim">
                    {mode === 'login' ? 'By logging in, you acknowledge our ' : 'By signing up, you agree to our '}
                    <button onClick={onShowPrivacy} type="button" className="text-[var(--pp-cyan)] hover:text-white transition-colors">
                      Privacy Policy
                    </button>
                    {mode === 'login' ? ' and ' : ' plus '}
                    <button onClick={onShowTerms} type="button" className="text-[var(--pp-cyan)] hover:text-white transition-colors">
                      Terms & Conditions
                    </button>
                    .
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {loading && <AppLoader fullScreen subtitle={mode === 'login' ? 'Signing you in to PrepPal' : 'Creating your PrepPal account'} />}
    </div>
  )
}
