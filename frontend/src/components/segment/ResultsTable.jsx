import Card from '../ui/Card.jsx';

const COLS = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'age', label: 'Age', short: true },
  { key: 'gender', label: 'Gender', short: true },
  { key: 'epic', label: 'EPIC' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'community', label: 'Community' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'pollingStationName', label: 'Polling Stn' },
  { key: 'partNumber', label: 'Part', short: true },
];

function leaderCell(v) {
  const lean = v.predictedLeaning;
  if (!lean?.leader) return '—';
  const pct = ((lean.leaderShare ?? 0) * 100).toFixed(0);
  return `${lean.leader} · ${pct}%`;
}

export default function ResultsTable({ items, total, busy }) {
  return (
    <Card>
      <Card.Head
        title={`Voters (${items.length}${total != null && total !== items.length ? ' / ' + total : ''})`}
        subtitle={busy ? 'Loading…' : 'Predicted leader uses the latest Form 20 for each voter polling station.'}
      />
      <Card.Body>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">#</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-2 py-2 font-medium">{c.label}</th>
                ))}
                <th className="px-2 py-2 font-medium">Predicted</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v, i) => (
                <tr key={v.id} className="border-t border-slate-200 hover:bg-[#fbfaf7]">
                  <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 text-slate-700">{v[c.key] ?? ''}</td>
                  ))}
                  <td className="px-2 py-1.5 text-slate-700">{leaderCell(v)}</td>
                </tr>
              ))}
              {items.length === 0 && !busy && (
                <tr>
                  <td colSpan={COLS.length + 2} className="px-2 py-8 text-center text-slate-400">
                    No voters match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
