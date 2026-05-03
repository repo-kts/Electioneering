import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { voteShare } from '../../data/results.js';
import { PARTY_COLORS } from '../../data/parties.js';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        background: '#0F172A',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 2 }}>{p.label}</strong>
      {p.value}% · {p.votes}
    </div>
  );
}

export default function VoteShareDonut() {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Vote share</div>
          <div className="chart-sub">% of valid votes</div>
        </div>
        <span className="chart-tag">89.5%</span>
      </div>
      <div className="donut-wrap">
        <div className="donut-canvas-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={voteShare}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                stroke="#FFFFFF"
                strokeWidth={4}
                paddingAngle={1}
              >
                {voteShare.map((p) => (
                  <Cell key={p.code} fill={PARTY_COLORS[p.code]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <div className="donut-center-num">2.84M</div>
            <div className="donut-center-lbl">Total cast</div>
          </div>
        </div>

        <div className="donut-list">
          {voteShare.map((p) => (
            <div className="donut-row" key={p.code}>
              <div className="swatch" style={{ background: PARTY_COLORS[p.code] }} />
              <div className="name">
                {p.label} <span className="meta">{p.sub}</span>
              </div>
              <div className="pct">{p.value}%</div>
              <div className="votes">{p.votes}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
