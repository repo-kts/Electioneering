// Booth-wise flow, level 2: every physical polling station in a constituency,
// aggregated across ALL its elections (Assembly + Lok Sabha + every year). Each
// booth's headline is its most-recent election; opening one shows its full
// cross-election history. View-only — no create/edit-election affordances.
import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, Surface, Loading, ErrorBox, StatCard } from '../components/ui/kit.jsx';
import BoothGraphs from '../components/analytics/BoothGraphs.jsx';
import BoothTreemap from '../components/analytics/BoothTreemap.jsx';
import BoothTreemapNested from '../components/analytics/BoothTreemapNested.jsx';
import TreemapGuide from '../components/analytics/TreemapGuide.jsx';
import Modal from '../components/ui/Modal.jsx';
import FilterableTable from '../components/analytics/FilterableTable.jsx';
import BoothFilterBar, { applyBoothFilters, emptyBoothFilters } from '../components/analytics/BoothFilterBar.jsx';
import { partyColor, colorFor, colorForCandidate, num, pct, boothName, boothTag } from '../components/elections/helpers.js';

const SORTS = {
  serial: 'Booth number',
  turnout: 'Turnout (low→high)',
  valid: 'Valid votes (high→low)',
};

export default function ConstituencyBoothsPage() {
  const params = useParams();
  const assemblyNo = decodeURIComponent(params.assemblyNo ?? '');
  const assemblyName = decodeURIComponent(params.assemblyName ?? '');
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const [sortKey, setSortKey] = useState('serial');
  const [treeMetric, setTreeMetric] = useState('margin'); // margin | turnout
  const [treeSize, setTreeSize] = useState('voters'); // voters | share | margin
  const [guideOpen, setGuideOpen] = useState(false);
  const [filters, setFilters] = useState(emptyBoothFilters);
  const [electionType, setElectionType] = useState('all'); // 'all' | type string
  const [electionYear, setElectionYear] = useState('all'); // 'all' | year number

  const q = useQuery({
    queryKey: ['constituencyBooths', assemblyNo, assemblyName, electionType, electionYear],
    queryFn: () => api.constituencyBooths({
      assemblyNo,
      assemblyName,
      electionType: electionType === 'all' ? undefined : electionType,
      electionYear: electionYear === 'all' ? undefined : electionYear,
    }),
  });

  const items = q.data?.items ?? [];
  const cons = q.data?.constituency;
  const colorForName = (nm) => partyColor(nm) ?? colorFor(nm);

  // Filter options from the API (all elections in the constituency, unfiltered).
  const electionOpts = q.data?.elections ?? [];
  const typeOpts = useMemo(() => [...new Set(electionOpts.map((e) => e.electionType))], [electionOpts]);
  // Years available for the selected type (all types → every year).
  const yearOpts = useMemo(
    () => [...new Set(
      electionOpts
        .filter((e) => e.year != null && (electionType === 'all' || e.electionType === electionType))
        .map((e) => e.year),
    )].sort((a, b) => b - a),
    [electionOpts, electionType],
  );

  const rollup = useMemo(() => {
    const reported = items.filter((b) => (b.totalValid ?? 0) > 0);
    const turnouts = items.map((b) => b.turnoutPct).filter((t) => t > 0);
    const avgTurnout = turnouts.length ? turnouts.reduce((s, t) => s + t, 0) / turnouts.length : 0;
    const electors = items.reduce((s, b) => s + (b.registeredVoters ?? 0), 0);
    return { booths: items.length, reported: reported.length, avgTurnout, electors };
  }, [items]);

  const filtered = useMemo(() => applyBoothFilters(items, filters), [items, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortKey === 'turnout') arr.sort((a, b) => a.turnoutPct - b.turnoutPct);
    else if (sortKey === 'valid') arr.sort((a, b) => (b.totalValid ?? 0) - (a.totalValid ?? 0));
    else arr.sort((a, b) => a.serial - b.serial);
    return arr;
  }, [filtered, sortKey]);

  const stationLink = (b) => `/elections/booths/station/${b.id}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Booth wise votes', to: '/elections/booths' },
          { label: assemblyName || 'Constituency' },
        ]}
      />
      <PageHeader
        eyebrow={`${cons?.state ?? ''}${cons?.parlName ? ' · ' + cons.parlName : ''}`}
        title={assemblyName || 'Constituency'}
        subtitle={electionType === 'all' && electionYear === 'all'
          ? 'Every physical booth in this constituency, aggregated across all its elections. Open one to see its full history across the years.'
          : 'Booths for the selected election. Clear the filters to see every booth aggregated across all elections.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Type
              <select
                value={electionType}
                onChange={(e) => { setElectionType(e.target.value); setElectionYear('all'); }}
                className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
              >
                <option value="all">All types</option>
                {typeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Year
              <select
                value={electionYear}
                onChange={(e) => setElectionYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
              >
                <option value="all">All years</option>
                {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
        }
      />

      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isPending && <Loading className="h-40" />}

      {q.data && (
        <>
          <div className="mb-5 grid grid-cols-3 border border-slate-300">
            <StatCard label="Booths" value={num(rollup.booths)} sub={`${num(rollup.reported)} with results`} />
            <StatCard label="Avg turnout" value={pct(rollup.avgTurnout)} />
            <StatCard label="Registered (latest)" value={num(rollup.electors)} />
          </div>

          <Surface
            title="Booths"
            subtitle="Headline = each booth's most-recent election. Open a booth for turnout, results and demographics across every year."
            right={
              <div className="flex flex-wrap items-center gap-2">
                {(view === 'grid' || view === 'table') && (
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
                {view === 'treemap' && (
                  <>
                    {electionYear !== 'all' && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        Size by
                        <select
                          value={treeSize}
                          onChange={(e) => setTreeSize(e.target.value)}
                          className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <option value="voters">Registered voters</option>
                          <option value="share">Vote share</option>
                          <option value="margin">Win margin</option>
                        </select>
                      </label>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      Colour by
                      <select
                        value={treeMetric}
                        onChange={(e) => setTreeMetric(e.target.value)}
                        className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        <option value="margin">Win margin</option>
                        <option value="turnout">Turnout</option>
                        <option value="party">Winning party</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setGuideOpen(true)}
                      title="How to read the treemap"
                      aria-label="How to read the treemap"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold italic text-slate-500 transition hover:border-accent-500 hover:text-accent-700"
                    >
                      i
                    </button>
                  </>
                )}
                <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                  {['grid', 'table', 'graph', 'treemap'].map((v) => (
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

            {/* The filter bar drives grid/table/graph; the treemap is a whole-picture
                view, so it hides the bar and always renders every booth (below). */}
            {items.length > 0 && view !== 'treemap' && (
              <BoothFilterBar items={items} value={filters} onChange={setFilters} resultCount={filtered.length} />
            )}

            {items.length > 0 && sorted.length === 0 && view !== 'treemap' && (
              <p className="py-8 text-center text-sm text-slate-400">
                No booths match these filters.{' '}
                <button onClick={() => setFilters(emptyBoothFilters())} className="font-medium text-accent-700 hover:underline">Clear filters</button>
              </p>
            )}

            {sorted.length > 0 && view === 'graph' && (
              <BoothGraphs items={sorted} onSelect={(id) => { if (id != null) navigate(stationLink({ id })); }} />
            )}

            {items.length > 0 && view === 'treemap' && electionYear === 'all' && (
              <BoothTreemapNested items={items} metric={treeMetric} typeFilter={electionType} onSelect={(id) => { if (id != null) navigate(stationLink({ id })); }} />
            )}

            {items.length > 0 && view === 'treemap' && electionYear !== 'all' && (
              <BoothTreemap items={items} metric={treeMetric} sizeMetric={treeSize} onSelect={(id) => { if (id != null) navigate(stationLink({ id })); }} />
            )}

            {sorted.length > 0 && view === 'table' && (
              <FilterableTable
                rows={sorted}
                getRowKey={(b) => b.id}
                searchPlaceholder="Search booths by name…"
                columns={[
                  { key: 'name', label: 'Booth', filterValue: (b) => `${b.name ?? ''} PS-${b.serial}`, render: (b) => (
                    <Link to={stationLink(b)} className="block truncate font-semibold text-slate-900 hover:text-accent-700" title={boothName(b)}>{boothName(b)}</Link>
                  ) },
                  { key: 'serial', label: 'PS no.', className: 'tabular-nums text-slate-400', filterValue: (b) => b.serial, render: (b) => `PS-${b.serial}` },
                  { key: 'electionsCount', label: 'Elections', className: 'tabular-nums text-right', render: (b) => num(b.electionsCount) },
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

            {sorted.length > 0 && view === 'grid' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((b) => {
                  const reported = (b.totalValid ?? 0) > 0;
                  const c = colorForCandidate(b.leader, b.leaderParty);
                  return (
                    <Link
                      key={b.id}
                      to={stationLink(b)}
                      className="group flex flex-col gap-2 border border-slate-200 bg-white p-3 transition hover:border-accent-400 hover:bg-[#fbfaf7]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900" title={boothName(b)}>{boothName(b)}</span>
                        {boothTag(b) && <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400">{boothTag(b)}</span>}
                      </div>
                      {reported ? (
                        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-100 pt-2">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400">Leading candidate</div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                              <span className="truncate font-medium" style={{ color: c }} title={b.leaderParty ? `${b.leader} (${b.leaderParty})` : b.leader}>
                                {b.leader}{b.leaderParty ? <span className="text-slate-400"> · {b.leaderParty}</span> : null}
                              </span>
                            </div>
                            <div className="text-[11px] tabular-nums text-slate-500">{pct(b.leaderShare)} vote share</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400">Turnout</div>
                            <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">{b.turnoutPct ? pct(b.turnoutPct) : '—'}</div>
                          </div>
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

      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the treemap" size="lg">
        <TreemapGuide />
      </Modal>
    </div>
  );
}
