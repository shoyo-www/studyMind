const SECTIONS = [
  {
    title: 'Information we collect',
    points: [
      'Account details such as your name, email address, and authentication information when you create or access a PrepPal account.',
      'Study content you upload, including PDFs, notes, quiz attempts, flashcards, roadmap activity, and progress data.',
      'Basic technical information such as browser type, device details, approximate usage analytics, and error logs that help us keep the service stable.',
    ],
  },
  {
    title: 'How we use your information',
    points: [
      'To provide the product features you request, including document analysis, AI chat, quizzes, flashcards, mock tests, and study progress tracking.',
      'To maintain account security, prevent abuse, troubleshoot issues, and improve performance, reliability, and user experience.',
      'To communicate important service updates, account notices, or support responses related to your use of PrepPal.',
    ],
  },
  {
    title: 'How your study content is handled',
    points: [
      'Uploaded materials are processed so PrepPal can generate learning tools based on your documents.',
      'We work to limit access to your content to the systems and service providers needed to deliver the product.',
      'You should only upload materials you are authorized to use and share for study purposes.',
    ],
  },
  {
    title: 'Sharing and disclosures',
    points: [
      'We do not sell your personal information.',
      'We may share limited information with infrastructure, analytics, authentication, and AI service providers that help us operate PrepPal.',
      'We may disclose information when required by law, to enforce our terms, or to protect users, our platform, or the public.',
    ],
  },
  {
    title: 'Data retention',
    points: [
      'We keep account and study data for as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce agreements.',
      'If you request deletion or close your account, we may delete or anonymize eligible data within a reasonable period, subject to operational or legal requirements.',
    ],
  },
  {
    title: 'Your choices',
    points: [
      'You can choose what study materials you upload and whether you continue using the platform.',
      'You may contact us to request account-related help, updates, or deletion requests where available.',
      'Because AI-generated study tools are automated, you should review outputs before relying on them for important academic decisions.',
    ],
  },
  {
    title: 'Contact',
    points: [
      'If you have questions about this Privacy Policy, contact the PrepPal team through the support channel provided in the app or website.',
      'This policy may be updated from time to time. Continued use of PrepPal after changes take effect means the updated policy will apply.',
    ],
  },
]

export default function LegalDataPage({ onBack, onOpenAuth }) {
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
              <div className="text-[10px] uppercase tracking-[0.26em] pp-dim">Privacy</div>
            </div>
            <button
              onClick={onOpenAuth}
              className="pp-button-primary px-4 py-2 text-sm"
            >
              Log in
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
                Privacy
                <span className="pp-gradient-text"> Policy</span>
              </h1>
              <p className="text-sm sm:text-base pp-muted leading-8 max-w-3xl">
                Effective April 10, 2026. This Privacy Policy explains how PrepPal collects, uses, stores, and shares
                information when you use the platform.
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
