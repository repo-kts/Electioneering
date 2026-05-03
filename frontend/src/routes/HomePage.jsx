import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  FileSpreadsheetIcon,
  IdCardIcon,
} from '../components/ui/Icon.jsx';

const TILES = [
  {
    to: '/voter-detail',
    title: 'Voter Detail',
    desc: 'Add new voter records, upload bulk data from Excel, and review the full submission history.',
    icon: <IdCardIcon />,
    color: 'blue',
    stat: '8',
    statLabel: 'pre-filled rows',
  },
  {
    to: '/form-20',
    title: 'Form 20',
    desc: 'Detailed Result Sheet. Polling-station-wise vote counts for each candidate, with auto-calculated totals.',
    icon: <FileSpreadsheetIcon />,
    color: 'green',
    stat: '22',
    statLabel: 'polling stations',
  },
];

export default function HomePage() {
  return (
    <div className="shell">
      <div className="welcome">
        <span className="welcome-meta">● Live · 02 May 2026</span>
        <h1>Welcome back, R. Khanna</h1>
        <p>
          Pick a section below to get started. Your role grants Upload, Add, and Read
          permissions for Maharashtra · 24N.
        </p>
      </div>

      <div className="home-grid">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="tile">
            <div className={`tile-icon ${t.color}`}>{t.icon}</div>
            <h3>{t.title}</h3>
            <p>{t.desc}</p>
            <div className="tile-footer">
              <span>
                <span className="tile-footer-stat">{t.stat}</span>
                <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>{t.statLabel}</span>
              </span>
              <span className="tile-arrow">
                Open <ArrowRightIcon />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
