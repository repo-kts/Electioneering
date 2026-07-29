// Nested "all years" treemap, grouped by ELECTION (year + type). Each election is
// a big cluster; inside it every booth is a small tile sized by that election's
// votes and coloured by its win-margin / turnout band (or the winning party). The
// election label sits on top of its mosaic.
//
// Data is real — each booth's `elections[]` history comes from the constituency
// endpoint (independent of the page's year/type filter).
//
// Rendered as hand-laid SVG (not Recharts) because a treemap library draws child
// tiles over the parent, hiding group labels; here we paint tiles first, then the
// election labels on top.
import { useMemo } from 'react';
import { colorForCandidate, num, pct } from '../elections/helpers.js';

// Short label for an election type, e.g. "Assembly Election" → "AE",
// "Lok Sabha Election" (the stored value) → "GE" (General Election).
const typeAbbr = (t) => (/lok\s*sabha/i.test(t) ? 'GE' : /assembly/i.test(t) ? 'AE' : (t || '').slice(0, 3).toUpperCase());

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

export default function BoothTreemapNested({ items, metric = 'margin', typeFilter = 'all', onSelect }) {
  const isParty = metric === 'party';
  const colour = COLOUR[metric] ?? COLOUR.margin;
  const fillOf = (t) => (isParty ? (t.color || '#94a3b8') : bandFor(colour.bands, colour.of(t)).color);

  const { yearCells, tiles } = useMemo(() => {
    // Group every booth's per-election records by the election (year + type),
    // optionally narrowed to a single election type.
    const byElection = new Map();
    for (const b of items) {
      for (const e of b.elections ?? []) {
        if (!(e.votes > 0)) continue;
        if (typeFilter !== 'all' && e.electionType !== typeFilter) continue;
        const label = `${e.year ?? '—'} ${typeAbbr(e.electionType)}`.trim();
        const g = byElection.get(label) ?? { label, sortKey: e.year ?? 0, rows: [] };
        g.rows.push({
          booth: b,
          year: e.year,
          votes: e.votes,
          margin: e.margin ?? 0,
          turnoutPct: e.turnoutPct ?? 0,
          leader: e.leader,
          party: e.leaderParty ?? null,
          color: colorForCandidate(e.leader, e.leaderParty),
        });
        byElection.set(label, g);
      }
    }
    const groups = [...byElection.values()].sort((a, b) => a.sortKey - b.sortKey); // oldest first
    const groupItems = groups.map((g) => ({ label: g.label, value: g.rows.reduce((s, r) => s + r.votes, 0) }));
    const yearCells = [];
    layout(groupItems, 0, 0, W, H, yearCells);

    const tiles = [];
    for (const cell of yearCells) {
      const g = byElection.get(cell.label);
      const inner = [];
      const rows = g.rows.map((r) => ({ ...r, value: r.votes })).sort((a, b) => b.value - a.value);
      layout(rows, cell.x, cell.y, cell.w, cell.h, inner);
      for (const t of inner) tiles.push({ ...t, label: cell.label });
    }
    return { yearCells, tiles };
  }, [items, typeFilter]);

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
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="Booths by election">
        {tiles.map((t) => (
          <g key={`${t.label}-${t.booth.id}`} onClick={() => onSelect?.(t.booth.id)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={fillOf(t)} stroke="#ffffff" strokeWidth={0.7} />
            <title>{`PS-${t.booth.serial} · ${t.label}\n${t.leader ?? '—'}${t.party ? ` (${t.party})` : ''}\n${num(t.votes)} votes · margin ${pct(t.margin)} · turnout ${pct(t.turnoutPct)}`}</title>
            {t.w > 30 && t.h > 15 && (
              <text x={t.x + 3} y={t.y + 11} fontSize={7.5} fontWeight={600}
                style={{ fill: '#0b1220', stroke: '#ffffff', strokeWidth: 1.4, paintOrder: 'stroke', pointerEvents: 'none' }}>
                {`PS-${t.booth.serial}`}
              </text>
            )}
          </g>
        ))}
        {yearCells.map((c) => (
          <rect key={`b-${c.label}`} x={c.x} y={c.y} width={c.w} height={c.h} fill="none" stroke="#ffffff" strokeWidth={4} pointerEvents="none" />
        ))}
        {yearCells.map((c) => (
          <text key={`l-${c.label}`} x={c.x + 10} y={c.y + 30} fontSize={24} fontWeight={800}
            style={{ fill: '#0b1220', stroke: '#ffffff', strokeWidth: 4.5, paintOrder: 'stroke', pointerEvents: 'none' }}>
            {c.label}
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
        Each big block is an election (year · type — AE = Assembly, GE = General Election) · inside, every booth is a tile
        sized by its votes and coloured by {isParty ? 'the winning party' : colour.label.toLowerCase()}. Hover a
        tile for its numbers; click to open the booth.
      </p>
    </div>
  );
}
