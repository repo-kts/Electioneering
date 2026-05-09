import Card from '../ui/Card.jsx';

const COLS = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'age', label: 'Age', short: true },
  { key: 'gender', label: 'Gender', short: true },
  { key: 'epic', label: 'EPIC' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'community', label: 'Community' },
  { key: 'religion', label: 'Religion', short: true },
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
        subtitle={
          busy
            ? 'Loading…'
            : 'Predicted leader shown based on the latest Form 20 of each voter\'s polling station.'
        }
      />
      <Card.Body>
        <div className="grid-wrap">
          <table className="voter-grid excel-compact">
            <thead>
              <tr>
                <th className="row-num">#</th>
                {COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Predicted</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v, i) => (
                <tr key={v.id}>
                  <td className="row-num">{i + 1}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="value">
                      <span style={{ padding: '0 8px' }}>{v[c.key] ?? ''}</span>
                    </td>
                  ))}
                  <td className="value">
                    <span style={{ padding: '0 8px' }}>{leaderCell(v)}</span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !busy && (
                <tr>
                  <td colSpan={COLS.length + 2} className="grid-empty">
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
