import { useMemo, useState } from 'react';
import {
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  RetryIcon,
  SearchIcon,
} from '../ui/Icon.jsx';
import Card from '../ui/Card.jsx';
import IconButton from '../ui/IconButton.jsx';

const STATUS_LABEL = {
  validated: 'Validated',
  processing: 'Processing',
  failed: 'Failed',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'validated', label: 'Validated' },
  { key: 'processing', label: 'Processing' },
  { key: 'failed', label: 'Failed' },
];

function rowAction(status) {
  if (status === 'failed') return { Icon: RetryIcon, title: 'Retry' };
  if (status === 'processing') return { Icon: CloseIcon, title: 'Cancel' };
  return { Icon: EyeIcon, title: 'View' };
}

export default function HistoryTable({ rows }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${r.file} ${r.constituency} ${r.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, query]);

  return (
    <Card>
      <Card.Head
        title="Upload history"
        subtitle="Recent uploads and manual entries from the last 24 hours."
      />
      <Card.Body style={{ padding: '20px 22px 22px' }}>
        <div className="toolbar">
          <div className="search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by file name or constituency…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`filter-chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <table className="history">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Time</th>
              <th>Source</th>
              <th className="right" style={{ width: 90 }}>
                Records
              </th>
              <th>Constituency</th>
              <th style={{ width: 130 }}>Status</th>
              <th className="right" style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const { Icon, title } = rowAction(r.status);
              return (
                <tr key={r.id}>
                  <td className="h-time">{r.time}</td>
                  <td>
                    <div className="h-file">{r.file}</div>
                    <div className="h-source">{r.source}</div>
                  </td>
                  <td className="right h-records">{r.records}</td>
                  <td>{r.constituency}</td>
                  <td>
                    <span className={`status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="right">
                    <IconButton title={title}>
                      <Icon />
                    </IconButton>
                    <IconButton title="Download">
                      <DownloadIcon />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-3)',
                    padding: '40px 0',
                  }}
                >
                  No records match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card.Body>
    </Card>
  );
}
