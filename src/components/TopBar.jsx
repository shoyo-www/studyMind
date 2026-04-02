import LanguageSwitcher from './LanguageSwitcher'

export default function TopBar({ title, subtitle, action, showLangSwitcher = false }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 bg-white shrink-0">
      <div>
        <h1 className="font-display font-semibold text-lg text-zinc-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {showLangSwitcher && <LanguageSwitcher />}
        {action && <div>{action}</div>}
      </div>
    </div>
  )
}
