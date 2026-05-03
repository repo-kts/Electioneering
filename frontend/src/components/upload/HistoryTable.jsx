import { useMemo, useState } from 'react';
import {
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  RetryIcon,
  SearchIcon,
} from '../ui/Icon.jsx';

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
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Upload history</h2>
          <p>Recent uploads and manual entries from the last 24 hours.</p>
        </div>
      </div>
      <div className="card-body" style={{ padding: '20px 24px 24px' }}>
        <div className="history-toolbar">
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
              <th className="right" style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
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
                  {r.status === 'failed' ? (
                    <button className="icon-btn" title="Retry">
                      <RetryIcon />
                    </button>
                  ) : r.status === 'processing' ? (
                    <button className="icon-btn" title="Cancel">
                      <CloseIcon />
                    </button>
                  ) : (
                    <button className="icon-btn" title="View">
                      <EyeIcon />
                    </button>
                  )}
                  <button className="icon-btn" title="Download">
                    <DownloadIcon />
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0' }}>
                  No records match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
