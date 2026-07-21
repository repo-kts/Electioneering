// Booth-wise flow, level 2: every physical polling station in a constituency,
// aggregated across ALL its elections (Assembly + Lok Sabha + every year). Each
// booth's headline is its most-recent election; opening one shows its full
// cross-election history. View-only — no create/edit-election affordances.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, Surface, Loading, ErrorBox, StatCard } from '../components/ui/kit.jsx';
import BoothMap from '../components/analytics/BoothMap.jsx';
import FilterableTable from '../components/analytics/FilterableTable.jsx';
import { partyColor, colorFor, num, pct } from '../components/elections/helpers.js';

// Neutral competitiveness from the leader→runner-up margin (party-agnostic).
function competitiveness(b) {
  if ((b.totalValid ?? 0) === 0) return { label: 'No data', cls: 'border-slate-200 bg-slate-50 text-slate-500', rank: 0 };
  const m = b.margin ?? 0;
  if (m >= 0.2) return { label: 'Safe', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', rank: 1 };
  if (m >= 0.1) return { label: 'Clear', cls: 'border-lime-200 bg-lime-50 text-lime-800', rank: 2 };
  if (m >= 0.03) return { label: 'Lean', cls: 'border-amber-200 bg-amber-50 text-amber-800', rank: 3 };
  return { label: 'Tight', cls: 'border-rose-200 bg-rose-50 text-rose-800', rank: 4 };
}

const SORTS = {
  serial: 'Booth number',
  tight: 'Closest first',
  turnout: 'Turnout (low→high)',
  valid: 'Valid votes (high→low)',
};

export default function ConstituencyBoothsPage() {
  const params = useParams();
  const assemblyNo = decodeURIComponent(params.assemblyNo ?? '');
  const assemblyName = decodeURIComponent(params.assemblyName ?? '');
  const [view, setView] = useState('grid');
  const [sortKey, setSortKey] = useState('serial');

  const q = useQuery({
    queryKey: ['constituencyBooths', assemblyNo, assemblyName],
    queryFn: () => api.constituencyBooths({ assemblyNo, assemblyName }),
  });

  const items = q.data?.items ?? [];
  const cons = q.data?.constituency;
  const colorForName = (nm) => partyColor(nm) ?? colorFor(nm);

  const rollup = useMemo(() => {
    const reported = items.filter((b) => (b.totalValid ?? 0) > 0);
    const turnouts = items.map((b) => b.turnoutPct).filter((t) => t > 0);
    const avgTurnout = turnouts.length ? turnouts.reduce((s, t) => s + t, 0) / turnouts.length : 0;
    const electors = items.reduce((s, b) => s + (b.registeredVoters ?? 0), 0);
    const tight = reported.filter((b) => competitiveness(b).rank >= 3).length;
    return { booths: items.length, reported: reported.length, avgTurnout, electors, tight };
  }, [items]);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sortKey === 'tight') arr.sort((a, b) => competitiveness(b).rank - competitiveness(a).rank || a.serial - b.serial);
    else if (sortKey === 'turnout') arr.sort((a, b) => a.turnoutPct - b.turnoutPct);
    else if (sortKey === 'valid') arr.sort((a, b) => (b.totalValid ?? 0) - (a.totalValid ?? 0));
    else arr.sort((a, b) => a.serial - b.serial);
    return arr;
  }, [items, sortKey]);

  const stationLink = (b) => `/elections/booths/station/${b.id}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Booth wise election', to: '/elections/booths' },
          { label: assemblyName || 'Constituency' },
        ]}
      />
      <PageHeader
        eyebrow={`${cons?.state ?? ''}${cons?.parlName ? ' · ' + cons.parlName : ''}`}
        title={assemblyName || 'Constituency'}
        subtitle="Every physical booth in this constituency, aggregated across all its elections. Open one to see its full history across the years."
      />

      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isPending && <Loading className="h-40" />}

      {q.data && (
        <>
          <div className="mb-5 grid grid-cols-2 border border-slate-300 sm:grid-cols-4">
            <StatCard label="Booths" value={num(rollup.booths)} sub={`${num(rollup.reported)} with results`} />
            <StatCard label="Avg turnout" value={pct(rollup.avgTurnout)} />
            <StatCard label="Registered (latest)" value={num(rollup.electors)} />
            <StatCard label="Close booths" value={num(rollup.tight)} sub="Lean or Tight" tone="amber" />
          </div>

          <Surface
            title="Booths"
            subtitle="Headline = each booth's most-recent election. Open a booth for turnout, results and demographics across every year."
            right={
              <div className="flex flex-wrap items-center gap-2">
                {view !== 'map' && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    Sort
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </label>
                )}
                <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                  {['grid', 'table', 'map'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-3 py-1 text-xs font-medium capitalize transition ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {items.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No booths recorded for this constituency yet.</p>
            )}

            {items.length > 0 && view === 'map' && <BoothMap items={sorted} linkFor={stationLink} />}

            {items.length > 0 && view === 'table' && (
              <FilterableTable
                rows={sorted}
                getRowKey={(b) => b.id}
                searchPlaceholder="Search booths by name…"
                columns={[
                  { key: 'serial', label: 'Booth', filterValue: (b) => b.serial, render: (b) => (
                    <Link to={stationLink(b)} className="font-semibold text-slate-900 hover:text-accent-700">PS-{b.serial}</Link>
                  ) },
                  { key: 'name', label: 'Polling station', className: 'text-slate-600', render: (b) => <span className="truncate" title={b.name ?? ''}>{b.name ?? '—'}</span> },
                  { key: 'electionsCount', label: 'Elections', className: 'tabular-nums text-right', render: (b) => num(b.electionsCount) },
                  { key: 'comp', label: 'Status', filterValue: (b) => competitiveness(b).label, render: (b) => {
                    const c = competitiveness(b);
                    return <span className={`inline-block border px-1.5 py-0.5 text-[11px] font-semibold ${c.cls}`}>{c.label}</span>;
                  } },
                  { key: 'leader', label: 'Latest leader', render: (b) => b.leader ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorForName(b.leader) }} />
                      <span className="truncate">{b.leader}</span>
                      <span className="text-xs text-slate-400">{pct(b.leaderShare)}</span>
                    </span>
                  ) : '—' },
                  { key: 'turnoutPct', label: 'Turnout', filterValue: (b) => (b.turnoutPct * 100).toFixed(1), className: 'tabular-nums text-right', render: (b) => b.turnoutPct ? pct(b.turnoutPct) : '—' },
                  { key: 'totalValid', label: 'Valid', filterValue: (b) => b.totalValid ?? 0, className: 'tabular-nums text-right', render: (b) => num(b.totalValid) },
                ]}
              />
            )}

            {items.length > 0 && view === 'grid' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((b) => {
                  const reported = (b.totalValid ?? 0) > 0;
                  const c = colorForName(b.leader);
                  const comp = competitiveness(b);
                  return (
                    <Link
                      key={b.id}
                      to={stationLink(b)}
                      className="group flex flex-col gap-2 border border-slate-200 bg-white p-3 transition hover:border-accent-400 hover:bg-[#fbfaf7]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">PS-{b.serial}</span>
                        <span className={`border px-1.5 py-0.5 text-[10px] font-semibold ${comp.cls}`}>{comp.label}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500" title={b.name ?? ''}>{b.name ?? '—'}</div>
                      {reported ? (
                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                            <span className="truncate font-medium" style={{ color: c }}>{b.leader}</span>
                            <span className="text-slate-400">{pct(b.leaderShare)}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-500">{b.turnoutPct ? pct(b.turnoutPct) : '—'}</span>
                        </div>
                      ) : (
                        <div className="mt-auto border-t border-slate-100 pt-2 text-xs text-slate-400">No Form 20 data</div>
                      )}
                      <div className="text-[11px] tabular-nums text-slate-400">{num(b.electionsCount)} election{b.electionsCount === 1 ? '' : 's'} on record</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Surface>
        </>
      )}
    </div>
  );
}
