import { session } from '../../data/history.js';
import Card from '../ui/Card.jsx';

const ROWS = [
  { key: 'User', val: (s) => s.user },
  {
    key: 'Role',
    val: (s) => (
      <>
        {s.role} <span className="badge-tag">Active</span>
      </>
    ),
  },
  { key: 'Region', val: (s) => s.region },
  { key: 'Permissions', val: (s) => s.permissions },
  { key: 'Session expires', val: (s) => <span className="tnum">{s.expires}</span> },
];

export default function SessionCard() {
  return (
    <Card>
      <Card.Head title="Your session" subtitle="Active sign-in details" />
      <Card.Body>
        <div className="session-list">
          {ROWS.map((r) => (
            <div className="session-row" key={r.key}>
              <div className="session-key">{r.key}</div>
              <div className="session-val">{r.val(session)}</div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
