export default function Card({ children, className = '', hover = false, flat = false }) {
  const cls = [
    'bg-white',
    flat ? 'border border-slate-300' : 'border border-slate-300',
    hover && 'transition hover:border-slate-400',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={cls}>{children}</div>;
}

Card.Head = function CardHead({ title, subtitle, action, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
      <div>
        {title && <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>}
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
        {children}
      </div>
      {action}
    </div>
  );
};

Card.Body = function CardBody({ children, style, className = '' }) {
  return (
    <div className={`p-5 ${className}`.trim()} style={style}>
      {children}
    </div>
  );
};

Card.Foot = function CardFoot({ children }) {
  return <div className="border-t border-slate-200 px-5 py-3">{children}</div>;
};
