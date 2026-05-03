import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { turnout } from '../../data/results.js';
import { PARTY_COLORS } from '../../data/parties.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#0F172A',
        color: '#fff',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}:00 IST</div>
      {payload.map((p) => (
        <div
          key={p.dataKey}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
        >
          <span style={{ color: '#CBD5E1' }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

export default function TurnoutLineChart() {
  return (
    <div className="chart-row single">
      <div className="chart-card">
        <div className="chart-card-head">
          <div>
            <div className="chart-title">Hourly turnout</div>
            <div className="chart-sub">07:00 to 18:00 IST · cumulative</div>
          </div>
          <span className="chart-tag">vs. 2022</span>
        </div>
        <div className="chart-canvas-wrap tall">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={turnout} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="turnoutFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PARTY_COLORS.PNF} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={PARTY_COLORS.PNF} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F1F3F6" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 80]}
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(v) => v + '%'}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="prev"
                name="2022 cycle"
                stroke="#94A3B8"
                strokeWidth={1.6}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke={PARTY_COLORS.GUP}
                strokeWidth={1.6}
                strokeDasharray="3 4"
                dot={false}
                activeDot={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="today"
                name="Today's turnout"
                stroke={PARTY_COLORS.PNF}
                strokeWidth={2.5}
                fill="url(#turnoutFill)"
                dot={{ r: 3.5, fill: '#FFFFFF', stroke: PARTY_COLORS.PNF, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend">
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: PARTY_COLORS.PNF }} />
            Today's turnout <strong>63.4%</strong>
          </span>
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: '#94A3B8' }} />
            2022 same hour <strong>61.3%</strong>
          </span>
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: PARTY_COLORS.GUP }} />
            Forecast <strong>67.8%</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
