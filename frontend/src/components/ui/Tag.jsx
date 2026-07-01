const TONE = {
  default: 'border-slate-300 bg-white text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-accent-50 text-accent-700',
};

const DOT_TONE = {
  default: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-accent-600',
};

export default function Tag({ tone = 'default', dot = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium ${TONE[tone] ?? TONE.default} ${className}`.trim()}
    >
      {dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_TONE[tone] ?? DOT_TONE.default}`} />}
      {children}
    </span>
  );
}
