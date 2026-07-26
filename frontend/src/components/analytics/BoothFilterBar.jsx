// Unified filter bar for the constituency booth listing. Drives all three
// views (grid / table / map) from one predicate so filters carry across views.
//
// Controls:
//   • Party  + Runner-up  — multi-select from the booths' actual (leader) parties
//   • Vote-share, Margin, Turnout, Booth size — dual-range sliders
//   • Quick presets       — one click sets several dimensions at once
//
// State is a plain object (see emptyBoothFilters); applyBoothFilters(items, f)
// is the pure predicate the page uses to filter before it sorts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { colorForParty } from '../elections/helpers.js';

// A booth's leader/runner-up party for filtering: prefer the party, fall back to
// the candidate name (so independents still appear as a selectable option).
const leaderPartyLabel = (b) => b.leaderParty ?? b.leader ?? null;
const runnerPartyLabel = (b) => b.runnerUpParty ?? b.runnerUp ?? null;

export function emptyBoothFilters() {
  return {
    parties: [],        // leader party labels to keep
    runnerParties: [],  // runner-up party labels to keep
    share: null,        // { min, max } in percent (winner's vote share)
    margin: null,       // { min, max } in percent
    turnout: null,      // { min, max } in percent
    size: null,         // { min, max } in registered-voter count
  };
}

const inRange = (v, r) => !r || (v >= r.min && v <= r.max);

export function applyBoothFilters(items, f) {
  return items.filter((b) => {
    if (f.parties.length && !f.parties.includes(leaderPartyLabel(b))) return false;
    if (f.runnerParties.length && !f.runnerParties.includes(runnerPartyLabel(b))) return false;
    if (!inRange((b.leaderShare ?? 0) * 100, f.share)) return false;
    if (!inRange((b.margin ?? 0) * 100, f.margin)) return false;
    if (!inRange((b.turnoutPct ?? 0) * 100, f.turnout)) return false;
    if (!inRange(b.registeredVoters ?? 0, f.size)) return false;
    return true;
  });
}

export function countActiveFilters(f) {
  return (
    (f.parties.length ? 1 : 0) +
    (f.runnerParties.length ? 1 : 0) +
    (f.share ? 1 : 0) +
    (f.margin ? 1 : 0) +
    (f.turnout ? 1 : 0) +
    (f.size ? 1 : 0)
  );
}

// ── Multi-select popover ─────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, colored }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition ${
          active ? 'border-accent-400 bg-accent-50 text-accent-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        {label}
        {active && <span className="rounded-full bg-accent-600 px-1.5 text-[10px] font-semibold text-white">{selected.length}</span>}
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" fill="currentColor"><path d="M2 4l4 4 4-4z" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 border border-slate-300 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5 text-[11px] text-accent-600">
            <button type="button" onClick={() => onChange(options.map((o) => o.value))} className="hover:underline">Select all</button>
            <button type="button" onClick={() => onChange([])} className="hover:underline">Clear</button>
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {options.length === 0 && <li className="px-3 py-2 text-center text-xs text-slate-400">No values</li>}
            {options.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                  {colored && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorForParty(o.value) }} />}
                  <span className="truncate" title={o.label}>{o.label}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-slate-400">{o.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Dual-range slider ────────────────────────────────────────────────────
