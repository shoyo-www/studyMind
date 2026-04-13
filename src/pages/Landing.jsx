import { useEffect, useState } from 'react'

const FEATURE_CARDS = [
  {
    title: 'Chat grounded in your notes',
    desc: 'Ask for explanations, summaries, or fast revision and keep the answers anchored to your uploaded material.',
    accent: 'var(--pp-cyan)',
  },
  {
    title: 'Quizzes in seconds',
    desc: 'Turn any chapter PDF into MCQs, drills, and weak-topic checks without setting up anything manually.',
    accent: 'var(--pp-coral)',
  },
  {
    title: 'Mock tests with feedback',
    desc: 'Run timed practice sessions, review mistakes, and see exactly which concepts need another pass.',
    accent: 'var(--pp-cyan)',
  },
]

const STUDY_SYSTEM = [
  {
    title: 'Upload once, revise everywhere',
    desc: 'Your notes become a reusable study base for chat, quizzes, flashcards, mock tests, and roadmap planning.',
    meta: 'PDF-native',
  },
  {
    title: 'Switch between tutor and examiner',
    desc: 'PrepPal can teach a topic gently, then immediately test you on the same material from the same source.',
    meta: 'Learn + test',
  },
  {
    title: 'Track what actually needs work',
    desc: 'Weaknesses are surfaced by topic so revision time goes to the chapters most likely to move your score.',
    meta: 'Score-aware',
  },
  {
    title: 'Built for Indian exam flow',
    desc: 'Fast setup, Hindi + English support, and a format that feels useful for NEET, JEE, boards, CA, and beyond.',
    meta: 'India-first',
  },
]

const COMMAND_STEPS = [
  {
    cmd: 'upload biology-ch04.pdf',
    label: 'Ingest your chapter',
    text: 'Drop in the file once and PrepPal turns it into a study-ready knowledge base.',
  },
  {
    cmd: 'quiz --topic photosynthesis --count 20',
    label: 'Generate active recall',
    text: 'Move from reading to testing with instant MCQs based on that exact chapter.',
  },
  {
    cmd: 'mocktest --timed --review',
    label: 'Stress-test before exam day',
    text: 'Run a full practice session and get AI feedback on what you missed and why.',
  },
]

const EXAM_TAGS = ['NEET', 'JEE', 'Boards', 'CA', 'UPSC']

