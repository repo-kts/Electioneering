// Treemap view for the constituency booth listing. Each leaf tile is a booth,
// sized by valid votes and filled by a discrete competitiveness/turnout band
// (clean, distinct hues — not a muddy gradient). Booths are nested under their
// leading candidate so each candidate's "territory" reads as a spatial cluster;
// a thin top stripe repeats the candidate colour. Click a tile → that booth.
import { useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { colorForCandidate, num, pct } from '../elections/helpers.js';

// Discrete bands, app status ramp (rose → amber → lime → emerald). Distinct
// hues read far cleaner than an interpolated gradient at treemap density.
const MARGIN_BANDS = [
  { key: 'Tight (<3%)', color: '#e11d48', test: (v) => v < 0.03 },
  { key: 'Lean (<10%)', color: '#f59e0b', test: (v) => v < 0.1 },
  { key: 'Clear (<20%)', color: '#84cc16', test: (v) => v < 0.2 },
  { key: 'Safe (20%+)', color: '#059669', test: () => true },
];
const TURNOUT_BANDS = [
  { key: 'Low (<55%)', color: '#e11d48', test: (v) => v < 0.55 },
  { key: 'Mid (55–70%)', color: '#f59e0b', test: (v) => v < 0.7 },
  { key: 'High (70–85%)', color: '#84cc16', test: (v) => v < 0.85 },
  { key: 'Very high (85%+)', color: '#059669', test: () => true },
];

const METRICS = {
  margin: { label: 'Win margin', bands: MARGIN_BANDS, of: (b) => b.margin ?? 0 },
  turnout: { label: 'Turnout', bands: TURNOUT_BANDS, of: (b) => b.turnoutPct ?? 0 },
};
const bandFor = (bands, v) => bands.find((band) => band.test(v)) ?? bands[bands.length - 1];

// What tile area is proportional to. Fractions (share/margin) are floored so a
// near-zero booth still shows a sliver rather than vanishing from the layout.
const SIZE_METRICS = {
  valid: { label: 'Valid votes', of: (b) => b.totalValid ?? 0 },
  voters: { label: 'Registered voters', of: (b) => b.registeredVoters ?? 0 },
  share: { label: 'Winner vote share', of: (b) => b.leaderShare ?? 0 },
  margin: { label: 'Win margin', of: (b) => b.margin ?? 0 },
};

// Single-line clip so a long label doesn't overrun its tile.
function clip(s, width) {
  const max = Math.max(3, Math.floor(width / 7));
  return s && s.length > max ? `${s.slice(0, max - 1)}…` : s || '';
}

// Recharts spreads each node's own fields onto the content component, so leaf
// tiles carry the booth fields we attached when building the data.
function TreeCell(props) {
  const { x, y, width, height, fill, stripe, label, onSelect, id } = props;

  // Only leaves carry a `label` (the synthetic root doesn't) — skip everything
  // else so the root wrapper never paints.
  if (label == null || width <= 0 || height <= 0) return null;

  const showText = width > 40 && height > 24;

  return (
    <g onClick={() => onSelect?.(id)} cursor={onSelect ? 'pointer' : undefined}>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#ffffff" strokeWidth={1} />
      {stripe && <rect x={x} y={y} width={width} height={3} fill={stripe} pointerEvents="none" />}
      {showText && (
        <text x={x + 6} y={y + 17} fontSize={12} fontWeight={600} style={{ fill: '#000000', stroke: 'none', pointerEvents: 'none' }}>
          {clip(label, width)}
        </text>
      )}
    </g>
  );
}

function TreeTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d || d.boothName == null) return null; // leaves only
  return (
    <div className="border border-slate-300 bg-white px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-slate-900">{d.serial != null ? `PS-${d.serial}` : d.boothName}</div>
      {d.serial != null && <div className="mb-1 text-xs text-slate-500">{d.boothName}</div>}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: d.stripe }} />
        <span className="text-slate-600">{d.leader}</span>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-slate-500">
        <dt>Registered voters</dt><dd className="text-right tabular-nums text-slate-800">{num(d.registered)}</dd>
        <dt>Valid votes</dt><dd className="text-right tabular-nums text-slate-800">{num(d.votes)}</dd>
        <dt>Winner share</dt><dd className="text-right tabular-nums text-slate-800">{pct(d.share)}</dd>
        <dt>Win margin</dt><dd className="text-right tabular-nums text-slate-800">{pct(d.margin)}</dd>
        <dt>Turnout</dt><dd className="text-right tabular-nums text-slate-800">{pct(d.turnoutPct)}</dd>
      </dl>
    </div>
  );
}

