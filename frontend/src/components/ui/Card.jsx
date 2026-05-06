export default function Card({ children, className = '', hover = false, flat = false }) {
  const cls = ['card', hover && 'hover', flat && 'flat', className]
    .filter(Boolean)
    .join(' ');
  return <div className={cls}>{children}</div>;
}

Card.Head = function CardHead({ title, subtitle, action, children }) {
  return (
    <div className="card-head">
      <div>
        {title && <h2>{title}</h2>}
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      {action}
    </div>
  );
};

Card.Body = function CardBody({ children, style, className = '' }) {
  return (
    <div className={`card-body ${className}`.trim()} style={style}>
      {children}
    </div>
  );
};

Card.Foot = function CardFoot({ children }) {
  return <div className="card-foot">{children}</div>;
};
