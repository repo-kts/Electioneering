const TONE = {
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  success: 'text-emerald-600',
};

export default function StatGroup({ items }) {
  return (
    <div className="grid grid-cols-2 border border-slate-300 bg-white sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-b border-r border-slate-200 p-4 last:border-r-0 sm:border-b-0">
          <div className={`text-2xl font-semibold tabular-nums ${TONE[item.tone] ?? 'text-slate-900'}`}>
            {item.value}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
