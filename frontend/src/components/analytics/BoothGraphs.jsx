// Graph view for the constituency booth listing — a coordinated dashboard over
// the *filtered* booth set (same BoothFilterBar drives it as grid/table). Four
// charts, each answering one question, all built on the app's Recharts + party
// palette conventions:
//
//   1. Turnout × Winner-share scatter  — the booth-level correlation (flagship)
//   2. Booths led by party             — who controls how many booths
//   3. Competitiveness spread          — how contested (Tight→Safe, status hues)
//   4. Turnout distribution            — mobilization spread across booths
//
// Colour follows the entity (party), never rank; competitiveness uses reserved
// status hues shown *with* labels, never colour-alone.
import { useMemo } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, LabelList, Legend,
} from 'recharts';
import { colorForParty, num } from '../elections/helpers.js';

// Margin → competitiveness band (party-agnostic). Kept local so the graph view
// is self-contained. Hexes match the app's status ramp (emerald→rose).
const BANDS = [
  { key: 'Tight', color: '#e11d48', test: (m) => m < 0.03 },
  { key: 'Lean', color: '#d97706', test: (m) => m < 0.1 },
  { key: 'Clear', color: '#65a30d', test: (m) => m < 0.2 },
  { key: 'Safe', color: '#059669', test: () => true },
];
const bandFor = (m) => BANDS.find((b) => b.test(m)) ?? BANDS[BANDS.length - 1];

const partyOf = (b) => b.leaderParty ?? b.leader ?? 'Unknown';
const ACCENT = '#2f6f5e';

// Vote-share bands for the per-party distribution (15-point buckets, 0→100).
const SHARE_BANDS = [
  { label: '0–15%', lo: 0, hi: 15 },
  { label: '15–30%', lo: 15, hi: 30 },
  { label: '30–45%', lo: 30, hi: 45 },
  { label: '45–60%', lo: 45, hi: 60 },
  { label: '60–75%', lo: 60, hi: 75 },
  { label: '75%+', lo: 75, hi: 100.01 },
];

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="mb-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {subtitle && <div className="text-[11px] text-slate-400">{subtitle}</div>}
      </div>
      {empty ? <div className="flex h-[240px] items-center justify-center text-xs text-slate-400">{empty}</div> : children}
    </div>
  );
}

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="border border-slate-300 bg-white px-2.5 py-2 text-xs shadow-pop">
      <div className="font-semibold text-slate-800">{d.name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
        <span className="text-slate-600">{d.leader}</span>
        <span className="text-slate-400">· {d.party}</span>
      </div>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-slate-500">
        <dt>Winner share</dt><dd className="text-right tabular-nums text-slate-700">{d.y.toFixed(1)}%</dd>
        <dt>Turnout</dt><dd className="text-right tabular-nums text-slate-700">{d.x.toFixed(1)}%</dd>
        <dt>Margin</dt><dd className="text-right tabular-nums text-slate-700">{d.margin.toFixed(1)}%</dd>
        <dt>Electors</dt><dd className="text-right tabular-nums text-slate-700">{num(d.z)}</dd>
      </dl>
    </div>
  );
}

function BarTip({ active, payload, label, valueLabel }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs shadow-pop">
      <span className="flex items-center gap-1.5">
        {d.payload.color && <span className="h-2 w-2 rounded-full" style={{ background: d.payload.color }} />}
        <span className="font-medium text-slate-700">{label ?? d.payload.label}</span>
        <span className="tabular-nums text-slate-500">{num(d.value)} {valueLabel}</span>
      </span>
    </div>
  );
}

