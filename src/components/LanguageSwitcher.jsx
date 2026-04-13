import { useT } from '../i18n'

export default function LanguageSwitcher({ compact = false }) {
  const { lang, setLang } = useT()
  const languages = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi',   native: 'हिंदी',   flag: '🇮🇳' },
  ]

  if (compact) {
    const other = lang === 'en' ? languages[1] : languages[0]
    return (
      <button
        onClick={() => setLang(other.code)}
        className="flex items-center gap-2 text-xs pp-app-muted hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5 w-full"
        title={`Switch to ${other.label}`}
      >
        <span className="text-sm">{other.flag}</span>
        <span>{other.native}</span>
        <span className="ml-auto text-[var(--pp-text-muted)]">⇄</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-xl p-1 border pp-app-border bg-white/5">
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
            ${lang === l.code
              ? 'bg-[rgba(255,118,105,0.16)] text-white shadow-sm'
              : 'text-[var(--pp-text-soft)] hover:text-white'
            }`}
        >
          <span>{l.flag}</span>
          <span>{l.native}</span>
        </button>
      ))}
    </div>
  )
}
