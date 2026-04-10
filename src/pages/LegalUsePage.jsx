const SECTIONS = [
  {
    title: 'Acceptance of these terms',
    points: [
      'By accessing or using PrepPal, you agree to be bound by these Terms and Conditions.',
      'If you do not agree with these terms, please do not use the platform.',
    ],
  },
  {
    title: 'Use of the service',
    points: [
      'PrepPal is intended to help users study by generating AI-supported learning tools from uploaded materials.',
      'You agree to use the service lawfully, responsibly, and only with content you have the right to upload or process.',
      'You must not misuse the platform, interfere with its operation, attempt unauthorized access, or use it to infringe the rights of others.',
    ],
  },
  {
    title: 'Accounts and access',
    points: [
      'You are responsible for maintaining the confidentiality of your login credentials and for activities that occur under your account.',
      'We may suspend or restrict access if we detect abuse, security risks, non-payment for paid features, or violations of these terms.',
    ],
  },
  {
    title: 'AI-generated output',
    points: [
      'PrepPal uses automated systems to generate quizzes, flashcards, study plans, and answers from your uploaded content.',
      'AI-generated output may contain inaccuracies, omissions, or outdated interpretations, so you should review it before relying on it.',
      'PrepPal is a study aid and does not replace your own academic judgment, teachers, institutional guidance, or professional advice.',
    ],
  },
  {
    title: 'Content ownership',
    points: [
      'You retain ownership of the content you upload, subject to the rights needed for us to host, process, and analyze it to operate the service.',
      'You grant PrepPal a limited license to use uploaded content solely for delivering and improving the requested features.',
    ],
  },
  {
    title: 'Payments and plans',
    points: [
      'Some features may be offered under free or paid plans. Pricing, billing terms, and feature access may change over time.',
      'If paid plans are offered, you agree to any applicable pricing and billing terms presented at the time of purchase.',
    ],
  },
  {
    title: 'Disclaimers and limitation of liability',
    points: [
      'PrepPal is provided on an as-available and as-is basis to the extent permitted by law.',
      'We do not guarantee uninterrupted access, perfect accuracy, or that the service will meet every academic or institutional requirement.',
      'To the extent permitted by law, PrepPal will not be liable for indirect, incidental, special, consequential, or reliance damages arising from use of the service.',
    ],
  },
  {
    title: 'Changes to the service or terms',
    points: [
      'We may update the platform, discontinue features, or revise these terms from time to time.',
      'Your continued use of PrepPal after updated terms become effective means you accept the revised terms.',
    ],
  },
  {
    title: 'Contact',
    points: [
      'Questions about these Terms and Conditions can be directed to the PrepPal support channel listed in the app or website.',
    ],
  },
]

export default function LegalUsePage({ onBack, onOpenAuth }) {
  return (
    <div className="min-h-screen bg-zinc-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            ← Back
          </button>
          <div className="font-bold text-lg text-zinc-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            Prep<span className="text-violet-600">Pal</span>
          </div>
          <button
            onClick={onOpenAuth}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: '#111110' }}
          >
            Get started
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
        <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6 sm:p-10">
          <div className="mb-10">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-violet-500 mb-3">Legal</div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight mb-3"
              style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.03em' }}
            >
              Terms & Conditions
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">
              Effective April 10, 2026. These Terms and Conditions govern your access to and use of PrepPal.
            </p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2
                  className="text-xl font-semibold text-zinc-900 mb-3"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {section.title}
                </h2>
                <div className="space-y-3">
                  {section.points.map((point) => (
                    <p key={point} className="text-sm text-zinc-600 leading-7">
                      {point}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