function GroupedTip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-slate-300 bg-white px-2.5 py-2 text-xs shadow-pop">
      <div className="mb-1 font-semibold text-slate-800">{label} vote</div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="contents">
            <dt className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.dataKey}
            </dt>
            <dd className="text-right tabular-nums text-slate-700">
              {num(p.value)}{total ? <span className="text-slate-400"> · {((p.value / total) * 100).toFixed(0)}%</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function BoothGraphs({ items, onSelect }) {
  const reported = useMemo(() => items.filter((b) => (b.totalValid ?? 0) > 0), [items]);

  // Top-3 parties across the constituency, ranked by total votes
  // (Σ per-booth share × booth valid votes). Colour follows the party.
  const topParties = useMemo(() => {
    const votes = new Map();
    for (const b of reported) {
      const tv = b.totalValid ?? 0;
      for (const [party, share] of Object.entries(b.byParty ?? {})) {
        votes.set(party, (votes.get(party) ?? 0) + share * tv);
      }
    }
    return Array.from(votes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([party]) => ({ party, color: colorForParty(party) }));
  }, [reported]);

  // For each vote-share band, how many booths each top-3 party landed in.
  const shareDist = useMemo(() => {
    const parties = topParties.map((p) => p.party);
    return SHARE_BANDS.map((band) => {
      const row = { label: band.label };
      for (const p of parties) row[p] = 0;
      for (const b of reported) {
        for (const p of parties) {
          const s = (b.byParty?.[p] ?? 0) * 100;
          if (s > 0 && s >= band.lo && s < band.hi) row[p] += 1;
        }
      }
      return row;
    });
  }, [reported, topParties]);

  // 1. Scatter — booths grouped by leading party so the legend is party-keyed.
  const scatterByParty = useMemo(() => {
    const groups = new Map();
    for (const b of reported) {
      const party = partyOf(b);
      const color = colorForParty(party);
      const pt = {
        id: b.id,
        name: b.name ? `PS-${b.serial} · ${b.name}` : `PS-${b.serial}`,
        leader: b.leader ?? '—',
        party,
        color,
        x: (b.turnoutPct ?? 0) * 100,
        y: (b.leaderShare ?? 0) * 100,
        z: b.registeredVoters ?? 0,
        margin: (b.margin ?? 0) * 100,
      };
      const g = groups.get(party) ?? { party, color, points: [] };
      g.points.push(pt);
      groups.set(party, g);
    }
    return Array.from(groups.values()).sort((a, b) => b.points.length - a.points.length);
  }, [reported]);

  // 2. Booths led per party.
  const ledByParty = useMemo(() => {
    const counts = new Map();
    for (const b of reported) {
      const p = partyOf(b);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count, color: colorForParty(label) }))
      .sort((a, b) => b.count - a.count);
  }, [reported]);

  // 3. Competitiveness spread (Tight → Safe).
  const compSpread = useMemo(() => {
    const counts = new Map(BANDS.map((b) => [b.key, 0]));
    for (const b of reported) counts.set(bandFor(b.margin ?? 0).key, counts.get(bandFor(b.margin ?? 0).key) + 1);
    return BANDS.map((b) => ({ label: b.key, count: counts.get(b.key), color: b.color }));
  }, [reported]);

  // 4. Turnout distribution — 10-point bins.
  const turnoutBins = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 10}–${i * 10 + 10}`, count: 0 }));
    for (const b of items) {
      const t = (b.turnoutPct ?? 0) * 100;
      if (t <= 0) continue;
      const idx = Math.min(9, Math.floor(t / 10));
      bins[idx].count += 1;
    }
    return bins;
  }, [items]);

  const noResults = reported.length === 0;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Flagship correlation scatter spans full width */}
      <div className="lg:col-span-2">
        <ChartCard
          title="Turnout vs winner's vote-share"
          subtitle="Each bubble is a booth · size = registered electors · colour = leading party. Top-left = low-turnout strongholds; bottom = split booths."
          empty={noResults ? 'No booths with Form 20 results in the current filter.' : null}
        >
          {!noResults && (
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis type="number" dataKey="x" name="Turnout" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} tickCount={6} />
                <YAxis type="number" dataKey="y" name="Winner share" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} width={40} tickCount={6} />
                <ZAxis type="number" dataKey="z" range={[45, 420]} name="Electors" />
                <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: '3 3' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {scatterByParty.map((g) => (
                  <Scatter
                    key={g.party}
                    name={g.party}
                    data={g.points}
                    fill={g.color}
                    fillOpacity={0.68}
                    stroke="#fff"
                    strokeWidth={1}
                    onClick={(p) => onSelect?.(p?.id)}
                    cursor={onSelect ? 'pointer' : undefined}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          )}
          <div className="mt-1 text-center text-[10px] text-slate-400">Turnout % →</div>
        </ChartCard>
      </div>

      {/* Per-party vote-share distribution across booths (top 3 parties) */}
      <div className="lg:col-span-2">
        <ChartCard
          title="Vote-share distribution by party"
          subtitle={`How many booths each of the top ${topParties.length} part${topParties.length === 1 ? 'y' : 'ies'} landed in, by the vote-share they took.`}
          empty={noResults ? 'No booths with Form 20 results in the current filter.' : null}
        >
          {!noResults && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={shareDist} margin={{ top: 16, right: 8, bottom: 24, left: 4 }} barGap={2} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} label={{ value: 'Booths', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }} />
                <Tooltip content={<GroupedTip total={reported.length} />} cursor={{ fill: '#f7f5f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {topParties.map((p) => (
                  <Bar key={p.party} dataKey={p.party} fill={p.color} radius={[3, 3, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey={p.party} position="top" style={{ fontSize: 10, fill: '#94a3b8' }} formatter={(v) => (v > 0 ? v : '')} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-1 text-center text-[10px] text-slate-400">Vote-share band →</div>
        </ChartCard>
      </div>

      <ChartCard title="Booths led by party" subtitle={`${reported.length} booths with results`} empty={noResults ? 'No results yet.' : null}>
        {!noResults && (
          <ResponsiveContainer width="100%" height={Math.max(160, ledByParty.length * 46)}>
            <BarChart layout="vertical" data={ledByParty} margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
              <CartesianGrid horizontal={false} stroke="#eef2f7" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={64} />
              <Tooltip content={<BarTip valueLabel="booths" />} cursor={{ fill: '#f7f5f0' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                {ledByParty.map((d) => <Cell key={d.label} fill={d.color} />)}
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Competitiveness spread" subtitle="By winner→runner-up margin" empty={noResults ? 'No results yet.' : null}>
        {!noResults && (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={compSpread} margin={{ top: 12, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
              <Tooltip content={<BarTip valueLabel="booths" />} cursor={{ fill: '#f7f5f0' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={44}>
                {compSpread.map((d) => <Cell key={d.label} fill={d.color} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="lg:col-span-2">
        <ChartCard title="Turnout distribution" subtitle="Booths grouped into 10-point turnout bands">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={turnoutBins} margin={{ top: 12, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
              <Tooltip content={<BarTip valueLabel="booths" />} cursor={{ fill: '#f7f5f0' }} />
              <Bar dataKey="count" fill={ACCENT} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: '#94a3b8' }} formatter={(v) => (v > 0 ? v : '')} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 text-center text-[10px] text-slate-400">Turnout band (%)</div>
        </ChartCard>
      </div>
    </div>
  );
}
