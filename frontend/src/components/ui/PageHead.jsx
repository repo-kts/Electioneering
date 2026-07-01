export default function PageHead({ title, subtitle, badge, actions, stats, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-5">
      <div>
        {(title || badge) && (
          <div className="flex items-center gap-2">
            {title && <h1 className="text-[26px] font-semibold text-slate-950">{title}</h1>}
            {badge}
          </div>
        )}
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{subtitle}</p>}
        {children}
      </div>
      {(actions || stats) && (
        <div className="flex flex-wrap items-center gap-2">
          {stats}
          {actions}
        </div>
      )}
    </div>
  );
}
