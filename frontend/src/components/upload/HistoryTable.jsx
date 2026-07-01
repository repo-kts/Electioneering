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
      <Card.Body>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by file name or constituency…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.key ? 'bg-slate-950 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-[#f7f5f0]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">Records</th>
                <th className="px-3 py-2 font-medium">Constituency</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const { Icon, title } = rowAction(r.status);
                const statusCls = {
                  validated: 'bg-emerald-50 text-emerald-700',
                  processing: 'bg-amber-50 text-amber-700',
                  failed: 'bg-rose-50 text-rose-700',
                }[r.status] ?? 'bg-slate-100 text-slate-600';
                return (
                  <tr key={r.id} className="border-t border-slate-200 hover:bg-[#fbfaf7]">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.time}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700">{r.file}</div>
                      <div className="text-xs text-slate-400">{r.source}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.records}</td>
                    <td className="px-3 py-2 text-slate-600">{r.constituency}</td>
                    <td className="px-3 py-2">
                      <span className={`border px-2 py-0.5 text-xs font-medium ${statusCls}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <IconButton title={title}><Icon /></IconButton>
                        <IconButton title="Download"><DownloadIcon /></IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">No records match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
