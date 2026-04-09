export default function AppLoader({ subtitle = '', fullScreen = false, overlay = false }) {
  const containerClassName = fullScreen
    ? 'fixed inset-0 z-[120] flex items-center justify-center bg-stone-50 px-6'
    : overlay
      ? 'absolute inset-0 z-20 flex items-center justify-center bg-stone-50/90 px-6 backdrop-blur-[1px]'
      : 'flex items-center justify-center px-6 py-10'

  return (
    <div
      className={containerClassName}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="7" fill="#6c63ff" />
          <path d="M8 21 L8 11 Q16 9 16 11 L16 21" fill="white" opacity="0.95" />
          <path d="M24 21 L24 11 Q16 9 16 11 L16 21" fill="white" opacity="0.72" />
          <path d="M8 21 Q16 23.5 24 21" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <circle cx="21" cy="7.5" r="1.8" fill="white" />
        </svg>

        <div className="font-display text-xl font-bold tracking-tight text-zinc-900">
          Prep<span className="text-violet-600">Pal</span>
        </div>

        {subtitle ? (
          <div className="max-w-xs text-sm leading-relaxed text-zinc-400">
            {subtitle}
          </div>
        ) : null}

        <div className="flex gap-1.5">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              style={{ animationDelay: `${index * 0.15}s` }}
              className="h-1.5 w-1.5 rounded-full bg-violet-500 opacity-40 animate-[preppal-loader-bounce_1s_infinite]"
            />
          ))}
        </div>

        <style>{`@keyframes preppal-loader-bounce { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-6px);opacity:1} }`}</style>
      </div>
    </div>
  )
}
