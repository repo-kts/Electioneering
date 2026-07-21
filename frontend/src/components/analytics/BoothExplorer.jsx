import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Surface, Loading, ErrorBox } from '../ui/kit.jsx';
import { partyColor, colorFor, num, pct } from '../elections/helpers.js';
import BoothMap from './BoothMap.jsx';
import FilterableTable from './FilterableTable.jsx';

// Competitiveness chip styles — one shared vocabulary across the app.
const CLASS_STYLE = {
  'Safe-win': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Marginal-win': 'border-lime-200 bg-lime-50 text-lime-800',
  Swing: 'border-amber-200 bg-amber-50 text-amber-800',
  'Marginal-loss': 'border-orange-200 bg-orange-50 text-orange-800',
  'Safe-loss': 'border-rose-200 bg-rose-50 text-rose-800',
  'No-data': 'border-slate-200 bg-slate-50 text-slate-500',
};
const CLASS_LABEL = {
  'Safe-win': 'Stronghold',
  'Marginal-win': 'Narrow win',
  Swing: 'Swing',
  'Marginal-loss': 'Recoverable',
  'Safe-loss': 'Opposition',
  'No-data': 'No data',
};
// Higher = more worth acting on. Surfaces swing/recoverable booths first.
const OPP_BASE = { Swing: 100, 'Marginal-loss': 90, 'Marginal-win': 60, 'Safe-loss': 40, 'Safe-win': 20, 'No-data': 0 };

const SORTS = {
  opportunity: 'Opportunity',
  serial: 'Booth number',
  turnout: 'Turnout (low→high)',
  valid: 'Valid votes (high→low)',
};

export default function BoothExplorer({ electionId }) {
  const [view, setView] = useState('grid'); // grid | table | map
  const [sortKey, setSortKey] = useState('opportunity');
  const { show } = useToast();
  const qc = useQueryClient();

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

  const sorted = useMemo(() => {
    const arr = [...booths];
    if (sortKey === 'serial') arr.sort((a, b) => a.serial - b.serial);
    else if (sortKey === 'turnout') arr.sort((a, b) => a.turnoutPct - b.turnoutPct);
    else if (sortKey === 'valid') arr.sort((a, b) => (b.totalValid ?? 0) - (a.totalValid ?? 0));
    else arr.sort((a, b) => b.opportunity - a.opportunity || a.serial - b.serial);
    return arr;
  }, [booths, sortKey]);

  const isPending = leaningQ.isPending || targetsQ.isPending;

  return (
    <Surface
      title="Booths"
      subtitle="Every polling station, ranked by where you can gain the most. Open one for its full profile and voter list."
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

      {!isPending && booths.length > 0 && view === 'map' && (
        <BoothMap items={sorted} electionId={electionId} />
      )}

      {!isPending && booths.length > 0 && view === 'table' && (
        <FilterableTable
          rows={sorted}
          getRowKey={(b) => b.id}
          searchPlaceholder="Search booths by name…"
          columns={[
            { key: 'serial', label: 'Booth', filterValue: (b) => b.serial, render: (b) => (
              <Link to={`/elections/${electionId}/booth/${b.id}`} className="font-semibold text-slate-900 hover:text-accent-700">PS-{b.serial}</Link>
            ) },
            { key: 'name', label: 'Polling station', className: 'text-slate-600', render: (b) => <span className="truncate" title={b.name ?? ''}>{b.name ?? '—'}</span> },
            { key: 'classification', label: 'Status', filterValue: (b) => CLASS_LABEL[b.classification] ?? b.classification, render: (b) => (
              <span className={`inline-block border px-1.5 py-0.5 text-[11px] font-semibold ${CLASS_STYLE[b.classification] ?? CLASS_STYLE['No-data']}`}>
                {CLASS_LABEL[b.classification] ?? b.classification}
              </span>
            ) },
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

      {!isPending && booths.length > 0 && view === 'grid' && (
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">PS-{b.serial}</span>
                  <span className={`border px-1.5 py-0.5 text-[10px] font-semibold ${CLASS_STYLE[b.classification] ?? CLASS_STYLE['No-data']}`}>
                    {CLASS_LABEL[b.classification] ?? b.classification}
                  </span>
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
              </Link>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
