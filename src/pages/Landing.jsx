import { useState, useEffect } from 'react'

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4C3 2.9 3.9 2 5 2H12L17 7V16C17 17.1 16.1 18 15 18H5C3.9 18 3 17.1 3 16V4Z" stroke="#6c63ff" strokeWidth="1.4"/>
        <path d="M12 2V7H17" stroke="#6c63ff" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M7 11H13M7 14H10" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Upload Anything',
    desc: 'PDF, DOCX, PPTX, YouTube videos, or article links. PrepPal reads it all instantly.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5C3 4.45 3.45 4 4 4H16C16.55 4 17 4.45 17 5V13C17 13.55 16.55 14 16 14H11L8 17V14H4C3.45 14 3 13.55 3 13V5Z" stroke="#6c63ff" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M7 8H13M7 11H10" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Chat With Your Notes',
    desc: 'Ask anything about your material. Get answers sourced directly from your own documents.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4C3 3.45 3.45 3 4 3H16C16.55 3 17 3.45 17 4V17L14 15.5L10 17.5L6 15.5L3 17V4Z" stroke="#6c63ff" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M7 8H13M7 11H10" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Auto Quiz Generation',
    desc: 'MCQ, true/false, and flashcards — all generated from your material with one click.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="5" r="2" stroke="#6c63ff" strokeWidth="1.4"/>
        <circle cx="10" cy="10" r="2" stroke="#6c63ff" strokeWidth="1.4"/>
        <circle cx="10" cy="15" r="2" stroke="#6c63ff" strokeWidth="1.4"/>
        <path d="M10 7V8M10 12V13" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Smart Roadmap',
    desc: 'AI breaks your content into topics ordered by difficulty so you always know what to study next.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14L7 10L10 13L14 8L17 11" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 17H17" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Progress Analytics',
    desc: 'Track weak topics, study streaks, and exam readiness score — all in one dashboard.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="#6c63ff" strokeWidth="1.4"/>
        <path d="M10 6V10L13 12" stroke="#6c63ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Mock Exam Simulator',
    desc: 'Full timed mock exams built from your notes. Know exactly how ready you are before the real thing.',
  },
]

const STEPS = [
  { num: '01', title: 'Upload your notes', desc: 'Drop any PDF, PPT, or Word doc. Or paste a YouTube link. PrepPal processes it in seconds.' },
  { num: '02', title: 'Get a learning plan', desc: 'AI generates a roadmap, flashcards, and quiz questions automatically. No setup needed.' },
  { num: '03', title: 'Study smarter', desc: 'Chat with your notes, take quizzes, track weak areas, and walk into your exam confident.' },
]

const TESTIMONIALS = [
  { name: 'Priya S.', role: 'NEET Aspirant, Delhi', text: 'I uploaded my entire Biology syllabus and got a full roadmap in 30 seconds. The chat feature is like having a tutor 24/7.', rating: 5 },
  { name: 'Arjun M.', role: 'MBA Student, Mumbai', text: 'Used it for my CA prep. The auto-quiz from my notes saved me hours every week. Got 78% in mock tests before the real exam.', rating: 5 },
  { name: 'Sneha R.', role: 'Class 12, Bangalore', text: 'Finally understood photosynthesis properly after asking the AI to explain it 3 different ways from my own textbook!', rating: 5 },
]

function StarRating({ count }) {
  return (
    <div className="flex gap-0.5 mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#f59e0b">
          <path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z"/>
        </svg>
      ))}
    </div>
  )
}

