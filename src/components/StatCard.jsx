export default function StatCard({ label, value, change }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-xl p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-2">{label}</div>
      <div className="font-display font-semibold text-2xl text-zinc-900">{value}</div>
      {change && <div className="text-xs text-emerald-500 mt-1">{change}</div>}
    </div>
  )
}
