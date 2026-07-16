import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { colorForCandidate, num } from '../components/elections/helpers.js';

const pct = (n) => `${((n ?? 0) * 100).toFixed(1)}%`;

/** A small labelled analytics badge shown on type/year rollup rows. */
function Badge({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    accent: 'border-accent-200 bg-accent-50 text-accent-700',
  };
  return (
    <span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap border px-2 py-1 text-xs ${tones[tone]}`}>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="uppercase tracking-wide text-[10px] opacity-70">{label}</span>
    </span>
  );
}

function Chevron({ open }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      ▸
    </span>
  );
}

/** Level 3 — a single constituency, links to its overview. */
function ConstituencyRow({ c }) {
  const w = c.winner;
  return (
    <Link
      to={`/elections/${c.electionId}`}
      className="group grid gap-2 border-t border-slate-100 px-4 py-3.5 transition hover:bg-[#fbfaf7] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_100px_120px] md:items-center md:gap-4"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-accent-700">
            {c.assemblyNo != null ? `${c.assemblyNo}-` : ''}{c.assemblyName}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {[c.parlName, c.state].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <div className="min-w-0">
        {w ? (
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForCandidate(w.name, w.party) }} />
            <span className="truncate text-sm text-slate-700">
              <span className="font-medium text-slate-900">{w.name}</span>
              {w.party ? <span className="text-slate-500"> · {w.party}</span> : null}
            </span>
            {w.share != null && (
              <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-slate-600 md:ml-2">{pct(w.share)}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-400">No result yet</span>
        )}
      </div>
      <div className="text-xs tabular-nums text-slate-600 md:text-right" title="Polling stations">
        <span className="text-slate-400 md:hidden">Booths: </span>{num(c.pollingStations)}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs tabular-nums text-slate-600 md:justify-end">
        <span><span className="text-slate-400 md:hidden">Electors: </span>{c.totalElectors != null ? num(c.totalElectors) : '—'}</span>
        <span className="text-slate-300 transition group-hover:text-slate-900">→</span>
      </div>
    </Link>
  );
}

/** Level 2 — a year within a type, expands to its constituencies. */
function YearGroup({ year, open, onToggle }) {
  return (
    <div className="border-t border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left transition hover:bg-[#fbfaf7]"
        aria-expanded={open}
      >
        <Chevron open={open} />
        <span className="text-sm font-semibold tabular-nums text-slate-900">{year.year ?? 'Undated'}</span>
        <span className="text-xs text-slate-400">
          {num(year.electionCount)} {year.electionCount === 1 ? 'constituency' : 'constituencies'}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Badge label="electors" value={num(year.totalElectors)} />
        </div>
      </button>
      {open && (
        <div className="bg-white">
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_100px_120px] gap-4 border-t border-slate-100 bg-[#fbfaf7] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 max-md:hidden">
            <div>Constituency</div>
            <div>Winner</div>
            <div className="text-right">Booths</div>
            <div className="text-right">Electors</div>
          </div>
          {(year.constituencies ?? []).map((c) => (
            <ConstituencyRow key={c.electionId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Level 1 — an election type, expands to its years. */
function TypeGroup({ type, open, onToggle, expandedYears, toggleYear }) {
  const yearCount = type.years?.length ?? 0;
  return (
    <section className="overflow-hidden border border-slate-300 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-[#f7f5f0] px-4 py-4 text-left transition hover:bg-[#f2efe8]"
        aria-expanded={open}
      >
        <Chevron open={open} />
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold text-slate-950">{type.electionType || 'Unspecified'}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {num(yearCount)} {yearCount === 1 ? 'election year' : 'election years'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Badge label="constituencies" value={num(type.electionCount)} tone="accent" />
          <Badge label="years" value={num(yearCount)} />
          <Badge label="electors" value={num(type.totalElectors)} />
        </div>
      </button>
      {open && (
        <div>
          {(type.years ?? []).map((y) => {
            const key = `${type.electionType}::${y.year}`;
            return (
              <YearGroup
                key={key}
                year={y}
                open={expandedYears.has(key)}
                onToggle={() => toggleYear(key)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ElectionsListPage() {
  const q = useQuery({ queryKey: ['elections', 'hierarchy'], queryFn: () => api.electionsHierarchy() });
  const types = q.data?.types ?? [];

  // Expansion state. Default-open the first type and its first year so the page
  // never lands fully collapsed on the (currently single) seeded election.
  const [expandedTypes, setExpandedTypes] = useState(null);
  const [expandedYears, setExpandedYears] = useState(null);

  const defaults = useMemo(() => {
    if (!types.length) return { t: new Set(), y: new Set() };
    const firstType = types[0];
    const firstYear = firstType.years?.[0];
    return {
      t: new Set([firstType.electionType]),
      y: firstYear ? new Set([`${firstType.electionType}::${firstYear.year}`]) : new Set(),
    };
  }, [types]);

  const openTypes = expandedTypes ?? defaults.t;
  const openYears = expandedYears ?? defaults.y;

  const toggleType = (k) => {
    const next = new Set(openTypes);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpandedTypes(next);
  };
  const toggleYear = (k) => {
    const next = new Set(openYears);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpandedYears(next);
  };

  const totals = useMemo(() => {
    let elections = 0;
    let electors = 0;
    for (const t of types) {
      elections += t.electionCount ?? 0;
      electors += t.totalElectors ?? 0;
    }
    return { elections, electors, types: types.length };
  }, [types]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-5">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Insights</div>
          <h1 className="text-[26px] font-semibold text-slate-950">Elections</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
            Drill down by election type, then year, then constituency. Select a constituency to
            inspect booth results, voter composition, and candidate reports.
          </p>
        </div>
        {q.data && types.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label="types" value={num(totals.types)} />
            <Badge label="constituencies" value={num(totals.elections)} tone="accent" />
            <Badge label="electors" value={num(totals.electors)} />
          </div>
        )}
      </header>

      {q.isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {q.isError && (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {q.error.message}
        </div>
      )}

      {q.data && types.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No elections yet. Upload a Form 20 to create one.
        </div>
      )}

      {types.length > 0 && (
        <div className="space-y-4">
          {types.map((t) => (
            <TypeGroup
              key={t.electionType}
              type={t}
              open={openTypes.has(t.electionType)}
              onToggle={() => toggleType(t.electionType)}
              expandedYears={openYears}
              toggleYear={toggleYear}
            />
          ))}
        </div>
      )}
    </div>
  );
}
