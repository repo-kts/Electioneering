// Pictorial demographic visuals for a polling station.
// Data shape for each: Array<{ key: string, count: number }>.
// Colors are drawn from the app palette (colorFor / PALETTE) so booth pages
// stay visually consistent with the rest of analytics.
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { IconArray, PersonGlyph, HouseGlyph } from './Pictograph.jsx';

const PALETTE = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
function colorFor(s) {
  if (!s) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
// Stable, intuitive colors for the common gender labels; fall back to colorFor.
const GENDER_COLOR = { Male: '#3f5f75', M: '#3f5f75', Female: '#7a4e57', F: '#7a4e57', Other: '#8a6f2a' };
const genderColor = (k) => GENDER_COLOR[k] ?? colorFor(k);

const num = (n) => (n ?? 0).toLocaleString();
const share = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

function Empty() {
  return <p className="py-6 text-center text-sm text-slate-400">No voter data for this booth</p>;
}

function Legend({ rows, total }) {
  return (
    <ul className="mt-3 space-y-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-3 w-3 shrink-0" style={{ background: r.color }} />
          <span className="flex-1 truncate text-slate-600" title={r.key}>{r.key}</span>
          <span className="tabular-nums text-slate-500">{num(r.count)}</span>
          <span className="w-10 text-right tabular-nums text-slate-400">{share(r.count, total)}</span>
        </li>
      ))}
    </ul>
  );
}

// GENDER — icon array of person glyphs colored by gender, with a running total.
export function GenderPictograph({ data = [] }) {
  const rows = data.filter((d) => d.count > 0).map((d) => ({ ...d, color: genderColor(d.key) }));
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (total === 0) return <Empty />;
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">{num(total)}</span>
        <span className="text-xs text-slate-500">voters</span>
      </div>
      <IconArray segments={rows} glyphs={44} size={16} Glyph={PersonGlyph} />
      <Legend rows={rows} total={total} />
    </div>
  );
}

// AGE — single segmented horizontal bar (proportional), legend beneath.
// 2px surface gaps separate the segments (never a stroke).
export function AgeDistribution({ data = [] }) {
  const rows = data.filter((d) => d.count > 0).map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (total === 0) return <Empty />;
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden bg-white" role="img" aria-label="Age distribution">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="h-full"
            style={{
              width: `${(r.count / total) * 100}%`,
              background: r.color,
              marginLeft: i === 0 ? 0 : 2, // 2px surface gap between segments
            }}
            title={`${r.key}: ${num(r.count)}`}
          />
        ))}
      </div>
      <Legend rows={rows} total={total} />
    </div>
  );
}

// CASTE / COMMUNITY — proportional donut with a centered total + legend.
export function CommunityDonut({ data = [] }) {
  const rows = data.filter((d) => d.count > 0).map((d) => ({ ...d, color: colorFor(d.key) }));
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (total === 0) return <Empty />;
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="key" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none">
              {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [num(v), n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-slate-900">{num(total)}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">groups {rows.length}</span>
        </div>
      </div>
      <Legend rows={rows} total={total} />
    </div>
  );
}

// HOUSEHOLD SIZE — one row per bucket, house glyphs repeated proportionally.
export function HouseholdPictograph({ data = [], firstTimeVoters }) {
  const rows = data.filter((d) => d.count > 0).map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
  const total = rows.reduce((a, r) => a + r.count, 0);
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      {total === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const n = Math.max(1, Math.round((r.count / max) * 10)); // up to 10 houses in the widest row
            return (
              <li key={r.key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-xs text-slate-600" title={r.key}>{r.key}</span>
                <span className="flex flex-1 flex-wrap gap-[2px]">
                  {Array.from({ length: n }).map((_, i) => (
                    <HouseGlyph key={i} size={16} color={r.color} />
                  ))}
                </span>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-500">{num(r.count)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
        First-time voters (≤19): <strong className="text-slate-700">{num(firstTimeVoters)}</strong>
      </div>
    </div>
  );
}
