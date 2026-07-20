import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { num } from '../components/elections/helpers.js';

/**
 * Flat constituency list — no roll-up summary cards. Reused for the three
 * Insights entries:
 *   - Assembly Election  → matchType="Assembly Election"
 *   - Lok Sabha Election → matchType="Lok Sabha Election"
 *   - Booth wise         → matchType=null (all types), boothMode → opens the
 *                          booth grid directly instead of the all-years view.
 * Every row opens the constituency page, where years are picked from a dropdown.
 */
export default function ConstituencyListPage({ title, subtitle, matchType = null, boothMode = false }) {
  const q = useQuery({ queryKey: ['elections', 'hierarchy'], queryFn: () => api.electionsHierarchy() });
  const types = q.data?.types ?? [];

  // Flatten the type→constituency tree down to the constituencies we want.
  const rows = useMemo(() => {
    const out = [];
    for (const t of types) {
      if (matchType && t.electionType !== matchType) continue;
      for (const c of t.constituencies ?? []) out.push({ ...c, electionType: t.electionType });
    }
    return out.sort((a, b) => (a.assemblyName || '').localeCompare(b.assemblyName || ''));
  }, [types, matchType]);

  const linkFor = (c) =>
    boothMode ? `/elections/${c.latestElectionId}?booths=1` : `/elections/${c.latestElectionId}`;

  // Booth mode mixes both election types, so surface the type as an extra column.
  const cols = boothMode
    ? 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_120px]'
    : 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_120px]';

  return (
    <div>
      <header className="mb-6 border-b border-slate-300 pb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Insights</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold text-slate-950">{title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
          </div>
          {q.data && rows.length > 0 && (
            <span className="whitespace-nowrap border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
              {num(rows.length)} {rows.length === 1 ? 'constituency' : 'constituencies'}
            </span>
          )}
        </div>
      </header>

      {q.isPending && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {q.isError && (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{q.error.message}</div>
      )}

      {q.data && rows.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No {matchType ? `${matchType.toLowerCase()}s` : 'elections'} yet. Upload a Form 20 to create one.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden border border-slate-300 bg-white">
          <div className={`grid gap-4 border-b border-slate-200 bg-[#fbfaf7] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 max-md:hidden ${cols}`}>
            <div>Constituency</div>
            <div>Parliamentary</div>
            <div>State</div>
            {boothMode && <div>Election</div>}
            <div className="text-right">{boothMode ? 'Latest year' : 'On record'}</div>
          </div>
          {rows.map((c) => {
            const years = c.yearCount ?? c.years?.length ?? 0;
            const latestYear = c.years?.[0]?.year ?? null;
            return (
              <Link
                key={c.key}
                to={linkFor(c)}
                className={`group grid gap-2 border-t border-slate-100 px-4 py-3.5 transition first:border-t-0 hover:bg-[#fbfaf7] md:items-center md:gap-4 ${cols}`}
              >
                <div className="min-w-0">
                  <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-accent-700">
                    {c.assemblyNo != null ? `${c.assemblyNo}-` : ''}{c.assemblyName}
                  </span>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                    {boothMode ? 'Open booth grid' : 'Assembly constituency'}
                  </p>
                </div>
                <div className="min-w-0 truncate text-sm text-slate-600" title={c.parlName ?? ''}>
                  <span className="text-slate-400 md:hidden">Parliamentary: </span>{c.parlName || '—'}
                </div>
                <div className="min-w-0 truncate text-sm text-slate-600" title={c.state ?? ''}>
                  <span className="text-slate-400 md:hidden">State: </span>{c.state || '—'}
                </div>
                {boothMode && (
                  <div className="min-w-0 truncate text-sm text-slate-600">
                    <span className="text-slate-400 md:hidden">Election: </span>{c.electionType || '—'}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
                    {boothMode
                      ? (latestYear ?? '—')
                      : `${num(years)} ${years === 1 ? 'year' : 'years'}`}
                  </span>
                  <span className="text-slate-300 transition group-hover:text-slate-900">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