function RangeControl({ label, min, max, step = 1, value, onChange, format }) {
  const active = !!value;
  const lo = value ? value.min : min;
  const hi = value ? value.max : max;
  const fmt = format ?? ((n) => n);

  // Emit null when the handles cover the full span (== no filter).
  const emit = (nlo, nhi) => {
    if (nlo <= min && nhi >= max) onChange(null);
    else onChange({ min: nlo, max: nhi });
  };
  const setLo = (v) => emit(Math.min(Number(v), hi), hi);
  const setHi = (v) => emit(lo, Math.max(Number(v), lo));

  const pct = (v) => ((v - min) / (max - min || 1)) * 100;

  return (
    <div className={`min-w-[150px] flex-1 border px-3 py-2 ${active ? 'border-accent-300 bg-accent-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="tabular-nums text-slate-600">{fmt(lo)} – {fmt(hi)}</span>
      </div>
      <div className="rangeslider">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-slate-200" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded bg-accent-500"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input type="range" min={min} max={max} step={step} value={lo} onChange={(e) => setLo(e.target.value)} aria-label={`${label} minimum`} />
        <input type="range" min={min} max={max} step={step} value={hi} onChange={(e) => setHi(e.target.value)} aria-label={`${label} maximum`} />
      </div>
    </div>
  );
}

// distinct {value,label,count} options for a party accessor, most common first.
function partyOptions(items, accessor) {
  const counts = new Map();
  for (const b of items) {
    const v = accessor(b);
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }));
}

export default function BoothFilterBar({ items, value, onChange, resultCount }) {
  const f = value;
  const set = (patch) => onChange({ ...f, ...patch });

  const leaderOpts = useMemo(() => partyOptions(items, leaderPartyLabel), [items]);
  const runnerOpts = useMemo(() => partyOptions(items, runnerPartyLabel), [items]);

  // Bounds + thresholds for the sliders and presets, from the actual data.
  const bounds = useMemo(() => {
    const sizes = items.map((b) => b.registeredVoters ?? 0);
    const sizeMax = Math.max(100, ...sizes);
    const withTurnout = items.map((b) => (b.turnoutPct ?? 0) * 100).filter((t) => t > 0);
    const avgTurnout = withTurnout.length ? Math.round(withTurnout.reduce((s, t) => s + t, 0) / withTurnout.length) : 60;
    const sortedSizes = [...sizes].sort((a, b) => a - b);
    const p67 = sortedSizes.length ? sortedSizes[Math.floor(sortedSizes.length * 0.67)] : 0;
    return { sizeMax, avgTurnout, sizeP67: p67 };
  }, [items]);

  // Quick presets — the app's vote-share competitiveness bands (see benchmarkFor
  // in helpers.js). Each sets the winner's-share range, so clicking toggles it.
  const presets = useMemo(() => [
    { key: 'safe', label: 'Safe 75+', dot: '#16a34a', title: "Winner took 75%+ of the vote", state: { ...emptyBoothFilters(), share: { min: 75, max: 100 } } },
    { key: 'favorable', label: 'Favorable 50–75', dot: '#65a30d', title: "Winner took 50–75% of the vote", state: { ...emptyBoothFilters(), share: { min: 50, max: 75 } } },
    { key: 'battleground', label: 'Battleground 30–50', dot: '#d97706', title: "Winner took 30–50% of the vote", state: { ...emptyBoothFilters(), share: { min: 30, max: 50 } } },
    { key: 'difficult', label: 'Difficult 0–30', dot: '#e11d48', title: "Winner took under 30% of the vote", state: { ...emptyBoothFilters(), share: { min: 0, max: 30 } } },
  ], []);

  const sameFilters = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const activePreset = presets.find((p) => sameFilters(p.state, f))?.key;
  const active = countActiveFilters(f);

  const pctFmt = (n) => `${n}%`;
  const numFmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <div className="mb-4 border border-slate-300 bg-[#fbfaf7]">
      {/* Preset row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick views</span>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.title}
            onClick={() => onChange(activePreset === p.key ? emptyBoothFilters() : p.state)}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition ${
              activePreset === p.key ? 'border-accent-500 bg-accent-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.dot, boxShadow: activePreset === p.key ? '0 0 0 1.5px rgba(255,255,255,.7)' : 'none' }} />
            {p.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <MultiSelect label="Party" options={leaderOpts} selected={f.parties} onChange={(v) => set({ parties: v })} colored />
        <MultiSelect label="Runner-up" options={runnerOpts} selected={f.runnerParties} onChange={(v) => set({ runnerParties: v })} colored />

        <RangeControl label="Vote-share" min={0} max={100} value={f.share} onChange={(v) => set({ share: v })} format={pctFmt} />
        <RangeControl label="Margin" min={0} max={100} value={f.margin} onChange={(v) => set({ margin: v })} format={pctFmt} />
        <RangeControl label="Turnout" min={0} max={100} value={f.turnout} onChange={(v) => set({ turnout: v })} format={pctFmt} />
        <RangeControl label="Booth size" min={0} max={bounds.sizeMax} step={10} value={f.size} onChange={(v) => set({ size: v })} format={numFmt} />
      </div>

      {/* Footer: result count + clear */}
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-700">{resultCount}</span> of {items.length} booths
          {active > 0 && <span className="ml-2 text-slate-400">· {active} filter{active === 1 ? '' : 's'} active</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(emptyBoothFilters())}
          disabled={active === 0}
          className="border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