export default function Landing({ onGetStarted, onLogin, onShowPrivacy, onShowTerms }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function jumpToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="pp-public-shell" style={{ fontFamily: "'Satoshi', 'DM Sans', system-ui, sans-serif" }}>
      <div className="pp-content">
        <nav className={`fixed inset-x-0 top-0 z-40 transition-all duration-200 ${scrolled ? 'pt-3' : 'pt-5'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className={`pp-glass flex items-center justify-between rounded-full px-4 sm:px-6 py-3 ${scrolled ? 'shadow-2xl' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold pp-glass-strong">
                  <span className="pp-gradient-text">P</span>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold leading-none text-white">PrepPal</div>
                  <div className="text-[10px] uppercase tracking-[0.26em] pp-dim">Study command center</div>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-3 text-sm">
                <button onClick={jumpToFeatures} className="pp-button-secondary px-4 py-2.5">
                  Product
                </button>
                <button onClick={onLogin} className="pp-button-primary px-5 py-2.5">
                  Log in
                </button>
              </div>
              <button onClick={onLogin} className="md:hidden pp-button-primary px-4 py-2.5 text-sm">
                Enter
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-12 sm:pt-32 sm:pb-16">
          <section className="grid lg:grid-cols-[1.08fr_0.92fr] gap-8 items-center">
            <div className="relative">
              <div className="pp-orb top-8 left-12 w-32 h-32 bg-[rgba(255,118,105,0.22)]" />
              <div className="pp-orb top-28 right-12 w-28 h-28 bg-[rgba(102,247,226,0.16)]" />

              <div className="pp-pill mb-5">
                <span className="w-2 h-2 rounded-full bg-[var(--pp-cyan)] animate-pulse" />
                Early access is live
              </div>

              <div className="pp-section-label mb-5">Themed for focus, not fluff</div>

              <h1
                className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[0.94] tracking-[-0.04em] text-white max-w-3xl"
              >
                Study like you are
                <br />
                operating a
                <span className="pp-gradient-text"> mission console.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base sm:text-lg leading-8 pp-muted">
                Upload your notes and turn PrepPal into a tutor, quiz engine, mock-test examiner, and revision cockpit.
                The vibe is darker, sharper, and more intentional, but the job is still simple: help you score better from your own material.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button onClick={onGetStarted} className="pp-button-primary px-6 py-4 text-base">
                  Start free
                  <span aria-hidden="true">→</span>
                </button>
                <button onClick={jumpToFeatures} className="pp-button-secondary px-6 py-4 text-base">
                  Explore the system
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                {EXAM_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-medium tracking-[0.18em] text-[var(--pp-text-soft)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-10 grid sm:grid-cols-3 gap-3">
                {[
                  { value: '10 sec', label: 'to spin up a fresh quiz' },
                  { value: '2 modes', label: 'teacher and examiner' },
                  { value: '100%', label: 'built around your PDFs' },
                ].map((stat) => (
                  <div key={stat.label} className="pp-glass rounded-2xl p-4">
                    <div className="font-display text-2xl font-semibold text-white">{stat.value}</div>
                    <div className="mt-1 text-sm pp-dim">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pl-4">
              <div className="pp-terminal">
                <div className="pp-terminal-bar">
                  <span className="pp-terminal-dot bg-[#ff5f57]" />
                  <span className="pp-terminal-dot bg-[#febc2e]" />
                  <span className="pp-terminal-dot bg-[#28c840]" />
                  <div className="ml-3 text-xs tracking-[0.28em] uppercase pp-dim">study-session.preppal</div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="rounded-2xl border border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="flex items-center justify-between gap-4 text-xs pp-dim">
                      <span className="tracking-[0.24em] uppercase">Active document</span>
                      <span className="pp-kbd">BIO-04</span>
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">Biology Chapter 4: Photosynthesis</div>
                    <div className="mt-1 text-sm pp-muted">Source-aware tutoring, testing, and review for one uploaded chapter.</div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="pp-kbd mt-0.5">01</div>
                      <div className="flex-1 rounded-2xl border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                        <div className="pp-mono text-sm text-[var(--pp-cyan)]">$ explain calvin cycle from my notes</div>
                        <p className="mt-2 text-sm leading-7 pp-muted">
                          PrepPal summarizes page-linked notes, then points to where the ATP/NADPH transition is explained so revision stays grounded.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="pp-kbd mt-0.5">02</div>
                      <div className="flex-1 rounded-2xl border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                        <div className="pp-mono text-sm text-[var(--pp-coral)]">$ generate 20 mcqs on weak areas</div>
                        <p className="mt-2 text-sm leading-7 pp-muted">
                          The next action becomes a quiz pack targeted at chloroplast structure, limiting factors, and equation recall.
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.02)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--pp-cyan)]">Signal</div>
                        <div className="mt-2 text-2xl font-display text-white">42%</div>
                        <div className="mt-1 text-sm pp-dim">Current score on thermodynamics</div>
                      </div>
                      <div className="rounded-2xl border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.02)] p-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--pp-coral)]">Next action</div>
                        <div className="mt-2 text-lg font-semibold text-white">Run a timed mock test</div>
                        <div className="mt-1 text-sm pp-dim">15 questions · 18 minutes · review enabled</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {['Quiz', 'Flashcards', 'Mock test', 'Roadmap'].map((item) => (
                      <span key={item} className="rounded-full border border-[rgba(130,147,183,0.16)] px-3 py-1.5 text-xs pp-dim">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 grid lg:grid-cols-3 gap-4">
            {FEATURE_CARDS.map((item, index) => (
              <div
                key={item.title}
                className={`pp-glass rounded-[1.75rem] p-6 pp-hover-rise ${index === 1 ? 'pp-cyan-ring' : ''}`}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold mb-5"
                  style={{ background: `${item.accent}1a`, color: item.accent, border: `1px solid ${item.accent}33` }}
                >
                  0{index + 1}
                </div>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 pp-muted">{item.desc}</p>
              </div>
            ))}
          </section>

          <section id="features" className="mt-20 grid lg:grid-cols-[0.92fr_1.08fr] gap-8 items-start">
            <div className="pp-glass-strong rounded-[2rem] p-6 sm:p-8">
              <div className="pp-section-label">Command flow</div>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-white">
                A faster path from
                <span className="pp-gradient-text"> upload</span> to exam-ready.
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-8 pp-muted">
                The reference site works because it feels like a real operating surface. PrepPal now follows the same idea:
                each panel should suggest action, progress, and control instead of looking like a generic SaaS card grid.
              </p>

              <div className="mt-8 space-y-4">
                {COMMAND_STEPS.map((step, index) => (
                  <div key={step.cmd} className="rounded-2xl border border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-white">{step.label}</span>
                      <span className="pp-kbd">0{index + 1}</span>
                    </div>
                    <div className="mt-3 pp-mono text-sm text-[var(--pp-cyan)]">$ {step.cmd}</div>
                    <p className="mt-2 text-sm leading-7 pp-muted">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {STUDY_SYSTEM.map((item, index) => (
                <div key={item.title} className={`pp-glass rounded-[1.75rem] p-6 pp-hover-rise ${index % 2 === 0 ? 'pp-cyan-ring' : ''}`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="pp-section-label">{item.meta}</span>
                    <span className="text-xs tracking-[0.22em] uppercase pp-dim">Module {index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 pp-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
              <div>
                <div className="pp-section-label">Everything from one PDF</div>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-white">
                  One upload powers the whole
                  <span className="pp-gradient-text"> study system.</span>
                </h2>
              </div>
              <div className="text-sm pp-dim max-w-md">
                No fake dashboards. No vanity metrics. Just tools that help you understand, test, and retain your actual syllabus.
              </div>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                {
                  title: 'Chat tutor',
                  desc: 'Ask questions from your chapter and get revision-ready answers instead of broad internet fluff.',
                  accent: 'text-[var(--pp-cyan)]',
                },
                {
                  title: 'Quiz engine',
                  desc: 'Generate drill sets for one topic or the whole file when you need quick active recall.',
                  accent: 'text-[var(--pp-coral)]',
                },
                {
                  title: 'Mock tests',
                  desc: 'Switch into timed mode before an exam and see where speed or confidence is slipping.',
                  accent: 'text-[var(--pp-cyan)]',
                },
                {
                  title: 'Weakness tracking',
                  desc: 'Spot the chapters dragging down your score instead of revising everything evenly.',
                  accent: 'text-[var(--pp-coral)]',
                },
              ].map((card) => (
                <div key={card.title} className="pp-glass rounded-[1.75rem] p-6 pp-hover-rise">
                  <div className={`text-[11px] uppercase tracking-[0.26em] ${card.accent}`}>Capability</div>
                  <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-white">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 pp-muted">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="pp-glass-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
              <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-center">
                <div>
                  <div className="pp-section-label">Pricing in the same style</div>
                  <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-white">
                    Less dashboard noise.
                    <span className="pp-gradient-text"> More study time.</span>
                  </h2>
                  <p className="mt-4 text-sm sm:text-base leading-8 pp-muted">
                    The new theme keeps the interface premium and high-signal, but the offer stays simple: get started free, upgrade only if you need more volume.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm pp-dim">
                    <span className="pp-pill">No credit card</span>
                    <span className="pp-pill">Free during early access</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { plan: 'Free', price: '₹0', desc: '3 PDFs · daily practice', highlight: false },
                    { plan: 'Pro', price: '₹99', desc: 'Unlimited quizzes, chat, mocks', highlight: true },
                    { plan: 'Institute', price: '₹999', desc: 'For coaching teams and batches', highlight: false },
                  ].map((tier) => (
                    <div
                      key={tier.plan}
                      className={`rounded-[1.75rem] p-5 border ${tier.highlight ? 'border-[rgba(255,118,105,0.4)] bg-[linear-gradient(180deg,rgba(255,118,105,0.16),rgba(8,14,26,0.82))] shadow-[0_16px_48px_rgba(255,118,105,0.18)]' : 'border-[rgba(130,147,183,0.18)] bg-[rgba(255,255,255,0.03)]'}`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.26em] pp-dim">{tier.plan}</div>
                      <div className="mt-4 font-display text-4xl font-semibold text-white">{tier.price}</div>
                      <div className="mt-1 text-sm pp-dim">per month</div>
                      <p className="mt-5 text-sm leading-7 pp-muted">{tier.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-20">
            <div className="pp-terminal relative">
              <div className="pp-terminal-bar">
                <span className="pp-terminal-dot bg-[#ff5f57]" />
                <span className="pp-terminal-dot bg-[#febc2e]" />
                <span className="pp-terminal-dot bg-[#28c840]" />
                <div className="ml-3 text-xs tracking-[0.28em] uppercase pp-dim">launch.preppal</div>
              </div>
              <div className="p-7 sm:p-10 text-center">
                <div className="pp-section-label justify-center">Final call</div>
                <h2 className="mt-4 font-display text-3xl sm:text-5xl font-semibold tracking-[-0.05em] text-white">
                  Upload your first PDF and
                  <span className="pp-gradient-text"> flip the system on.</span>
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-8 pp-muted">
                  No demo maze. No fake “AI magic.” Just give PrepPal your material and let it start teaching, testing, and tracking from there.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                  <button onClick={onGetStarted} className="pp-button-primary px-6 py-4 text-base">
                    Continue with Google
                  </button>
                  <button onClick={onGetStarted} className="pp-button-secondary px-6 py-4 text-base">
                    Sign up with email
                  </button>
                </div>
                <div className="mt-5 text-xs tracking-[0.18em] uppercase pp-dim">
                  Free forever to start · Built for intense revision
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
          <div className="pp-glass rounded-[1.75rem] px-5 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="font-display text-xl font-semibold text-white">PrepPal</div>
              <div className="mt-1 text-xs tracking-[0.24em] uppercase pp-dim">Study command center</div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm pp-muted">
              <button onClick={onShowPrivacy} className="hover:text-[var(--pp-cyan)] transition-colors">
                Privacy Policy
              </button>
              <button onClick={onShowTerms} className="hover:text-[var(--pp-cyan)] transition-colors">
                Terms & Conditions
              </button>
              <button onClick={onLogin} className="hover:text-[var(--pp-coral)] transition-colors">
                Log in
              </button>
            </div>
            <div className="text-xs tracking-[0.18em] uppercase pp-dim">© 2026 PrepPal</div>
          </div>
        </footer>
      </div>
    </div>
  )
}
