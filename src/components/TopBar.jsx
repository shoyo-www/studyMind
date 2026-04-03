import LanguageSwitcher from './LanguageSwitcher'

export default function TopBar({ title, subtitle, action, showLangSwitcher = false, onOpenSidebar }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-8 py-4 sm:py-5 border-b border-zinc-100 bg-white shrink-0">
      {/* Hamburger — mobile only */}
      {onOpenSidebar && (
        <button
          onClick={onOpenSidebar}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="font-display font-semibold text-base sm:text-lg text-zinc-900 tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-zinc-400 mt-0.5 truncate hidden sm:block">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {showLangSwitcher && <div className="hidden sm:block"><LanguageSwitcher /></div>}
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}
