export default function StatGroup({ items }) {
  return (
    <div className="stat-group">
      {items.map((item) => (
        <div key={item.label}>
          <div className={`stat-num tnum ${item.tone || ''}`.trim()}>{item.value}</div>
          <div className="stat-lbl">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
