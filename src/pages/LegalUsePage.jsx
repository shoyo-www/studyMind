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
    <div className="pp-public-shell" style={{ fontFamily: "'Satoshi', 'DM Sans', system-ui, sans-serif" }}>
      <div className="pp-content">
        <div className="sticky top-0 z-20 px-4 pt-5 sm:px-6">
          <div className="max-w-5xl mx-auto pp-glass rounded-full px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <button
              onClick={onBack}
              className="pp-button-secondary px-4 py-2 text-sm"
            >
              ← Back
            </button>
            <div className="text-center">
              <div className="font-display text-lg font-semibold text-white">PrepPal</div>
              <div className="text-[10px] uppercase tracking-[0.26em] pp-dim">Terms</div>
            </div>
            <button
              onClick={onOpenAuth}
              className="pp-button-primary px-4 py-2 text-sm"
            >
              Get started
            </button>
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
          <div className="pp-glass-strong rounded-[2rem] p-6 sm:p-10">
            <div className="mb-10">
              <div className="pp-section-label mb-4">Legal document</div>
              <h1
                className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-[-0.05em] mb-4"
              >
                Terms &
                <span className="pp-gradient-text"> Conditions</span>
              </h1>
              <p className="text-sm sm:text-base pp-muted leading-8 max-w-3xl">
                Effective April 10, 2026. These Terms and Conditions govern your access to and use of PrepPal.
              </p>
            </div>

            <div className="space-y-6">
              {SECTIONS.map((section) => (
                <section key={section.title} className="rounded-[1.5rem] border border-[rgba(130,147,183,0.16)] bg-[rgba(255,255,255,0.02)] p-5 sm:p-6">
                  <h2
                    className="font-display text-2xl font-semibold text-white tracking-[-0.03em] mb-4"
                  >
                    {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.points.map((point) => (
                      <p key={point} className="text-sm sm:text-[15px] text-[var(--pp-text-soft)] leading-8">
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
    </div>
  )
}
