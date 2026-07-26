// PROTOTYPE — nested "all years" treemap, grouped by ELECTION YEAR. Each year is
// a big cluster (like a team/player group); inside it every booth is a small tile
// sized by that year's votes and coloured by its win-margin (or turnout) band.
// The year label sits on top of its mosaic.
//
// Per-year data is SIMULATED (the DB holds one election) so the nesting can be
// seen. `synthYears` is deterministic per booth — swap it for real per-booth ×
// per-election API data once multiple years are loaded.
//
// Rendered as hand-laid SVG (not Recharts) because a treemap library draws child
// tiles over the parent, hiding group labels; here we paint tiles first, then the
// year labels on top.
import { useMemo } from 'react';
import { colorForCandidate, num, pct } from '../elections/helpers.js';

const MARGIN_BANDS = [
  { key: 'Tight (<3%)', color: '#e11d48', test: (v) => v < 0.03 },
  { key: 'Lean (<10%)', color: '#e0891b', test: (v) => v < 0.1 },
  { key: 'Clear (<20%)', color: '#84cc16', test: (v) => v < 0.2 },
  { key: 'Safe (20%+)', color: '#059669', test: () => true },
];
const TURNOUT_BANDS = [
  { key: 'Low (<55%)', color: '#e11d48', test: (v) => v < 0.55 },
  { key: 'Mid (55–70%)', color: '#e0891b', test: (v) => v < 0.7 },
  { key: 'High (70–85%)', color: '#84cc16', test: (v) => v < 0.85 },
  { key: 'Very high (85%+)', color: '#059669', test: () => true },
];
const COLOUR = {
  margin: { label: 'Win margin', bands: MARGIN_BANDS, of: (y) => y.margin },
  turnout: { label: 'Turnout', bands: TURNOUT_BANDS, of: (y) => y.turnoutPct },
};
const bandFor = (bands, v) => bands.find((b) => b.test(v)) ?? bands[bands.length - 1];

const rnd = (seed) => { const x = Math.sin(seed) * 43758.5453; return x - Math.floor(x); };

// Simulate K past elections for a booth from its real latest numbers.
function synthYears(b, K = 4) {
  const start = 2022;
  const out = [];
  for (let i = 0; i < K; i++) {
    const r = (n) => rnd(b.id * 100 + i * 13 + n);
    const turnoutPct = Math.min(0.98, Math.max(0.42, (b.turnoutPct ?? 0.7) * (0.85 + r(3) * 0.3)));
    const votes = Math.max(60, Math.round((b.totalValid ?? 400) * (0.65 + r(1) * 0.7)));
    const margin = Math.min(0.9, Math.max(0.004, (b.margin ?? 0.3) * (0.3 + r(2) * 1.6)));
    const mainLeads = r(5) > 0.25;
    const leader = (mainLeads ? b.leader : b.runnerUp) ?? b.leader ?? 'Winner';
    const party = (mainLeads ? b.leaderParty : b.runnerUpParty) ?? null;
    out.push({ year: start - i * 5, votes, margin, turnoutPct, leader, party, color: colorForCandidate(leader, party) });
  }
  return out;
}

// Binary (median-cut) treemap: always splits the longer side, giving squarish
// tiles. Pushes {..item, x, y, w, h} into `out`. Items should be pre-sorted.
function layout(items, x, y, w, h, out) {
  if (!items.length) return;
  if (items.length === 1) { out.push({ ...items[0], x, y, w, h }); return; }
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  let acc = 0, i = 0;
  for (; i < items.length - 1; i++) { acc += items[i].value; if (acc * 2 >= total) { i++; break; } }
  const a = items.slice(0, i), b = items.slice(i);
  const av = a.reduce((s, it) => s + it.value, 0);
  if (w >= h) {
    const aw = w * (av / total);
    layout(a, x, y, aw, h, out);
    layout(b, x + aw, y, w - aw, h, out);
  } else {
    const ah = h * (av / total);
    layout(a, x, y, w, ah, out);
    layout(b, x, y + ah, w, h - ah, out);
  }
}

