// "Party vote-share over time" — one stacked bar per election year for a
// constituency, showing how each party's support rose or fell. Mirrors the
// booth-history page's "Vote results by election" chart (Top-N fold + shared
// StackTooltip), but keyed by YEAR instead of election type. Scoped to a single
// electionType so Assembly and Lok Sabha aren't compared on one axis.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { Surface, Loading, ErrorBox } from '../ui/kit.jsx';
import { api } from '../../lib/api.js';
import { colorForParty, num } from '../elections/helpers.js';
import { StackTooltip } from '../elections/chartTooltips.jsx';

const GRID = '#e7e5de';
const OTHERS = '#94a3b8';

export default function PartyShareTimeline({
  assemblyNo,
  assemblyName,
  electionType,
  title = 'Party vote-share over time',
  subtitle = 'How each party’s support shifted year by year. Use Top-N to focus and toggle votes vs share of the valid vote.',
}) {
  const [topN, setTopN] = useState('3'); // '3' | 'custom' | 'all'
  const [customN, setCustomN] = useState(5);
  const [metric, setMetric] = useState('votes'); // 'votes' | 'share'

  const q = useQuery({
    enabled: !!(assemblyNo || assemblyName),
    queryKey: ['partyTimeline', assemblyNo, assemblyName, electionType],
    queryFn: () => api.partyTimeline({ assemblyNo, assemblyName, electionType }),
  });

  const parties = q.data?.parties ?? [];

  const { rows, series, totalSeries } = useMemo(() => {
    const years = [...(q.data?.years ?? [])].reverse(); // chronological (oldest → newest)
    const limit = topN === 'all' ? parties.length : topN === 'custom' ? Math.max(1, Number(customN) || 1) : Number(topN);
    const top = parties.slice(0, limit);
    const rest = parties.slice(limit);
    const topSet = new Set(top);

    const rows = years.map((y) => {
      const row = { label: y.electionYear ?? '—' };
      const denom = metric === 'share' && y.totalValid > 0 ? y.totalValid : 1;
      let other = 0;
      for (const p of parties) {
        const raw = y.byParty[p] ?? 0;
        const val = metric === 'share' ? +((raw / denom) * 100).toFixed(1) : raw;
        if (topSet.has(p)) row[p] = val;
        else other += val;
      }
      if (rest.length && other > 0) row.Others = metric === 'share' ? +other.toFixed(1) : other;
      return row;
    });

    const series = top.map((p) => ({ key: p, color: colorForParty(p) }));
    if (rest.length) series.push({ key: 'Others', color: OTHERS });
    return { rows, series, totalSeries: parties.length };
  }, [q.data, parties, topN, customN, metric]);

  const isShare = metric === 'share';
  const fmt = isShare ? (v) => `${v}%` : num;

  return (
    <Surface
      title={title}
      subtitle={subtitle}
      right={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Show
            <select
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
            >
              <option value="3">Top 3</option>
              <option value="custom">Custom</option>
              <option value="all">All{totalSeries ? ` (${totalSeries})` : ''}</option>
            </select>
            {topN === 'custom' && (
              <input
                type="number"
                min="1"
                max={totalSeries || undefined}
                value={customN}
                onChange={(e) => setCustomN(e.target.value)}
                onBlur={(e) => setCustomN(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Number of parties to show"
                className="w-16 border border-slate-300 bg-white px-2 py-1 text-xs font-medium tabular-nums text-slate-700"
              />
            )}
          </label>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            {[['votes', 'Votes'], ['share', 'Share %']].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMetric(v)}
                className={`px-3 py-1 text-xs font-medium transition ${metric === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {q.isPending && <Loading className="h-40" />}
      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && rows.length === 0 && (
        <p className="border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
          No election results recorded for this constituency yet.
        </p>
      )}
      {q.data && rows.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rows} margin={{ left: 8, right: 16, top: 20, bottom: 8 }} barCategoryGap="28%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={isShare ? 44 : 56}
              allowDecimals={false}
              {...(isShare ? { domain: [0, 100], unit: '%' } : {})}
            />
            <Tooltip content={<StackTooltip formatValue={fmt} />} cursor={{ fill: '#eef0ec' }} />
            <Legend />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.key}
                fill={s.color}
                stackId="votes"
                maxBarSize={96}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Surface>
  );
}
