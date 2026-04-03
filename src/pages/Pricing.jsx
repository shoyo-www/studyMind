import TopBar from '../components/TopBar'
import { useT } from '../i18n'

const plans = [
  {
    name: 'Free', price: '₹0', period: 'forever', desc: 'Perfect to get started', accent: false, cta: 'Get started free',
    features: [
      { text: '3 document uploads/month',       included: true  },
      { text: 'Chat with notes (20 msgs/day)',   included: true  },
      { text: 'Auto quiz generation',            included: true  },
      { text: '1 learning roadmap',              included: true  },
      { text: 'Basic progress tracking',         included: true  },
      { text: 'Unlimited uploads',               included: false },
      { text: 'Unlimited AI chat',               included: false },
      { text: 'Flashcards & spaced rep.',        included: false },
      { text: 'Mock exam simulator',             included: false },
      { text: 'Priority support',                included: false },
    ],
  },
  {
    name: 'Pro', price: '₹199', period: 'per month', desc: 'For serious students', accent: true, badge: 'Most popular', cta: 'Start 7-day free trial',
    features: [
      { text: 'Unlimited document uploads',      included: true },
      { text: 'Unlimited AI chat',               included: true },
      { text: 'Auto quiz generation',            included: true },
      { text: 'Unlimited roadmaps',              included: true },
      { text: 'Full progress analytics',         included: true },
      { text: 'Flashcards & spaced rep.',        included: true },
      { text: 'Mock exam simulator',             included: true },
      { text: 'YouTube & URL import',            included: true },
      { text: 'Export notes as PDF',             included: true },
      { text: 'Priority support',                included: false },
    ],
  },
  {
    name: 'Institute', price: '₹999', period: 'per month', desc: 'For coaching centres', accent: false, cta: 'Contact us',
    features: [
      { text: 'Everything in Pro',               included: true },
      { text: 'Up to 25 student accounts',       included: true },
      { text: 'Teacher dashboard',               included: true },
      { text: 'Assign material to students',     included: true },
      { text: 'Batch quiz results',              included: true },
      { text: 'Custom branding',                 included: true },
      { text: 'API access',                      included: true },
      { text: 'Dedicated onboarding',            included: true },
      { text: 'Priority support',                included: true },
    ],
  },
]

const faqs = [
  { q: 'Can I cancel anytime?',                a: 'Yes, absolutely. No contracts, no hidden fees. Cancel from your account settings anytime.' },
  { q: "What happens to my data if I cancel?", a: 'Your uploaded documents and notes stay safe for 30 days after cancellation. You can export everything before that.' },
  { q: 'Is the ₹199/month price locked in?',   a: "Yes — if you subscribe now, your price is locked at ₹199/month even if we increase pricing later for new users." },
  { q: 'Does it work for all subjects?',        a: 'Yes! Upload any PDF, DOCX, or PPTX — Biology, Chemistry, Physics, History, Law, MBA prep — StudyMind works for all.' },
  { q: 'What payment methods do you accept?',  a: 'UPI, Debit/Credit card, Net Banking, and Paytm via Razorpay. All payments are 100% secure.' },
]

function CheckIcon({ included }) {
  if (included) return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="6.5" fill="#f0fdf4" stroke="#86efac"/>
      <path d="M4.5 7L6.5 9L9.5 5.5" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="6.5" fill="#fafafa" stroke="#e4e4e7"/>
      <path d="M9 5L5 9M5 5L9 9" stroke="#d4d4d8" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

export default function Pricing() {
  const { t } = useT()
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar onOpenSidebar={onOpenSidebar} title={t('pricing.title')} subtitle={t('pricing.subtitle')} />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-8">
        <div className="text-center mb-10 max-w-lg mx-auto">
          <h2 className="font-display font-bold text-3xl text-zinc-900 tracking-tight mb-3">
            {t('pricing.headline')}<br />
            <span className="text-violet-600">{t('pricing.headlineSub')}</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">{t('pricing.desc')}</p>
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('pricing.savingsBanner')}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto mb-8 sm:mb-12">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative flex flex-col rounded-2xl p-6 transition-all duration-200
              ${plan.accent ? 'bg-zinc-900 text-white border-2 border-zinc-800 shadow-xl shadow-zinc-900/10' : 'bg-white border border-zinc-100 hover:border-zinc-200'}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-violet-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
                </div>
              )}
              <div className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${plan.accent ? 'text-zinc-400' : 'text-zinc-300'}`}>{plan.name}</div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className={`font-display font-bold text-4xl ${plan.accent ? 'text-white' : 'text-zinc-900'}`}>{plan.price}</span>
                <span className={`text-sm ${plan.accent ? 'text-zinc-400' : 'text-zinc-400'}`}>/{plan.period}</span>
              </div>
              <p className={`text-sm mb-6 ${plan.accent ? 'text-zinc-400' : 'text-zinc-400'}`}>{plan.desc}</p>
              <button className={`w-full py-2.5 rounded-xl text-sm font-medium mb-6 transition-all duration-150
                ${plan.accent ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'}`}>
                {plan.cta}
              </button>
              <div className={`h-px mb-5 ${plan.accent ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
              <ul className="flex flex-col gap-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    <CheckIcon included={f.included} />
                    <span className={`text-sm leading-snug ${f.included ? (plan.accent ? 'text-zinc-200' : 'text-zinc-600') : (plan.accent ? 'text-zinc-600 line-through' : 'text-zinc-300 line-through')}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-violet-50 border border-violet-100 rounded-2xl px-6 py-5 flex items-start gap-4">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0 text-sm">💡</div>
            <div>
              <div className="text-sm font-medium text-violet-900 mb-1">{t('pricing.whyTitle')}</div>
              <p className="text-sm text-violet-700 leading-relaxed">{t('pricing.whyDesc')}</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 text-center mb-6">{t('pricing.faq')}</div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white border border-zinc-100 rounded-xl px-5 py-4">
                <div className="text-sm font-medium text-zinc-800 mb-1.5">{faq.q}</div>
                <div className="text-sm text-zinc-400 leading-relaxed">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto text-center pb-4">
          <div className="bg-zinc-900 rounded-2xl px-8 py-8">
            <div className="font-display font-bold text-xl text-white mb-2">{t('pricing.ctaTitle')}</div>
            <p className="text-zinc-400 text-sm mb-5">{t('pricing.ctaSub')}</p>
            <div className="flex gap-3 justify-center">
              <button className="px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-500 transition-colors">
                {t('pricing.ctaBtn')}
              </button>
              <button className="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-xl hover:bg-zinc-700 transition-colors">
                {t('pricing.demoBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
