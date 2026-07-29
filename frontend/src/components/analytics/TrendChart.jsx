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
  info,
  data,
  dataKey,
  name,
  color = '#334155',
  cells = null,
  unit = '',
  domain,
  height = 260,
  xKey = 'year',
  xLabel = 'Election year',
  yLabel,
  defaultView = 'bar',
  labels = true,
  children,
}) {
  const [view, setView] = useState(defaultView);
  const gradId = useId().replace(/:/g, '');
  const fmt = (v) => (v == null ? '—' : `${v}${unit}`);

  // Axis titles (Recharts <XAxis/YAxis label>). Y defaults to the series name.
  const xAxisLabel = { value: xLabel, position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#64748b' } };
  const yAxisLabel = { value: yLabel ?? name, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } };
  const chartMargin = { left: 16, right: 16, top: 20, bottom: 24 };

  // For the line/area views on a numeric (year) X axis, pad the axis by ±5 units
  // so the first/last points don't sit jammed on the edges. Only applies when
  // every X value is a real number (guards the '—'/missing-year case, which
  // keeps the default category axis). Bar view stays categorical.
  const xVals = (data ?? []).map((d) => Number(d[xKey])).filter((v) => Number.isFinite(v));
  const numericX = xVals.length > 0 && xVals.length === (data?.length ?? 0);
  const xMin = numericX ? Math.min(...xVals) - 5 : 0;
  const xMax = numericX ? Math.max(...xVals) + 5 : 0;
  // Show the padded endpoints (min-5 / max+5) as ticks too, alongside the actual
  // election years, so the axis visibly starts/ends at e.g. 2012 … 2027.
  const xTicks = numericX
    ? Array.from(new Set([xMin, ...xVals, xMax])).sort((a, b) => a - b)
    : undefined;
  const xPadProps = numericX
    ? { type: 'number', domain: [xMin, xMax], ticks: xTicks, allowDecimals: false, tickFormatter: (v) => String(v) }
    : {};
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
    <Surface title={title} subtitle={subtitle} info={info} right={toggle}>
      {!data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No data to compare.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {view === 'bar' ? (
            <BarChart data={data} margin={chartMargin} barCategoryGap="28%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} label={xAxisLabel} />
              <YAxis {...yProps} label={yAxisLabel} />
              <Tooltip formatter={(v) => [fmt(v), name]} cursor={{ fill: '#f7f5f0' }} />
              <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={64}>
                {cells && data.map((_, i) => <Cell key={i} fill={cells[i] ?? color} />)}
                {labelEl}
              </Bar>
            </BarChart>
          ) : view === 'line' ? (
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} label={xAxisLabel} {...xPadProps} />
              <YAxis {...yProps} label={yAxisLabel} />
              <Tooltip formatter={(v) => [fmt(v), name]} />
              <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls>
                {labelEl}
              </Line>
            </LineChart>
          ) : (
            <AreaChart data={data} margin={chartMargin}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} label={xAxisLabel} {...xPadProps} />
              <YAxis {...yProps} label={yAxisLabel} />
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