export default function BoothTreemap({ items, metric = 'margin', sizeMetric = 'voters', onSelect }) {
  const isParty = metric === 'party';
  const m = METRICS[metric] ?? METRICS.margin;
  const s = SIZE_METRICS[sizeMetric] ?? SIZE_METRICS.voters;

  // Flat: every booth is a top-level tile, sized by the chosen metric and sorted
  // biggest → smallest so the smallest lands in the last corner. Candidate is
  // carried via the top stripe + tooltip.
  const data = useMemo(() => (
    items
      .filter((b) => (b.totalValid ?? 0) > 0)
      .map((b) => {
        const stripe = colorForCandidate(b.leader, b.leaderParty);
        return {
          name: `${b.id}`,
          size: Math.max(s.of(b), 1e-4),
          id: b.id,
          boothName: b.name || `PS-${b.serial}`,
          label: b.serial != null ? `PS-${b.serial}` : (b.name || 'Booth'),
          serial: b.serial,
          leader: b.leader ?? 'Unreported',
          leaderParty: b.leaderParty ?? null,
          stripe,
          registered: b.registeredVoters ?? 0,
          votes: b.totalValid ?? 0,
          share: b.leaderShare ?? 0,
          margin: b.margin ?? 0,
          turnoutPct: b.turnoutPct ?? 0,
          fill: isParty ? stripe : bandFor(m.bands, m.of(b)).color,
          onSelect,
        };
      })
      .sort((a, b) => b.size - a.size)
  ), [items, m, s, isParty, onSelect]);

  // Colour legend: party wins (when colouring by party) or the metric bands.
  const partyLegend = useMemo(() => {
    const map = new Map();
    for (const d of data) {
      const key = d.leaderParty || d.leader || 'Unknown';
      const e = map.get(key) ?? { label: key, color: d.stripe, count: 0 };
      e.count += 1;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [data]);

  const leaderLegend = useMemo(() => {
    const seen = new Map();
    for (const d of data) if (!seen.has(d.leader)) seen.set(d.leader, d.stripe);
    return Array.from(seen.entries());
  }, [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No booths with results to chart.</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={460}>
        <Treemap data={data} dataKey="size" aspectRatio={4 / 3} isAnimationActive={false} content={<TreeCell />}>
          <Tooltip content={<TreeTip />} />
        </Treemap>
      </ResponsiveContainer>

      <div className="mt-3 space-y-2">
        {/* Colour legend: party wins when colouring by party, else metric bands */}
        {isParty ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Winning party</span>
            {partyLegend.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                {p.label} <span className="tabular-nums text-slate-400">{p.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{m.label}</span>
              {m.bands.map((band) => (
                <span key={band.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
                  {band.key}
                </span>
              ))}
            </div>
            {leaderLegend.length > 1 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Leading candidate</span>
                {leaderLegend.map(([leader, color]) => (
                  <span key={leader} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="h-2.5 w-4 rounded-sm border-t-2" style={{ borderColor: color, background: '#f1f5f9' }} />
                    {leader}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Tile size = {s.label.toLowerCase()} (largest first) · fill = {isParty ? 'winning party' : `${m.label.toLowerCase()} band`}{isParty ? '' : ' · top stripe = leading candidate'}. Click a tile to open the booth.
      </p>
    </div>
  );
}
