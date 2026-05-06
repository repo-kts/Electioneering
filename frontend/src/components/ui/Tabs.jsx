export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ key, label, Icon, count, disabled }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          disabled={disabled}
          className={`tab ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          {Icon && <Icon width="16" height="16" />}
          {label}
          {count != null && <span className="tab-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