const W = 1000, H = 600;

export default function BoothTreemapNested({ items, metric = 'margin', onSelect }) {
  const isParty = metric === 'party';
  const colour = COLOUR[metric] ?? COLOUR.margin;
  const fillOf = (t) => (isParty ? (t.color || '#94a3b8') : bandFor(colour.bands, colour.of(t)).color);

  const { yearCells, tiles } = useMemo(() => {
    const reported = items.filter((b) => (b.totalValid ?? 0) > 0);
    const byYear = new Map();
    for (const b of reported) {
      for (const yr of synthYears(b)) {
        const arr = byYear.get(yr.year) ?? [];
        arr.push({ booth: b, ...yr });
        byYear.set(yr.year, arr);
      }
    }
    const years = [...byYear.keys()].sort((a, b) => a - b); // oldest first
    const yearItems = years.map((y) => ({ year: y, value: byYear.get(y).reduce((s, r) => s + r.votes, 0) }));
    const yearCells = [];
    layout(yearItems, 0, 0, W, H, yearCells);

    const tiles = [];
    for (const cell of yearCells) {
      const inner = [];
      const rows = byYear.get(cell.year).map((r) => ({ ...r, value: r.votes })).sort((a, b) => b.value - a.value);
      layout(rows, cell.x, cell.y, cell.w, cell.h, inner);
      for (const t of inner) tiles.push({ ...t, year: cell.year });
    }
    return { yearCells, tiles };
  }, [items]);

  // Party legend: distinct winners across the whole view, with their booth-win
  // total (summed over years), most wins first.
  const partyLegend = useMemo(() => {
    const map = new Map();
    for (const t of tiles) {
      const key = t.party || t.leader || 'Unknown';
      const e = map.get(key) ?? { label: key, color: t.color || '#94a3b8', count: 0 };
      e.count += 1;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [tiles]);

  if (tiles.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No booths with results to chart.</p>;
  }

  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
        Prototype · multi-year data is simulated (DB has 1 election)
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="Booths by election year">
        {tiles.map((t) => (
          <g key={`${t.year}-${t.booth.id}`} onClick={() => onSelect?.(t.booth.id)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={fillOf(t)} stroke="#ffffff" strokeWidth={0.7} />
            <title>{`PS-${t.booth.serial} · ${t.year}\n${t.leader}${t.party ? ` (${t.party})` : ''}\n${num(t.votes)} votes · margin ${pct(t.margin)} · turnout ${pct(t.turnoutPct)}`}</title>
            {t.w > 30 && t.h > 15 && (
              <text x={t.x + 3} y={t.y + 11} fontSize={7.5} fontWeight={600}
                style={{ fill: '#0b1220', stroke: '#ffffff', strokeWidth: 1.4, paintOrder: 'stroke', pointerEvents: 'none' }}>
                {`PS-${t.booth.serial}`}
              </text>
            )}
          </g>
        ))}
        {yearCells.map((c) => (
          <rect key={`b-${c.year}`} x={c.x} y={c.y} width={c.w} height={c.h} fill="none" stroke="#ffffff" strokeWidth={4} pointerEvents="none" />
        ))}
        {yearCells.map((c) => (
          <text key={`l-${c.year}`} x={c.x + 10} y={c.y + 30} fontSize={26} fontWeight={800}
            style={{ fill: '#0b1220', stroke: '#ffffff', strokeWidth: 4.5, paintOrder: 'stroke', pointerEvents: 'none' }}>
            {c.year}
          </text>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {isParty ? 'Winning party' : colour.label}
        </span>
        {isParty
          ? partyLegend.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                {p.label} <span className="tabular-nums text-slate-400">{p.count}</span>
              </span>
            ))
          : colour.bands.map((band) => (
              <span key={band.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
                {band.key}
              </span>
            ))}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Each big block is an election year · inside, every booth is a tile sized by its votes and coloured by
        {' '}{isParty ? 'the winning party' : colour.label.toLowerCase()}. Hover a tile for its numbers; click to open the booth.
      </p>
    </div>
  );
}
