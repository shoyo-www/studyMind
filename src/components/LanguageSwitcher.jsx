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
        className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-50 w-full"
        title={`Switch to ${other.label}`}
      >
        <span className="text-sm">{other.flag}</span>
        <span>{other.native}</span>
        <span className="ml-auto text-zinc-300">⇄</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
            ${lang === l.code
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-600'
            }`}
        >
          <span>{l.flag}</span>
          <span>{l.native}</span>
        </button>
      ))}
    </div>
  )
}
