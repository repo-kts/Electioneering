export default function PageHead({ title, subtitle, badge, actions, stats, children }) {
  return (
    <div className="page-head">
      <div>
        {(title || badge) && (
          <div className="page-head-left">
            {title && <h1>{title}</h1>}
            {badge}
          </div>
        )}
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      {(actions || stats) && (
        <div className="page-head-actions">
          {stats}
          {actions}
        </div>
      )}
    </div>
  );
}
