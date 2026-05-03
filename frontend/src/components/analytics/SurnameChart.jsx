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
import { surnameData } from '../../data/voterDemographics.js';

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
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.name}</div>
      <div>{p.count.toLocaleString()} voters</div>
    </div>
  );
}

export default function SurnameChart() {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Voters by Surname</div>
          <div className="chart-sub">Distribution across all registered voters</div>
        </div>
        <span className="chart-tag">{surnameData.length} surnames</span>
      </div>
      <div className="chart-canvas-wrap tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={surnameData} margin={{ top: 24, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#F1F3F6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#0F172A', fontWeight: 600, fontSize: 12 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={36}>
              <LabelList
                dataKey="count"
                position="top"
                style={{ fill: '#1E40AF', fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
