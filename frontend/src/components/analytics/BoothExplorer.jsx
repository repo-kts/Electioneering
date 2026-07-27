import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Surface, Loading, ErrorBox } from '../ui/kit.jsx';
import { partyColor, colorFor, num, pct, boothName, boothTag } from '../elections/helpers.js';
import BoothMap from './BoothMap.jsx';
import BoothTreemap from './BoothTreemap.jsx';
import FilterableTable from './FilterableTable.jsx';
import BoothFilterBar, { applyBoothFilters, emptyBoothFilters } from './BoothFilterBar.jsx';

// Treemap self-serve controls — colour tiles by, and size tiles by.
const TREE_COLOR = { party: 'Winning party', margin: 'Win margin', turnout: 'Turnout' };
const TREE_SIZE = { valid: 'Valid votes', share: 'Winner share', margin: 'Win margin' };

// Higher = more worth acting on. Surfaces swing/recoverable booths first.
const OPP_BASE = { Swing: 100, 'Marginal-loss': 90, 'Marginal-win': 60, 'Safe-loss': 40, 'Safe-win': 20, 'No-data': 0 };

const SORTS = {
  opportunity: 'Opportunity',
  serial: 'Booth number',
  turnout: 'Turnout (low→high)',
  valid: 'Valid votes (high→low)',
};

