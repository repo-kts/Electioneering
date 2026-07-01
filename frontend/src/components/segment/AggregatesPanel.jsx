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
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
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
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="space-y-1.5">
        {top.map((it) => {
          const pct = total ? Math.round((it.count / total) * 100) : 0;
          return (
            <div key={it.key} className="flex items-center gap-2 text-sm" title={`${it.count} (${pct}%)`}>
              <div className="w-24 truncate text-slate-600">{it.key}</div>
              <div className="h-1.5 flex-1 overflow-hidden bg-slate-200">
                <div className="h-full bg-accent-600" style={{ width: `${(it.count / max) * 100}%` }} />
              </div>
              <div className="w-8 text-right tabular-nums text-slate-500">{it.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
