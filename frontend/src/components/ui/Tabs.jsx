export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-5 border-b border-slate-300" role="tablist">
      {tabs.map(({ key, label, Icon, count, disabled }) => {
        const on = active === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={on}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-0 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
              on
                ? 'border-slate-950 text-slate-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {Icon && <Icon width="16" height="16" />}
            {label}
            {count != null && (
              <span className="border border-slate-300 bg-white px-1.5 text-xs text-slate-600">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
