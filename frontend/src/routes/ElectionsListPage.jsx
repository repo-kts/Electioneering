import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const num = (n) => (n ?? 0).toLocaleString();

export default function ElectionsListPage() {
  const q = useQuery({ queryKey: ['elections'], queryFn: () => api.listElections() });
  const items = q.data?.items ?? [];

  return (
    <div>
      <header className="mb-6 border-b border-slate-300 pb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Insights</div>
        <h1 className="text-[26px] font-semibold text-slate-950">Elections</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          Select an election to inspect booth results, voter composition, and candidate reports.
        </p>
      </header>

      {q.isPending && (
        <div className="divide-y divide-slate-200 border border-slate-300 bg-white">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse bg-slate-100" />
          ))}
        </div>
      )}

      {q.isError && (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {q.error.message}
        </div>
      )}

      {q.data && items.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No elections yet. Upload a Form 20 to create one.
        </div>
      )}

      <div className="overflow-hidden border border-slate-300 bg-white">
        <div className="grid grid-cols-[minmax(0,1.4fr)_120px_120px_120px] gap-4 border-b border-slate-200 bg-[#fbfaf7] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-md:hidden">
          <div>Assembly</div>
          <div>Type</div>
          <div className="text-right">Booths</div>
          <div className="text-right">Electors</div>
        </div>
        {items.map((e) => (
          <Link
            key={e.id}
            to={`/elections/${e.id}`}
            className="group grid gap-3 border-b border-slate-200 px-4 py-4 transition last:border-b-0 hover:bg-[#fbfaf7] md:grid-cols-[minmax(0,1.4fr)_120px_120px_120px] md:items-center md:gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h2 className="truncate text-base font-semibold text-slate-950 group-hover:text-accent-700">
                  {e.assemblyName}
                </h2>
                <span className="text-sm text-slate-500">{e.electionYear ?? '—'}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {e.assemblyNo} · {e.parlName} · {e.state}
              </p>
            </div>
            <div className="text-sm text-slate-700">{e.electionType}</div>
            <div className="text-sm tabular-nums text-slate-700 md:text-right">{e._count?.pollingStations ?? 0}</div>
            <div className="flex items-center justify-between gap-3 text-sm tabular-nums text-slate-700 md:justify-end">
              <span>{e.totalElectors != null ? num(e.totalElectors) : '—'}</span>
              <span className="text-slate-400 transition group-hover:text-slate-950">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