export default function Landing({ onGetStarted, onLogin }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white/95 backdrop-blur-sm border-b border-zinc-100 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-display font-bold text-xl tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Prep<span className="text-violet-600">Pal</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors px-3 py-1.5">
              Log in
            </button>
            <button
              onClick={onGetStarted}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
              style={{ background: '#111110' }}
            >
              Get started free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-24 px-4 sm:px-6 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #6c63ff 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Now in Beta
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 mb-6 leading-tight"
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: '-0.03em' }}>
            Upload your notes.<br />
            <span className="text-violet-600">Let AI teach you.</span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            PrepPal turns your PDFs, lecture notes, and textbooks into an interactive AI tutor —
            with quizzes, roadmaps, and chat. Built for Indian students. Starting at ₹0.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 hover:scale-105"
              style={{ background: '#6c63ff' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V11M8 2L5 5M8 2L11 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 13H14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Start for free — no card needed
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-zinc-700 font-medium text-sm border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
            >
              Already have an account? Log in →
            </button>
          </div>
          <p className="text-xs text-zinc-400">Free forever · No credit card · Takes 30 seconds</p>
        </div>

        {/* App mockup */}
        <div className="relative max-w-5xl mx-auto mt-12 hidden sm:block">
          <div className="rounded-2xl border border-zinc-200 shadow-2xl shadow-zinc-900/10 overflow-hidden">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-300" />
                <div className="w-3 h-3 rounded-full bg-amber-300" />
                <div className="w-3 h-3 rounded-full bg-green-300" />
              </div>
              <div className="flex-1 mx-4 bg-white border border-zinc-200 rounded-md px-3 py-1 text-xs text-zinc-400 text-center">
                app.preppal.in
              </div>
            </div>
            {/* Mock dashboard */}
            <div className="bg-white flex" style={{ height: 380 }}>
              {/* Sidebar */}
              <div className="w-48 border-r border-zinc-100 p-5 flex flex-col gap-1">
                <div className="font-bold text-base mb-5" style={{ fontFamily: 'Syne,sans-serif' }}>
                  Prep<span className="text-violet-600">Pal</span>
                </div>
                {['Dashboard', 'Upload Material', 'Chat with Notes', 'Roadmap', 'Quiz & Practice', 'My Progress'].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors
                    ${i === 0 ? 'bg-violet-50 text-violet-700 font-medium' : 'text-zinc-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-violet-500' : 'bg-zinc-200'}`} />
                    {item}
                  </div>
                ))}
              </div>
              {/* Main */}
              <div className="flex-1 p-6 overflow-hidden">
                <div className="text-sm font-semibold text-zinc-800 mb-4" style={{ fontFamily: 'Syne,sans-serif' }}>Good morning, Rahul 👋</div>
                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { l: 'Documents', v: '4' },
                    { l: 'Topics Covered', v: '34' },
                    { l: 'Quiz Average', v: '74%' },
                    { l: 'Exam Readiness', v: '68%' },
                  ].map(s => (
                    <div key={s.l} className="bg-white border border-zinc-100 rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">{s.l}</div>
                      <div className="text-lg font-bold text-zinc-900" style={{ fontFamily: 'Syne,sans-serif' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {/* Docs */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { t: 'Biology Ch 4–8', p: 72 },
                    { t: 'Chemistry Sem 2', p: 45 },
                    { t: 'Physics Mechanics', p: 90 },
                  ].map(d => (
                    <div key={d.t} className="bg-white border border-zinc-100 rounded-lg p-3">
                      <div className="w-6 h-7 bg-violet-50 rounded mb-2 flex items-center justify-center">
                        <div className="w-3 h-3.5 bg-violet-200 rounded-sm" />
                      </div>
                      <div className="text-[11px] font-medium text-zinc-700 mb-1">{d.t}</div>
                      <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${d.p}%` }} />
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-1">{d.p}% covered</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Glow under mockup */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 rounded-full blur-2xl opacity-20"
            style={{ background: '#6c63ff' }} />
        </div>
      </section>

      {/* Social proof bar */}
      <section className="py-8 border-y border-zinc-100 bg-zinc-50">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-center">
          {[
            { num: '2,400+', label: 'Students using PrepPal' },
            { num: '18,000+', label: 'PDFs processed' },
            { num: '4.9 ★',  label: 'Average rating' },
            { num: '₹199',   label: 'Max plan price' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-xl font-bold text-zinc-900" style={{ fontFamily: 'Syne,sans-serif' }}>{s.num}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] font-medium uppercase tracking-widest text-violet-500 mb-3">Features</div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-4"
              style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.025em' }}>
              Everything you need to study smarter
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
              Not just a PDF reader. A complete AI study system — built around your material, your pace, and your exam.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-6 hover:border-violet-100 hover:shadow-sm transition-all group">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">{f.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-14 sm:py-24 px-4 sm:px-6 bg-zinc-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] font-medium uppercase tracking-widest text-violet-500 mb-3">How it works</div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight"
              style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.025em' }}>
              From notes to exam-ready in 3 steps
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px bg-zinc-200" />
            {STEPS.map((step, i) => (
              <div key={i} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl border-2 border-violet-100 bg-white flex items-center justify-center mx-auto mb-5 relative z-10">
                  <span className="font-bold text-sm text-violet-600" style={{ fontFamily: 'Syne,sans-serif' }}>
                    {step.num}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">{step.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] font-medium uppercase tracking-widest text-violet-500 mb-3">Testimonials</div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight"
              style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.025em' }}>
              Students who study smarter
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-6 hover:border-violet-100 hover:shadow-sm transition-all">
                <StarRating count={t.rating} />
                <p className="text-sm text-zinc-600 leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-zinc-50">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-800">{t.name}</div>
                    <div className="text-[11px] text-zinc-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="py-14 sm:py-24 px-4 sm:px-6 bg-zinc-50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] font-medium uppercase tracking-widest text-violet-500 mb-3">Pricing</div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-4"
            style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.025em' }}>
            Less than a samosa plate
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-12 max-w-lg mx-auto">
            Most EdTech tools cost ₹2,000–₹5,000/month. PrepPal Pro is ₹199/month — or completely free to start.
            No student should be priced out of studying smarter.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { plan: 'Free',      price: '₹0',    desc: 'Perfect to start',     highlight: false },
              { plan: 'Pro',       price: '₹199',  desc: 'For serious students',  highlight: true  },
              { plan: 'Institute', price: '₹999',  desc: 'Coaching centres',     highlight: false },
            ].map(p => (
              <div key={p.plan}
                className={`rounded-2xl p-5 text-center ${p.highlight
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white border border-zinc-100'}`}>
                {p.highlight && (
                  <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-2">Most popular</div>
                )}
                <div className={`text-[11px] font-medium uppercase tracking-widest mb-2 ${p.highlight ? 'text-zinc-400' : 'text-zinc-400'}`}>
                  {p.plan}
                </div>
                <div className={`text-3xl font-bold mb-1 ${p.highlight ? 'text-white' : 'text-zinc-900'}`}
                  style={{ fontFamily: 'Syne,sans-serif' }}>
                  {p.price}
                </div>
                <div className={`text-[11px] mb-4 ${p.highlight ? 'text-zinc-400' : 'text-zinc-400'}`}>/month</div>
                <div className={`text-xs ${p.highlight ? 'text-zinc-400' : 'text-zinc-400'}`}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-zinc-900 rounded-3xl px-8 py-14">
            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight"
              style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.025em' }}>
              Start studying smarter today
            </h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              Join 2,400+ students already using PrepPal.<br />
              Free forever · No credit card needed · Takes 30 seconds.
            </p>
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: '#6c63ff' }}
            >
              Get started free →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-bold text-base" style={{ fontFamily: 'Syne,sans-serif' }}>
            Prep<span className="text-violet-600">Pal</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-400">
            <a href="#features" className="hover:text-zinc-700 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-zinc-700 transition-colors">Pricing</a>
            <span>Privacy Policy</span>
            <span>Terms</span>
          </div>
          <div className="text-xs text-zinc-400">© 2025 PrepPal · Made in India 🇮🇳</div>
        </div>
      </footer>

    </div>
  )
}
