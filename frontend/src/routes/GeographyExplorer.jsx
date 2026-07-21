import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Loading, ErrorBox } from '../components/ui/kit.jsx';
import { colorForParty, colorForCandidate, benchmarkFor, num, pct } from '../components/elections/helpers.js';
import { geoRollupStory, seatsByParty } from '../components/analytics/narrative.js';

/**
 * Navigable geography drill that replaces the old flat constituency table.
 *   State → Parliamentary seat → Constituency (→ then the constituency page).
 * Middle tier is the Parliamentary seat because state / parlName / assemblyName
 * are the reliable geography stored on every Election (there is no district
 * field). Levels with a single child auto-collapse so no empty click is forced.
 *
 * Props mirror the old ConstituencyListPage so App.jsx wiring is a drop-in:
 *   matchType = "Assembly Election" | "Lok Sabha Election" | null (all, booth mode)
 *   boothMode = jump the constituency straight into its booth grid (?booths=1)
 */
export default function GeographyExplorer({ title, subtitle, matchType = null, boothMode = false }) {
  // Booth mode dedups constituencies across election types (one Mandrem, not
  // one-per-type), so it reads the merged `constituencies` rollup instead of
  // the type→year hierarchy that the Assembly / Lok Sabha modes use.
  const q = useQuery({
    queryKey: boothMode ? ['constituencies'] : ['elections', 'hierarchy'],
    queryFn: () => (boothMode ? api.constituencies() : api.electionsHierarchy()),
  });
  const [params, setParams] = useSearchParams();

  // Normalize to a flat list of constituency tiles the drill can group by state/parl.
  const all = useMemo(() => {
    if (boothMode) {
      return (q.data?.constituencies ?? []).map((c) => ({
        ...c,
        yearCount: c.years?.length ?? c.electionCount ?? 0,
        pollingStations: c.distinctBooths ?? 0,
        electionType: c.types?.length > 1 ? `${c.electionCount} elections` : c.types?.[0] ?? '',
      }));
    }
    const out = [];
    for (const t of q.data?.types ?? []) {
      if (matchType && t.electionType !== matchType) continue;
      for (const c of t.constituencies ?? []) out.push({ ...c, electionType: t.electionType });
    }
    return out;
  }, [q.data, matchType, boothMode]);

  const byState = useMemo(() => groupBy(all, (c) => c.state || 'Unknown state'), [all]);
  const stateNames = useMemo(() => [...byState.keys()].sort(), [byState]);

  // Auto-collapse single-child levels.
  const selectedState = params.get('state') || (stateNames.length === 1 ? stateNames[0] : null);
  const stateRows = selectedState ? byState.get(selectedState) ?? [] : [];
  const byParl = useMemo(() => groupBy(stateRows, (c) => c.parlName || 'Unassigned seat'), [stateRows]);
  const parlNames = useMemo(() => [...byParl.keys()].sort(), [byParl]);
  const selectedParl = params.get('parl') || (parlNames.length === 1 ? parlNames[0] : null);

  const level = !selectedState ? 'state' : !selectedParl ? 'parl' : 'constituency';
  const consRows = selectedParl ? (byParl.get(selectedParl) ?? []) : [];

  const go = (next) => {
    const p = new URLSearchParams();
    if (next.state) p.set('state', next.state);
    if (next.parl) p.set('parl', next.parl);
    setParams(p);
  };

  const crumbs = [{ label: title }];
  if (selectedState && stateNames.length > 1) crumbs.push({ label: selectedState, onClick: () => go({}) });
  if (level === 'constituency' && parlNames.length > 1) {
    crumbs[crumbs.length - 1] = { label: selectedState, onClick: () => go({}) };
    crumbs.push({ label: selectedParl });
  }

  return (
    <div>
      <header className="mb-6 border-b border-slate-300 pb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Insights</div>
        <DrillBreadcrumbs crumbs={crumbs} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold text-slate-950">
              {level === 'state' ? title : level === 'parl' ? selectedState : selectedParl}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
              {level === 'state' ? subtitle : geoRollupStory(level === 'parl' ? stateRows : consRows)}
            </p>
          </div>
          {q.data && all.length > 0 && (
            <span className="whitespace-nowrap border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
              {num(all.length)} {all.length === 1 ? 'constituency' : 'constituencies'}
            </span>
          )}
        </div>
      </header>

      {q.isPending && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Loading key={i} className="h-28" />)}
        </div>
      )}
      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && all.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No {matchType ? `${matchType.toLowerCase()}s` : 'elections'} yet. Upload a Form 20 to create one.
        </div>
      )}

      {/* State tiles */}
      {level === 'state' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stateNames.map((s) => (
            <RollupTile key={s} name={s} eyebrow="State" rows={byState.get(s)} onClick={() => go({ state: s })} />
          ))}
        </div>
      )}

      {/* Parliamentary tiles */}
      {level === 'parl' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parlNames.map((p) => (
            <RollupTile
              key={p}
              name={p}
              eyebrow="Parliamentary seat"
              rows={byParl.get(p)}
              onClick={() => go({ state: selectedState, parl: p })}
            />
          ))}
        </div>
      )}

      {/* Constituency tiles */}
      {level === 'constituency' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...consRows]
            .sort((a, b) => (a.assemblyName || '').localeCompare(b.assemblyName || ''))
            .map((c) => (
              <ConstituencyTile key={`${c.key}-${c.electionType}`} c={c} boothMode={boothMode} />
            ))}
        </div>
      )}
    </div>
  );
}

