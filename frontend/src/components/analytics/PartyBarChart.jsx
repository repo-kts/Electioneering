import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { partyTotals } from '../../data/results.js';
import { PARTY_COLORS } from '../../data/parties.js';

const EXTRA_COLORS = { REG: '#0EA5E9', VRT: '#EC4899', OTH: '#94A3B8' };

function fmtAxis(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k';
  return v;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        background: '#0F172A',
        color: '#fff',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.name}</div>
      <div>Votes  {p.votes.toLocaleString()}</div>
    </div>
  );
}

export default function PartyBarChart() {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Party-wise vote totals</div>
          <div className="chart-sub">Round 3 · 437 of 488 reported</div>
        </div>
        <span className="chart-tag">Live</span>
      </div>
      <div className="chart-canvas-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={partyTotals} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#F1F3F6" vertical={false} />
            <XAxis
              dataKey="code"
              tick={{ fill: '#0F172A', fontWeight: 600, fontSize: 13 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAxis}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
              {partyTotals.map((p) => (
                <Cell key={p.code} fill={PARTY_COLORS[p.code] || EXTRA_COLORS[p.code] || '#94A3B8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
