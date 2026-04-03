// Shows on mobile at the bottom — quick access to 5 key screens
const ITEMS = [
  {
    id: 'dashboard',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
    label: 'Home',
  },
  {
    id: 'upload',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3V13M10 3L6.5 6.5M10 3L13.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 15.5H16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
    label: 'Upload',
  },
  {
    id: 'quiz',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 3.5C3 2.67 3.67 2 4.5 2H15.5C16.33 2 17 2.67 17 3.5V17.5L14 16L10.5 17.5L7 16L4 17.5V3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M7 7.5H13M7 11H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
    label: 'Quiz',
  },
  {
    id: 'flashcards',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="4" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3.5 7V14C3.5 14.83 4.17 15.5 5 15.5H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M8 8.5H13.5M8 11H11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
    label: 'Cards',
  },
  {
    id: 'progress',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2.5 14L7 9.5L10.5 13L15.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    label: 'Progress',
  },
]

export default function BottomNav({ screen, setScreen }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-100 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {ITEMS.map(item => {
        const active = screen === item.id
        return (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
          >
            <span className={`transition-colors ${active ? 'text-violet-600' : 'text-zinc-400'}`}>
              {item.icon}
            </span>
            <span className={`text-[10px] font-medium transition-colors ${active ? 'text-violet-600' : 'text-zinc-400'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
