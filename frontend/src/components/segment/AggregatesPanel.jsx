import Card from '../ui/Card.jsx';

/**
 * AggregatesPanel — compact bar-chart distributions across the result set.
 * Renders multiple stacked groups (community / age / etc.).
 */
export default function AggregatesPanel({ aggregates, total }) {
  if (!aggregates) return null;
  const groups = [
    { title: 'Community', items: aggregates.byCommunity },
    { title: 'Age', items: aggregates.byAgeBucket },
    { title: 'Gender', items: aggregates.byGender },
    { title: 'Occupation', items: aggregates.byOccupation },
    { title: 'Language', items: aggregates.byLanguage },
    { title: 'Polling station', items: aggregates.byPollingStation },
    { title: 'Predicted leader', items: aggregates.byPredictedLeader },
  ];
  return (
    <Card>
      <Card.Head
        title="Distribution"
        subtitle={`${total ?? 0} voter${total === 1 ? '' : 's'} matched`}
      />
      <Card.Body>
        <div className="seg-agg-grid">
          {groups.map((g) => (
            <Group key={g.title} title={g.title} items={g.items ?? []} total={total ?? 0} />
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

function Group({ title, items, total }) {
  if (items.length === 0) return null;
  const top = items.slice(0, 8);
  const max = Math.max(1, ...top.map((x) => x.count));
  return (
    <div className="seg-agg-group">
      <div className="seg-agg-title">{title}</div>
      <div className="seg-agg-bars">
        {top.map((it) => {
          const pct = total ? Math.round((it.count / total) * 100) : 0;
          return (
            <div key={it.key} className="seg-agg-row" title={`${it.count} (${pct}%)`}>
              <div className="seg-agg-label">{it.key}</div>
              <div className="seg-agg-track">
                <div
                  className="seg-agg-fill"
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
              <div className="seg-agg-num">{it.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
