import { Spinner } from './Loader.jsx';
import InfoButton from './InfoButton.jsx';

const TONE = {
  default: 'text-slate-900',
  green: 'text-accent-700',
  red: 'text-rose-700',
  accent: 'text-accent-600',
  amber: 'text-amber-700',
};

// `meta` is an optional node rendered under the title, inside the header block —
// for pages that want controls/chips there instead of a prose subtitle.
export function PageHeader({ eyebrow, title, subtitle, meta, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-5">
      <div>
        {eyebrow && (
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] font-semibold leading-tight text-slate-950">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{subtitle}</p>}
        {meta && <div className="mt-3">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = 'default', accent }) {
  return (
    <div className="border-l border-slate-300 bg-white px-4 py-3 first:border-l-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className={`mt-2 truncate text-[24px] font-semibold leading-none tabular-nums ${TONE[tone] ?? TONE.default}`} title={String(value)}>
        {value}
      </div>
      {sub && <div className="mt-1.5 truncate text-xs text-slate-500">{sub}</div>}
      {accent && <div className="mt-3 h-px w-8" style={{ background: accent }} />}
    </div>
  );
}

// `info` renders an (i) button in the header that explains the panel/chart on
// hover. `right` is any header-right content (view toggles, selects, …).
export function Surface({ eyebrow, title, subtitle, right, info, children, className = '', bodyClass = 'p-5' }) {
  return (
    <section className={`overflow-hidden border border-slate-300 bg-white ${className}`}>
      {(title || right || info) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
          <div>
            {eyebrow && (
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</div>
            )}
            {title && <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
          </div>
          {(right || info) && (
            <div className="flex shrink-0 items-center gap-2">
              {right}
              {info && <InfoButton text={info} />}
            </div>
          )}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Pill({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function Button({ children, variant = 'secondary', className = '', ...props }) {
  const styles = {
    primary: 'bg-slate-950 text-white hover:bg-slate-800',
    accent: 'bg-accent-700 text-white hover:bg-accent-600',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-[#f7f5f0]',
    ghost: 'text-slate-700 hover:bg-white',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Loading({ className = 'h-40', label = 'Loading data…' }) {
  return (
    <div className={`flex items-center justify-center border border-slate-200 bg-white ${className}`} role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <Spinner size={20} />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ErrorBox({ message, title = 'Unable to load data', onRetry }) {
  return (
    <div className="border border-rose-200 bg-rose-50 p-4" role="alert">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-rose-600 text-xs font-bold text-white">!</span>
        <strong className="text-sm text-rose-800">{title}</strong>
      </div>
      <div className="mt-2 text-sm text-rose-700">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}
