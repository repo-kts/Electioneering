import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../../lib/api.js';

const PALETTE = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
function colorFor(s, i = 0) {
  if (!s) return PALETTE[i % PALETTE.length];
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
const pct = (n) => `${((n ?? 0) * 100).toFixed(0)}%`;
const RELIGION_COLOR = { Hindu: '#8a6f2a', Christian: '#3f5f75', Muslim: '#24594b', Other: '#94a3b8' };

function Panel({ title, subtitle, children, tag }) {
  return (
    <div className="border border-slate-300 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-[#fbfaf7] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>}
        </div>
        {tag && (
          <span className="border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {tag}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function InsightsSection({ electionId, religionData = [], turnoutHistory = [] }) {
  // Previous election in this seat OF THE SAME TYPE (e.g. Assembly vs Assembly) —
  // never cross a Lok Sabha with an Assembly election, since the candidate sets differ.
  const swingPair = useMemo(() => {
    const current = turnoutHistory.find((t) => t.electionId === electionId);
    if (!current) return { prevElectionId: null };
    const sameType = turnoutHistory
      .filter((t) => t.electionType === current.electionType)
      .sort((a, b) => (a.electionYear ?? 0) - (b.electionYear ?? 0));
    const idx = sameType.findIndex((t) => t.electionId === electionId);
    const prev = idx > 0 ? sameType[idx - 1] : null;
    return {
      prevElectionId: prev?.electionId ?? null,
      electionType: current.electionType,
      currentYear: current.electionYear,
      prevYear: prev?.electionYear ?? null,
    };
  }, [turnoutHistory, electionId]);
  const prevElectionId = swingPair.prevElectionId;

  const communityQ = useQuery({
    queryKey: ['community-leaning', electionId],
    queryFn: () => api.communityLeaning(electionId, 'religion'),
    enabled: !!electionId,
  });
  const swingQ = useQuery({
    queryKey: ['swing', electionId, prevElectionId],
    queryFn: () => api.swing(prevElectionId, electionId),
    enabled: !!electionId && !!prevElectionId,
  });

  const religionTotal = religionData.reduce((s, r) => s + r.count, 0);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Religion mix donut */}
      <Panel
        title="Religion mix"
        subtitle="Inferred from voter names — estimated, not declared"
        tag={`${religionTotal.toLocaleString()} voters`}
      >
        {religionData.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No religion data — run classify on voters.</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={religionData} dataKey="count" nameKey="key" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {religionData.map((r, i) => (
                    <Cell key={r.key} fill={RELIGION_COLOR[r.key] ?? colorFor(r.key, i)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-1.5">
              {religionData.map((r, i) => (
                <li key={r.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3"
                    style={{ background: RELIGION_COLOR[r.key] ?? colorFor(r.key, i) }}
                  />
                  <span className="font-medium text-slate-700">{r.key}</span>
                  <span className="ml-auto tabular-nums text-slate-500">
                    {r.count.toLocaleString()} · {religionTotal ? pct(r.count / religionTotal) : '0%'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* Community × candidate cross-tab */}
      <Panel
        title="Community → candidate leaning"
        subtitle="Statistical estimate: booth demographics × Form 20 result"
        tag="ecological"
      >
        <CommunityCrossTab q={communityQ} />
      </Panel>

      {/* Swing — spans both columns */}
      <div className="lg:col-span-2">
        <Panel
          title="Cross-election swing"
          subtitle={
            prevElectionId
              ? `Vote-share change (points): ${swingPair.electionType} ${swingPair.prevYear ?? '—'} → ${swingPair.currentYear ?? '—'}`
              : `Needs an earlier ${swingPair.electionType ?? 'same-type'} in this seat to compare`
          }
          tag={prevElectionId ? `${swingPair.prevYear ?? '—'} → ${swingPair.currentYear ?? '—'}` : undefined}
        >
          <SwingView q={swingQ} enabled={!!prevElectionId} />
        </Panel>
      </div>
    </div>
  );
}

function CommunityCrossTab({ q }) {
  if (q.isError) return <p className="py-6 text-center text-sm text-rose-600">Failed to load.</p>;
  if (q.isPending) return <p className="py-6 text-center text-sm text-slate-400">Loading…</p>;
  const groups = q.data?.groups ?? [];
  if (groups.length === 0)
    return <p className="py-6 text-center text-sm text-slate-400">No community data yet.</p>;

  // Build candidate column set from the top candidates across groups.
  const candSet = new Set();
  for (const g of groups) for (const c of g.byCandidate.slice(0, 4)) candSet.add(c.candidate);
  const cands = Array.from(candSet);

  const shareOf = (g, cand) => g.byCandidate.find((c) => c.candidate === cand)?.estShare ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left font-medium text-slate-500">Community</th>
            {cands.map((c) => (
              <th key={c} className="px-2 py-1.5 text-center font-medium text-slate-500" title={c}>
                {c.split(' ')[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.group} className="border-t border-slate-200">
              <td className="px-2 py-1.5">
                <span className="font-medium text-slate-700">{g.group}</span>
                <span className="ml-1 text-xs text-slate-400">{g.voters}</span>
              </td>
              {cands.map((c) => {
                const s = shareOf(g, c);
                return (
                  <td
                    key={c}
                    className="px-2 py-1.5 text-center tabular-nums"
                    style={{ background: `rgba(36,89,75,${(s * 0.75).toFixed(2)})`, color: s > 0.5 ? '#fff' : '#334155' }}
                  >
                    {s > 0 ? pct(s) : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SwingView({ q, enabled }) {
  if (!enabled) return <p className="py-6 text-center text-sm text-slate-400">Only one election in this seat.</p>;
  if (q.isError) return <p className="py-6 text-center text-sm text-rose-600">Failed to load.</p>;
  if (q.isPending) return <p className="py-6 text-center text-sm text-slate-400">Loading…</p>;
  const candidates = (q.data?.candidates ?? []).filter((c) => Math.abs(c.delta) > 0.001);
  const flipped = (q.data?.booths ?? []).filter((b) => b.flipped);
  if (candidates.length === 0)
    return <p className="py-6 text-center text-sm text-slate-400">No matching booths to compare.</p>;
  const maxAbs = Math.max(...candidates.map((c) => Math.abs(c.delta)), 0.01);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        {candidates.map((c) => {
          const up = c.delta >= 0;
          const w = (Math.abs(c.delta) / maxAbs) * 100;
          return (
            <div key={c.candidate} className="flex items-center gap-2 text-sm">
              <span className="w-32 truncate text-slate-700" title={c.candidate}>{c.candidate}</span>
              <div className="relative flex h-4 flex-1 items-center">
                <div className="absolute left-1/2 h-full w-px bg-slate-300" />
                <div
                  className={`h-3 ${up ? 'ml-[50%] bg-accent-600' : 'mr-[50%] self-end bg-rose-600'}`}
                  style={{ width: `${w / 2}%`, marginLeft: up ? '50%' : `${50 - w / 2}%` }}
                />
              </div>
              <span className={`w-14 text-right tabular-nums ${up ? 'text-accent-700' : 'text-rose-700'}`}>
                {up ? '+' : ''}{(c.delta * 100).toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border border-slate-200 bg-[#fbfaf7] p-3">
        <div className="mb-2 text-xs font-medium text-slate-500">
          Flipped booths ({flipped.length})
        </div>
        {flipped.length === 0 ? (
          <p className="text-sm text-slate-400">No booths changed winner.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {flipped.slice(0, 8).map((b) => (
              <li key={b.serial} className="flex items-center gap-2">
                <span className="font-medium text-slate-600">PS-{b.serial}</span>
                <span className="text-slate-400">{b.leaderA}</span>
                <span className="text-slate-300">→</span>
                <span className="font-medium text-slate-700">{b.leaderB}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
