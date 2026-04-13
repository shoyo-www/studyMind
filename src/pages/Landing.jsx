import { useState, useEffect } from 'react'

// Real features with specific, outcome-focused descriptions
const WHAT_YOU_GET = [
  { emoji: '💬', title: 'Chat tutor from your notes', desc: 'Ask "explain Calvin cycle" — AI answers from YOUR Biology PDF, not Wikipedia.' },
  { emoji: '❓', title: 'Instant quiz generation',    desc: 'Upload notes → get 20 MCQs in 10 seconds. From your exact syllabus.' },
  { emoji: '📋', title: 'Full mock test + AI marking', desc: 'Written exam, timed, AI marks each answer and shows what you missed.' },
  { emoji: '🎯', title: 'Weak topic finder',          desc: '"You score 42% on Thermodynamics." Know exactly what to fix before exams.' },
  { emoji: '🎓', title: 'Virtual viva examiner',      desc: 'AI professor asks you questions orally. Confidence score at the end.' },
  { emoji: '🇮🇳', title: 'Hindi + English',           desc: 'Switch languages anytime. Built for NEET, JEE, Boards, CA — any Indian exam.' },
]

export default function Landing({ onGetStarted, onLogin }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Sticky nav ─────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white/96 backdrop-blur-sm border-b border-zinc-100' : 'bg-transparent'}`}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
            Prep<span className="text-violet-600">Pal</span>
          </div>
          <button onClick={onLogin} className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
            Log in
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          HERO — everything above the fold must convert
      ══════════════════════════════════════════════════════════════ */}
      <section className="pt-24 pb-12 px-5 text-center">
        <div className="max-w-2xl mx-auto">

          {/* Honest badge — no fake numbers */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Free during early access
          </div>

          {/* Specific headline — tells them exactly what happens */}
          <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 mb-4 leading-tight"
            style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.03em' }}>
            Upload your notes.<br />
            <span className="text-violet-600">Get quizzes in 10 seconds.</span>
          </h1>

          {/* One specific sentence — not a feature list */}
          <p className="text-base text-zinc-500 mb-8 leading-relaxed max-w-lg mx-auto">
            PrepPal reads your exact PDF and generates quizzes, flashcards, mock tests, and a chat tutor — all from your own study material. Not generic AI. Your notes.
          </p>

          {/* PRIMARY CTA — big, single, clear */}
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-98 mb-3"
            style={{ background: '#6c63ff' }}
          >
            Try it free — upload your first PDF →
          </button>

          {/* Google sign-in hint — remove friction */}
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 mb-3">
            <svg width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 008.98 17"/><path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.52.09-1.02.25-1.52V5.41H1.88A8 8 0 00.98 9c0 1.29.31 2.51.9 3.59z"/><path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 008.98 1a8 8 0 00-7.1 4.41l2.63 2.07c.63-1.89 2.38-3.3 4.47-3.9"/></svg>
            Sign up with Google in one tap · No password needed
          </div>

          <p className="text-xs text-zinc-400">Free forever · No credit card · Takes 30 seconds</p>
        </div>

        {/* ── App screenshot mockup — shows chat (the wow moment) ── */}
        <div className="max-w-3xl mx-auto mt-12 hidden sm:block">
          <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-lg shadow-zinc-900/8">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
              </div>
              <div className="flex-1 mx-3 bg-white border border-zinc-200 rounded px-3 py-0.5 text-[11px] text-zinc-400 text-center">
                preppal.in
              </div>
            </div>
            {/* Chat window — shows the core value */}
            <div className="bg-white flex" style={{ height: 300 }}>
              <div className="w-40 border-r border-zinc-100 p-4 shrink-0">
                <div className="font-bold text-sm mb-4" style={{ fontFamily: 'Syne,sans-serif' }}>
                  Prep<span className="text-violet-600">Pal</span>
                </div>
                {['Dashboard','Chat','Quiz','Mock Test','Progress'].map((item,i) => (
                  <div key={item} className={`text-xs px-2 py-1.5 rounded-lg mb-1 ${i===1 ? 'bg-violet-50 text-violet-700 font-medium' : 'text-zinc-400'}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 flex flex-col p-4">
                <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mb-3">
                  Chat — Biology Ch 4–8.pdf
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  <div className="self-end bg-violet-600 text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-xs">
                    Explain photosynthesis from my notes
                  </div>
                  <div className="self-start flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-[9px] font-bold text-violet-600 shrink-0">AI</div>
                    <div className="bg-zinc-50 border border-zinc-100 text-zinc-700 text-xs px-3 py-2 rounded-xl rounded-bl-sm max-w-sm leading-relaxed">
                      Based on <strong>your notes (page 12)</strong> — Photosynthesis occurs in chloroplasts. Light-dependent reactions happen in the thylakoid membrane, producing ATP and NADPH. The Calvin cycle uses these to fix CO₂...
                    </div>
                  </div>
                  <div className="self-end bg-violet-600 text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-xs">
                    Generate 10 MCQs on this topic
                  </div>
                  <div className="self-start flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-[9px] font-bold text-violet-600 shrink-0">AI</div>
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs px-3 py-2 rounded-xl rounded-bl-sm">
                      ✓ Generated 10 MCQs from your notes. Ready to practice?
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 items-center border-t border-zinc-100 pt-3">
                  <div className="flex-1 text-xs text-zinc-300">Ask anything from your notes…</div>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#6c63ff' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M9 5L6 2M9 5L6 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HONEST PROOF — no fake numbers, just real differentiators
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-6 border-y border-zinc-100 bg-zinc-50">
        <div className="max-w-4xl mx-auto px-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
          {[
            { v: '₹0',    l: 'Free to start · always' },
            { v: '100%',  l: 'From your own notes' },
            { v: '10 sec', l: 'To generate a full quiz' },
            { v: '🇮🇳',   l: 'Built for Indian exams' },
          ].map(s => (
            <div key={s.l}>
              <div className="text-lg font-bold text-zinc-900" style={{ fontFamily: 'Syne,sans-serif' }}>{s.v}</div>
              <div className="text-xs text-zinc-400">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          vs ChatGPT — answer the biggest objection immediately
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900"
              style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.025em' }}>
              "Why not just use ChatGPT?"
            </h2>
            <p className="text-sm text-zinc-400 mt-2">Every student asks this. Here's the real difference.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-semibold text-zinc-500 mb-3">ChatGPT / Gemini</div>
              {[
                "Generic answers — not your syllabus",
                "Paste notes every single time",
                "Hallucinations you can't verify",
                "No quiz, no mock test, no marking",
                "No weak topic tracking",
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="text-red-400 text-sm mt-0.5 shrink-0">✗</span>
                  <span className="text-xs text-zinc-500 leading-snug">{t}</span>
                </div>
              ))}
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-semibold text-violet-700 mb-3">PrepPal</div>
              {[
                "Answers only from YOUR notes",
                "Upload once, use forever",
                "Answers you can check in your PDF",
                "Full mock tests with AI marking",
                "Shows your weakest topics",
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="text-violet-500 text-sm mt-0.5 shrink-0">✓</span>
                  <span className="text-xs text-violet-800 leading-snug">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FEATURES — outcome focused, not feature listed
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-5 bg-zinc-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-medium uppercase tracking-widest text-violet-500 mb-2">What you get</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900"
              style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.025em' }}>
              A full study system. Not just tools.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WHAT_YOU_GET.map((f, i) => (
              <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-5 hover:border-violet-100 transition-all">
                <div className="text-xl mb-3">{f.emoji}</div>
                <div className="text-sm font-semibold text-zinc-900 mb-1.5">{f.title}</div>
                <div className="text-xs text-zinc-400 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS — simple 3 steps
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900"
              style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.025em' }}>
              Ready in 3 steps
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { n: '1', title: 'Sign up free', desc: 'One tap with Google. No password. No card.', color: '#EEF2FF', accent: '#6c63ff' },
              { n: '2', title: 'Upload your PDF', desc: 'Drop your Biology notes, Chemistry chapter, any PDF. PrepPal reads it in seconds.', color: '#ECFDF5', accent: '#059669' },
              { n: '3', title: 'Start studying', desc: 'Ask questions, take quizzes, run a full mock test — all from your own notes.', color: '#FFFBEB', accent: '#d97706' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-5 p-5 rounded-2xl border border-zinc-100 bg-white">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
                  style={{ background: s.color, color: s.accent }}>
                  {s.n}
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{s.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRICING — simple, honest
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-5 bg-zinc-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-3"
            style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.025em' }}>
            Less than a samosa a day
          </h2>
          <p className="text-sm text-zinc-400 mb-10">
            BYJU's costs ₹5,000/month. PrepPal starts at ₹0.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { plan: 'Free',      price: '₹0',   desc: '3 PDFs · 20 messages/day',     h: false },
              { plan: 'Pro',       price: '₹99',  desc: 'Unlimited everything',          h: true  },
              { plan: 'Institute', price: '₹999', desc: 'For coaching centres',          h: false },
            ].map(p => (
              <div key={p.plan} className={`rounded-2xl p-5 text-center ${p.h ? 'bg-zinc-900 ring-2 ring-violet-500' : 'bg-white border border-zinc-100'}`}>
                {p.h && <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">Most popular</div>}
                <div className={`text-[11px] uppercase tracking-widest mb-1 ${p.h ? 'text-zinc-400' : 'text-zinc-400'}`}>{p.plan}</div>
                <div className={`text-3xl font-bold mb-1 ${p.h ? 'text-white' : 'text-zinc-900'}`} style={{ fontFamily: 'Syne,sans-serif' }}>{p.price}</div>
                <div className={`text-[11px] mb-3 ${p.h ? 'text-zinc-400' : 'text-zinc-400'}`}>/month</div>
                <div className={`text-xs ${p.h ? 'text-zinc-500' : 'text-zinc-500'}`}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FINAL CTA — specific, no fake claims
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-xl mx-auto">
          <div className="bg-zinc-900 rounded-3xl px-8 py-12 text-center">
            <div className="text-3xl mb-4">📄</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3"
              style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.025em' }}>
              Upload your first PDF.<br />See what happens.
            </h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              No demo. No tour. Just upload your notes and watch PrepPal quiz you on them in 10 seconds.
            </p>

            {/* Google sign-in button — show it right here */}
            <button onClick={onGetStarted}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-sm mb-3 transition-all hover:opacity-90"
              style={{ background: '#fff', color: '#111110' }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 008.98 17"/><path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.52.09-1.02.25-1.52V5.41H1.88A8 8 0 00.98 9c0 1.29.31 2.51.9 3.59z"/><path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 008.98 1a8 8 0 00-7.1 4.41l2.63 2.07c.63-1.89 2.38-3.3 4.47-3.9"/></svg>
              Continue with Google — it's free
            </button>

            <button onClick={onGetStarted}
              className="w-full py-3 rounded-xl text-white font-medium text-sm transition-all hover:opacity-85"
              style={{ background: '#6c63ff' }}>
              Sign up with email instead
            </button>

            <div className="text-xs text-zinc-600 mt-4">No credit card · Free forever · Made in India 🇮🇳</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-bold text-base" style={{ fontFamily: 'Syne,sans-serif' }}>
            Prep<span className="text-violet-600">Pal</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-400">
            <span className="cursor-pointer hover:text-zinc-700">Privacy Policy</span>
            <span className="cursor-pointer hover:text-zinc-700">Terms</span>
            <button onClick={onLogin} className="hover:text-zinc-700">Log in</button>
          </div>
          <div className="text-xs text-zinc-400">© 2026 PrepPal · Made in India 🇮🇳</div>
        </div>
      </footer>

    </div>
  )
}
