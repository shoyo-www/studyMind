import { NAV_ITEMS } from '../data'
import { useT } from '../i18n'
import { getDisplayName, getPlanLabel } from '../lib/documents'
import LanguageSwitcher from './LanguageSwitcher'

const icons = {
  dashboard:  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>,
  upload:     <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5V10M7.5 1.5L4.5 4.5M7.5 1.5L10.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 11V12.5C1.5 13.0523 1.94772 13.5 2.5 13.5H12.5C13.0523 13.5 13.5 13.0523 13.5 12.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  roadmap:    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7.5 4V6M7.5 9V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  quiz:       <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2.5C2 1.67157 2.67157 1 3.5 1H11.5C12.3284 1 13 1.67157 13 2.5V13.5L10.5 12L7.5 13.5L4.5 12L2 13.5V2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 5.5H10M5 8H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  flashcards: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M4 3.5C4 2.67157 4.67157 2 5.5 2H11C11.8284 2 12.5 2.67157 12.5 3.5V10.5C12.5 11.3284 11.8284 12 11 12H5.5C4.67157 12 4 11.3284 4 10.5V3.5Z" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 5V11C2.5 11.8284 3.17157 12.5 4 12.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M6 5.5H10.5M6 8H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  progress:   <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 11L5 7.5L8 10.5L13.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pricing:    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M7.5 4V5M7.5 10V11M5.5 8.5C5.5 9.33 6.39 10 7.5 10C8.61 10 9.5 9.33 9.5 8.5C9.5 7.67 8.61 7 7.5 7C6.39 7 5.5 6.33 5.5 5.5C5.5 4.67 6.39 4 7.5 4C8.61 4 9.5 4.67 9.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
}

export default function Sidebar({ screen, setScreen, user, profile, onClose }) {
  const { t, lang } = useT()
  let lastSection = null
  const displayName = getDisplayName(profile, user)
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const planLabel = getPlanLabel(profile?.plan, lang)

  return (
    <aside className="w-64 sm:w-56 shrink-0 bg-white border-r border-zinc-100 flex flex-col h-full">
      {/* Logo + close button on mobile */}
      <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-xl tracking-tight text-zinc-900">
            Study<span className="text-violet-600">Mind</span>
          </div>
          <div className="text-xs text-zinc-400 mt-0.5 font-light">AI-powered learning</div>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const showSection = item.section && item.section !== lastSection
          if (item.section) lastSection = item.section
          const active = screen === item.id
          return (
            <div key={item.id}>
              {showSection && (
                <div className="px-6 pt-4 pb-1.5 text-[10px] font-medium tracking-widest text-zinc-300 uppercase">
                  {t(`nav.${item.section.toLowerCase()}`)}
                </div>
              )}
              <button
                onClick={() => setScreen(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-all text-left
                  ${active
                    ? 'text-violet-600 bg-violet-50 border-r-2 border-violet-500 font-medium'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
                  }`}
              >
                <span className={active ? 'text-violet-600' : 'text-zinc-300'}>{icons[item.id]}</span>
                {t(`nav.${item.id}`)}
              </button>
            </div>
          )
        })}
      </nav>

      <div className="px-4 pb-2">
        <LanguageSwitcher compact />
      </div>
      <div className="px-5 py-4 border-t border-zinc-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700 shrink-0">
          {avatarLetter || 'S'}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-800 truncate">{displayName}</div>
          <div className="text-xs text-zinc-400">{planLabel || t('auth.freePlan')}</div>
        </div>
      </div>
    </aside>
  )
}