function DrillBreadcrumbs({ crumbs }) {
  // Breadcrumbs kit takes {label,to}; here some items navigate via onClick, so
  // render a compact inline trail instead.
  if (crumbs.length <= 1) return null;
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.onClick && !last ? (
              <button type="button" onClick={c.onClick} className="text-slate-500 hover:text-accent-700">
                {c.label}
              </button>
            ) : (
              <span className={last ? 'font-medium text-slate-800' : 'text-slate-500'}>{c.label}</span>
            )}
            {!last && <span className="text-slate-300">/</span>}
          </span>
        );
      })}
    </nav>
  );
}

/** Seats-by-party proportion bar. */
function SeatBar({ rows }) {
  const seats = seatsByParty(rows);
  const total = seats.reduce((s, x) => s + x.seats, 0) || 1;
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {seats.map((s) => (
          <span
            key={s.party}
            title={`${s.party}: ${s.seats}`}
            style={{ width: `${(s.seats / total) * 100}%`, background: colorForParty(s.party) }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {seats.slice(0, 4).map((s) => (
          <span key={s.party} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorForParty(s.party) }} />
            {s.party} <span className="tabular-nums text-slate-400">{s.seats}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A state / parliamentary rollup tile — click to drill in. */
function RollupTile({ name, eyebrow, rows = [], onClick }) {
  const electors = rows.reduce((s, c) => s + (c.totalElectors ?? 0), 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 border border-slate-300 bg-white p-4 text-left transition hover:border-accent-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{eyebrow}</div>
          <h3 className="truncate text-[15px] font-semibold text-slate-900 group-hover:text-accent-700">{name}</h3>
        </div>
        <span className="shrink-0 text-slate-300 transition group-hover:text-accent-600">→</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="tabular-nums"><strong className="text-slate-800">{num(rows.length)}</strong> seats</span>
        <span className="tabular-nums">
          {electors >= 100000 ? `${(electors / 100000).toFixed(1)}L` : num(electors)} electors
        </span>
      </div>
      <SeatBar rows={rows} />
    </button>
  );
}

/** A constituency tile — shows latest winner and competitiveness; links in. */
function ConstituencyTile({ c, boothMode }) {
  const to = boothMode
    ? `/elections/booths/${encodeURIComponent(c.assemblyNo)}/${encodeURIComponent(c.assemblyName)}`
    : `/elections/${c.latestElectionId}`;
  const w = c.winner;
  const bm = benchmarkFor(w?.share);
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 border border-slate-300 bg-white p-4 transition hover:border-accent-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {c.assemblyNo != null ? `${c.assemblyNo} · ` : ''}{c.electionType}
          </div>
          <h3 className="truncate text-[15px] font-semibold text-slate-900 group-hover:text-accent-700">
            {c.assemblyName}
          </h3>
        </div>
        <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold ${bm.cls}`} title={`Winner share ${bm.range}`}>
          {bm.label}
        </span>
      </div>

      {w ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForCandidate(w.name, w.party) }} />
          <span className="min-w-0 truncate text-slate-700">
            <span className="font-medium text-slate-900">{w.name}</span>
            {w.party ? <span className="text-slate-500"> · {w.party}</span> : null}
          </span>
          <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-slate-900">{pct(w.share)}</span>
        </div>
      ) : (
        <div className="text-sm text-slate-400">No result recorded</div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        <span className="tabular-nums">{num(c.yearCount)} {c.yearCount === 1 ? 'year' : 'years'} on record</span>
        <span className="tabular-nums">{num(c.pollingStations)} booths</span>
        <span className="font-medium text-accent-600 opacity-0 transition group-hover:opacity-100">
          {boothMode ? 'booths →' : 'open →'}
        </span>
      </div>
    </Link>
  );
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}