export default function BoothExplorer({ electionId }) {
  const [view, setView] = useState('grid'); // grid | table | treemap | map
  const [sortKey, setSortKey] = useState('opportunity');
  const [filters, setFilters] = useState(emptyBoothFilters);
  const [treeColor, setTreeColor] = useState('party'); // colour tiles by leader/party
  const [treeSize, setTreeSize] = useState('valid'); // size tiles by valid votes
  const { show } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const leaningQ = useQuery({
    queryKey: ['analytics', 'boothLeaning', electionId],
    queryFn: () => api.boothLeaning(electionId),
    enabled: !!electionId,
  });
  const targetsQ = useQuery({
    queryKey: ['booth-targets', electionId, ''],
    queryFn: () => api.boothTargets(electionId, undefined),
    enabled: !!electionId,
  });
  // Candidate → party, so BJP/INC keep their theme color on booth leaders.
  const electionQ = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => api.getElection(electionId),
    enabled: !!electionId,
  });

  const geocode = useMutation({
    mutationFn: () => api.geocodeBooths(electionId),
    onSuccess: (r) => {
      show(`Geocoded ${r.geocoded} of ${r.total} booths`, r.failed ? 'warn' : 'success');
      qc.invalidateQueries({ queryKey: ['analytics', 'boothLeaning', electionId] });
      setView('map');
    },
    onError: (e) => show(e.message || 'Geocoding failed', 'error'),
  });

  const partyByName = useMemo(() => {
    const m = {};
    for (const c of electionQ.data?.candidates ?? []) m[c.name] = c.party;
    return m;
  }, [electionQ.data]);
  const colorForName = (nm) => partyColor(partyByName[nm]) ?? colorFor(nm);

  const leaningItems = leaningQ.data?.items ?? [];
  const geocoded = leaningQ.data?.geocoded ?? 0;
  const targetById = useMemo(() => {
    const m = new Map();
    for (const t of targetsQ.data?.items ?? []) m.set(t.id, t);
    return m;
  }, [targetsQ.data]);

  // Merge leaning (names, shares, coords) with targets (classification, margins).
  const booths = useMemo(() => {
    return leaningItems.map((b) => {
      const t = targetById.get(b.id);
      const opportunity = (OPP_BASE[t?.classification] ?? 0) + (t ? (1 - Math.abs(t.margin)) * 10 : 0);
      return {
        ...b,
        classification: t?.classification ?? 'No-data',
        turnoutPct: t?.turnoutPct ?? 0,
        margin: t?.margin ?? 0,
        opportunity,
      };
    });
  }, [leaningItems, targetById]);

  const filtered = useMemo(() => applyBoothFilters(booths, filters), [booths, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortKey === 'serial') arr.sort((a, b) => a.serial - b.serial);
    else if (sortKey === 'turnout') arr.sort((a, b) => a.turnoutPct - b.turnoutPct);
    else if (sortKey === 'valid') arr.sort((a, b) => (b.totalValid ?? 0) - (a.totalValid ?? 0));
    else arr.sort((a, b) => b.opportunity - a.opportunity || a.serial - b.serial);
    return arr;
  }, [filtered, sortKey]);

  const isPending = leaningQ.isPending || targetsQ.isPending;

  return (
    <Surface
      title="Booths"
      subtitle="Every polling station, ranked by where you can gain the most. Open one for its full profile and voter list."
      right={
        <div className="flex flex-wrap items-center gap-2">
          {view !== 'map' && view !== 'treemap' && (
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
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                Colour
                <select
                  value={treeColor}
                  onChange={(e) => setTreeColor(e.target.value)}
                  className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                >
                  {Object.entries(TREE_COLOR).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                Size
                <select
                  value={treeSize}
                  onChange={(e) => setTreeSize(e.target.value)}
                  className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                >
                  {Object.entries(TREE_SIZE).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </label>
            </>
          )}
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            {['grid', 'table', 'treemap', 'map'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-medium capitalize transition ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {v}
              </button>
            ))}
          </div>
          {view === 'map' && geocoded < leaningItems.length && (
            <button
              onClick={() => geocode.mutate()}
              disabled={geocode.isPending}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {geocode.isPending ? 'Geocoding…' : `Geocode booths (${geocoded}/${leaningItems.length})`}
            </button>
          )}
        </div>
      }
    >
      {leaningQ.isError && <ErrorBox message={leaningQ.error.message} onRetry={() => leaningQ.refetch()} />}
      {isPending && <Loading className="h-40" />}

      {!isPending && booths.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">No booths recorded for this election yet.</p>
      )}

      {!isPending && booths.length > 0 && (
        <BoothFilterBar items={booths} value={filters} onChange={setFilters} resultCount={filtered.length} />
      )}

      {!isPending && booths.length > 0 && sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          No booths match these filters.{' '}
          <button onClick={() => setFilters(emptyBoothFilters())} className="font-medium text-accent-700 hover:underline">Clear filters</button>
        </p>
      )}

      {!isPending && sorted.length > 0 && view === 'treemap' && (
        <BoothTreemap
          items={sorted.map((b) => ({ ...b, leaderParty: partyByName[b.leader] ?? null }))}
          metric={treeColor}
          sizeMetric={treeSize}
          onSelect={(id) => navigate(`/elections/${electionId}/booth/${id}`)}
        />
      )}

      {!isPending && sorted.length > 0 && view === 'map' && (
        <BoothMap items={sorted} electionId={electionId} />
      )}

      {!isPending && sorted.length > 0 && view === 'table' && (
        <FilterableTable
          rows={sorted}
          getRowKey={(b) => b.id}
          searchPlaceholder="Search booths by name…"
          columns={[
            { key: 'name', label: 'Booth', filterValue: (b) => `${b.name ?? ''} PS-${b.serial}`, render: (b) => (
              <Link to={`/elections/${electionId}/booth/${b.id}`} className="block truncate font-semibold text-slate-900 hover:text-accent-700" title={boothName(b)}>{boothName(b)}</Link>
            ) },
            { key: 'serial', label: 'PS no.', className: 'tabular-nums text-slate-400', filterValue: (b) => b.serial, render: (b) => `PS-${b.serial}` },
            { key: 'leader', label: 'Leader', render: (b) => b.leader ? (
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

      {!isPending && sorted.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((b) => {
            const reported = (b.totalValid ?? 0) > 0;
            const c = colorForName(b.leader);
            return (
              <Link
                key={b.id}
                to={`/elections/${electionId}/booth/${b.id}`}
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
                        <span className="truncate font-medium" style={{ color: c }} title={partyByName[b.leader] ? `${b.leader} (${partyByName[b.leader]})` : b.leader}>
                          {b.leader}{partyByName[b.leader] ? <span className="text-slate-400"> · {partyByName[b.leader]}</span> : null}
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
              </Link>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
