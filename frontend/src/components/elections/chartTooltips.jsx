// Shared Recharts tooltip components used by the booth-history and constituency
// charts so both read identically. Kept framework-light: pure presentational.
import { colorForCandidate, colorFor, num } from './helpers.js';

// Stacked-bar tooltip: every segment in the hovered bar, largest first, with the
// stack total underneath. Zero-value series are dropped. `formatValue` lets a
// caller render percentages instead of raw counts.
export function StackTooltip({ active, payload, label, formatValue = num }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0).sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, p) => s + p.value, 0);
  return (
    <div className="border border-slate-300 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 text-sm font-semibold text-slate-900">{label}</div>
      {rows.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="truncate text-slate-600">{p.name}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatValue(p.value)}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-slate-200 pt-1.5">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold tabular-nums text-slate-900">{formatValue(total)}</span>
      </div>
    </div>
  );
}

// Tooltip for the per-election margin/win-share bars — names the winner + party
// so you can read who won each election straight off the chart.
export function WinnerTooltip({ active, payload, valueLabel }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = d.winnerParty ? colorForCandidate(d.winnerName, d.winnerParty) : colorFor(d.winnerName);
  return (
    <div className="border border-slate-300 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 text-sm font-semibold text-slate-900">{d.label}</div>
      {d.winnerName && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="text-slate-700">{d.winnerName}</span>
          <span className="text-slate-400">· {d.winnerParty || 'Ind.'}</span>
        </div>
      )}
      <div className="tabular-nums text-slate-600">{valueLabel}: <span className="font-semibold text-slate-900">{payload[0].value}%</span></div>
    </div>
  );
}
