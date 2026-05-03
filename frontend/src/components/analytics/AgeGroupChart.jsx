import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ageGroupData, TOTAL_VOTERS } from '../../data/voterDemographics.js';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pct = ((p.count / TOTAL_VOTERS) * 100).toFixed(1);
  return (
    <div
      style={{
        background: '#0F172A',
        color: '#fff',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.name} years</div>
      <div>
        {p.count.toLocaleString()} · {pct}%
      </div>
    </div>
  );
}

export default function AgeGroupChart() {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Voters by Age Group</div>
          <div className="chart-sub">Distribution by age band</div>
        </div>
        <span className="chart-tag">4 bands</span>
      </div>
      <div className="chart-canvas-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ageGroupData} margin={{ top: 24, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#F1F3F6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#0F172A', fontWeight: 600, fontSize: 13 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={56}>
              <LabelList
                dataKey="count"
                position="top"
                style={{ fill: '#1E40AF', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
