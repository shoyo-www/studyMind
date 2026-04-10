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
            Log in
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
              Privacy Policy
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">
              Effective April 10, 2026. This Privacy Policy explains how PrepPal collects, uses, stores, and shares information when you use the platform.
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
