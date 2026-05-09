import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightIcon,
  BarChartIcon,
  FileSpreadsheetIcon,
  IdCardIcon,
} from '../components/ui/Icon.jsx';
import StatGroup from '../components/ui/StatGroup.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

const TILES = [
  {
    to: '/voter-detail',
    title: 'Voter Detail',
    desc: 'Add voter records, upload bulk Excel data, and review submission history.',
    icon: <IdCardIcon />,
    color: 'blue',
    stat: '8',
    statLabel: 'pre-filled rows',
    roles: ['admin', 'data_operator'],
  },
  {
    to: '/form-20',
    title: 'Form 20',
    desc: 'Detailed Result Sheet — polling-station-wise vote counts with auto-calculated totals.',
    icon: <FileSpreadsheetIcon />,
    color: 'green',
    stat: '22',
    statLabel: 'polling stations',
    roles: ['admin', 'data_operator'],
  },
  {
    to: '/segment',
    title: 'Segment voters',
    desc: 'Filter voters by community, occupation, age, polling station, predicted leaning. Save cohorts. Export CSV.',
    icon: <BarChartIcon />,
    color: 'purple',
    stat: 'New',
    statLabel: 'analytics',
    roles: ['admin'],
  },
  {
    to: '/analytics',
    title: 'Analytics',
    desc: 'Live KPIs, party vote share, turnout, demographics, and a constituency outlook map.',
    icon: <BarChartIcon />,
    color: 'purple',
    stat: '96',
    statLabel: 'seats live',
    roles: ['admin'],
  },
];

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const visible = TILES.filter((t) => !user || t.roles.includes(user.role));
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Data Operator';

  // Live stats from upload history (TanStack — auto-cached, refetches on
  // mutation invalidations from the upload pages).
  const historyQ = useQuery({
    queryKey: ['uploads', 'history'],
    queryFn: () => api.uploadHistory(),
    enabled: !!user,
  });
  const stats = useMemo(() => {
    const items = historyQ.data?.items ?? [];
    let submittedToday = 0;
    let processing = 0;
    let failed = 0;
    let totalRecords = 0;
    for (const h of items) {
      if (h.status === 'processing') processing += 1;
      else if (h.status === 'failed') failed += 1;
      else if (isToday(h.createdAt)) submittedToday += (h.records ?? 0);
      totalRecords += h.records ?? 0;
    }
    return [
      { value: submittedToday.toLocaleString(), label: 'Records added today' },
      { value: processing, label: 'Pending', tone: 'warning' },
      { value: failed, label: 'Failed', tone: 'danger' },
      { value: totalRecords.toLocaleString(), label: 'Total records ingested' },
    ];
  }, [historyQ.data]);
  return (
    <div className="shell">
      <div className="welcome">
        <span className="welcome-meta">● Signed in as {roleLabel}</span>
        <h1>Welcome back, {user?.username ?? 'guest'}</h1>
        <p>
          {user?.role === 'admin'
            ? 'You have full access — data entry, segmentation, analytics, cohorts, exports.'
            : 'Your role can add voters and fill Form 20 sheets. Segmentation and analytics are admin-only.'}
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <StatGroup items={stats} />
      </div>

      <div className="home-grid">
        {visible.map((t) => (
          <Link key={t.to} to={t.to} className="tile">
            <div className={`tile-icon ${t.color}`}>{t.icon}</div>
            <h3>{t.title}</h3>
            <p>{t.desc}</p>
            <div className="tile-footer">
              <span>
                <span className="tile-footer-stat">{t.stat}</span>
                <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>
                  {t.statLabel}
                </span>
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
