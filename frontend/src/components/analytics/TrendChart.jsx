// A single-series year-over-year chart with a Bar / Line / Area view switcher,
// so the user can read a trend the way they prefer. Renders its own Surface
// card; the view toggle sits in the card's right slot. Optional `cells` colours
// individual bars (e.g. margin by winning party); line/area use `color`.
import { useId, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList, Cell,
} from 'recharts';
import { Surface } from '../ui/kit.jsx';

const GRID = '#e7e5de';
const VIEW_OPTS = [['bar', 'Bar'], ['line', 'Line'], ['area', 'Area']];

export default function TrendChart({
  title,
  subtitle,
  data,
  dataKey,
  name,
  color = '#334155',
  cells = null,
  unit = '',
  domain,
  height = 260,
  xKey = 'year',
  defaultView = 'bar',
  labels = true,
  children,
}) {
  const [view, setView] = useState(defaultView);
  const gradId = useId().replace(/:/g, '');
  const fmt = (v) => (v == null ? '—' : `${v}${unit}`);
  const yProps = {
    tick: { fontSize: 11 },
    width: unit === '%' ? 44 : 56,
    ...(domain ? { domain } : {}),
    ...(unit === '%' ? { unit } : {}),
  };
  const labelEl = labels ? (
    <LabelList dataKey={dataKey} position="top" fontSize={10} fill="#64748b" formatter={(v) => (v == null ? '' : `${v}${unit}`)} />
  ) : null;

  const toggle = (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
      {VIEW_OPTS.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={`px-2.5 py-1 text-xs font-medium transition ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Surface title={title} subtitle={subtitle} right={toggle}>
      {!data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No data to compare.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {view === 'bar' ? (
            <BarChart data={data} margin={{ left: 8, right: 16, top: 20, bottom: 8 }} barCategoryGap="28%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis {...yProps} />
              <Tooltip formatter={(v) => [fmt(v), name]} cursor={{ fill: '#f7f5f0' }} />
              <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={64}>
                {cells && data.map((_, i) => <Cell key={i} fill={cells[i] ?? color} />)}
                {labelEl}
              </Bar>
            </BarChart>
          ) : view === 'line' ? (
            <LineChart data={data} margin={{ left: 8, right: 16, top: 20, bottom: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis {...yProps} />
              <Tooltip formatter={(v) => [fmt(v), name]} />
              <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls>
                {labelEl}
              </Line>
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ left: 8, right: 16, top: 20, bottom: 8 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis {...yProps} />
              <Tooltip formatter={(v) => [fmt(v), name]} />
              <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} connectNulls>
                {labelEl}
              </Area>
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
      {children}
    </Surface>
  );
}
