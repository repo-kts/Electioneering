import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { num } from '../components/elections/helpers.js';

/** A small labelled analytics badge shown on type/constituency rollup rows. */
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

/** Level 2 — a single constituency. Shows only the constituency's fixed
 *  identity (nothing that varies by year — no winner, no year). Opens the
 *  constituency page, where years are chosen from a dropdown. */
function ConstituencyRow({ c }) {
  const years = c.yearCount ?? c.years?.length ?? 0;
  return (
    <Link
      to={`/elections/${c.latestElectionId}`}
      className="group grid gap-2 border-t border-slate-100 px-4 py-3.5 transition hover:bg-[#fbfaf7] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_120px] md:items-center md:gap-4"
    >
      <div className="min-w-0">
        <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-accent-700">
          {c.assemblyNo != null ? `${c.assemblyNo}-` : ''}{c.assemblyName}
        </span>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">Assembly constituency</p>
      </div>
      <div className="min-w-0 truncate text-sm text-slate-600" title={c.parlName ?? ''}>
        <span className="text-slate-400 md:hidden">Parliamentary: </span>{c.parlName || '—'}
      </div>
      <div className="min-w-0 truncate text-sm text-slate-600" title={c.state ?? ''}>
        <span className="text-slate-400 md:hidden">State: </span>{c.state || '—'}
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
          {num(years)} {years === 1 ? 'year' : 'years'}
        </span>
        <span className="text-slate-300 transition group-hover:text-slate-900">→</span>
      </div>
    </Link>
  );
}

/** Level 1 — an election type, expands directly to its constituencies. */
function TypeGroup({ type, open, onToggle }) {
  const consCount = type.constituencyCount ?? type.constituencies?.length ?? 0;
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
            {num(consCount)} {consCount === 1 ? 'constituency' : 'constituencies'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Badge label="constituencies" value={num(consCount)} tone="accent" />
          <Badge label="years" value={num(type.yearCount)} />
          <Badge label="electors" value={num(type.totalElectors)} />
        </div>
      </button>
      {open && (
        <div>
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_120px] gap-4 border-t border-slate-100 bg-[#fbfaf7] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 max-md:hidden">
            <div>Constituency</div>
            <div>Parliamentary</div>
            <div>State</div>
            <div className="text-right">On record</div>
          </div>
          {(type.constituencies ?? []).map((c) => (
            <ConstituencyRow key={c.key} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ElectionsListPage() {
  const q = useQuery({ queryKey: ['elections', 'hierarchy'], queryFn: () => api.electionsHierarchy() });
  const types = q.data?.types ?? [];

  // Expansion state. Default-open the first type so the page never lands fully
  // collapsed on the (currently single) seeded election.
  const [expandedTypes, setExpandedTypes] = useState(null);

  const defaults = useMemo(() => {
    if (!types.length) return new Set();
    return new Set([types[0].electionType]);
  }, [types]);

  const openTypes = expandedTypes ?? defaults;

  const toggleType = (k) => {
    const next = new Set(openTypes);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpandedTypes(next);
  };

  const totals = useMemo(() => {
    let constituencies = 0;
    let electors = 0;
    for (const t of types) {
      constituencies += t.constituencyCount ?? 0;
      electors += t.totalElectors ?? 0;
    }
    return { constituencies, electors, types: types.length };
  }, [types]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-5">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Insights</div>
          <h1 className="text-[26px] font-semibold text-slate-950">Elections</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
            Drill down by election type, then constituency. Select a constituency to inspect its
            booth results and voter composition — switch between years once inside.
          </p>
        </div>
        {q.data && types.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label="types" value={num(totals.types)} />
            <Badge label="constituencies" value={num(totals.constituencies)} tone="accent" />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
