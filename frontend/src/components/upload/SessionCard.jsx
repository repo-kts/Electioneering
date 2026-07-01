import { session } from '../../data/history.js';
import Card from '../ui/Card.jsx';

const ROWS = [
  { key: 'User', val: (s) => s.user },
  {
    key: 'Role',
    val: (s) => (
      <span className="inline-flex items-center gap-2">
        {s.role}
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
      </span>
    ),
  },
  { key: 'Region', val: (s) => s.region },
  { key: 'Permissions', val: (s) => s.permissions },
  { key: 'Session expires', val: (s) => <span className="tabular-nums">{s.expires}</span> },
];

export default function SessionCard() {
  return (
    <Card>
      <Card.Head title="Your session" subtitle="Active sign-in details" />
      <Card.Body>
        <div className="divide-y divide-slate-100">
          {ROWS.map((r) => (
            <div className="flex items-center justify-between gap-3 py-2.5 text-sm" key={r.key}>
              <div className="text-slate-500">{r.key}</div>
              <div className="text-right font-medium text-slate-700">{r.val(session)}</div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
