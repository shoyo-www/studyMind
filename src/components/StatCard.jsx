export default function StatCard({ label, value, change }) {
  return (
    <div className="pp-app-card rounded-2xl p-4 sm:p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted mb-1.5">{label}</div>
      <div className="font-display font-semibold text-xl sm:text-2xl text-white">{value}</div>
      {change && <div className="text-xs text-[var(--pp-cyan)] mt-1">{change}</div>}
    </div>
  )
}
