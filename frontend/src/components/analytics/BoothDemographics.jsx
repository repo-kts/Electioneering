// Unified demographic card for the booth page. Every breakdown (caste,
// community, religion, category, age, gender, household size) renders as a
// pie by default, with a toggle to a ranked-bar view — one visual language,
// two useful angles on the same data.
import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PALETTE = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
function hashColor(s) {
  if (!s) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const COMMUNITY_COLOR = { Gen: '#3f5f75', OBC: '#8a6f2a', SC: '#6f4e37', ST: '#24594b' };
const RELIGION_COLOR = { Hindu: '#8a6f2a', Christian: '#3f5f75', Muslim: '#24594b', Sikh: '#5f6f52', Other: '#94a3b8' };
const GENDER_COLOR = { Male: '#3f5f75', M: '#3f5f75', Female: '#7a4e57', F: '#7a4e57', Other: '#8a6f2a' };

const num = (n) => (n ?? 0).toLocaleString();
const sharePct = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

function colorFor(key, scheme, i = 0) {
  if (scheme === 'community') return COMMUNITY_COLOR[key] ?? hashColor(key);
  if (scheme === 'religion') return RELIGION_COLOR[key] ?? hashColor(key);
  if (scheme === 'gender') return GENDER_COLOR[key] ?? hashColor(key);
  if (scheme === 'index') return PALETTE[i % PALETTE.length];
  return hashColor(key);
}

function Legend({ rows, total }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
          <span className="flex-1 truncate text-slate-600" title={r.key}>{r.key}</span>
          <span className="tabular-nums text-slate-500">{num(r.count)}</span>
          <span className="w-10 text-right tabular-nums text-slate-400">{sharePct(r.count, total)}</span>
        </li>
      ))}
    </ul>
  );
}

function PieView({ rows, total }) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={168}>
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="key" innerRadius={46} outerRadius={74} paddingAngle={2} stroke="none">
            {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${num(v)} · ${sharePct(v, total)}`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-slate-900">{num(total)}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{rows.length} groups</span>
      </div>
    </div>
  );
}

function BarView({ rows, total }) {
  const peak = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2.5 py-1">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 truncate text-slate-700" title={r.key}>
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
              {r.key}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">{num(r.count)} <span className="text-slate-400">· {sharePct(r.count, total)}</span></span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(r.count / peak) * 100}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A demographic breakdown card with a pie/bar toggle.
 * - `scheme`: 'community' | 'religion' | 'gender' | 'index' | undefined (hash)
 * - `orderKeys`: optional fixed key order (e.g. age bands, Gen/OBC/SC/ST)
 * - `unitLabel`: what one row counts (voters / households)
 * - `footer`: extra node under the card body
 */
export function DemographicCard({ title, data = [], scheme, orderKeys, unitLabel = 'voters', footer }) {
  const [view, setView] = useState('pie');

  const { rows, total } = useMemo(() => {
    let list = (data ?? []).filter((d) => d.count > 0 && d.key && d.key !== '—');
    if (orderKeys) {
      list = [...list].sort((a, b) => orderKeys.indexOf(a.key) - orderKeys.indexOf(b.key));
    }
    const t = list.reduce((a, r) => a + r.count, 0);
    const rowsWithColor = list.map((d, i) => ({ ...d, color: colorFor(d.key, orderKeys && !scheme ? 'index' : scheme, i) }));
    return { rows: rowsWithColor, total: t };
  }, [data, scheme, orderKeys]);

  return (
    <div className="border border-slate-300 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#fbfaf7] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <div className="text-[11px] tabular-nums text-slate-500">{num(total)} {unitLabel}</div>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
          {[['pie', 'Pie'], ['bar', 'Bar']].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[11px] font-medium transition ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No data for this booth</p>
        ) : (
          <>
            {view === 'pie' ? <PieView rows={rows} total={total} /> : <BarView rows={rows} total={total} />}
            <Legend rows={rows} total={total} />
          </>
        )}
        {footer}
      </div>
    </div>
  );
}
