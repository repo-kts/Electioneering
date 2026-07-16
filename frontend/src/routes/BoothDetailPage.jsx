import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import {
  GenderPictograph, AgeDistribution, CommunityDonut, HouseholdPictograph,
} from '../components/analytics/DemographicVisuals.jsx';
import { api } from '../lib/api.js';

function colorFor(s) {
  if (!s) return '#94a3b8';
  const palette = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
const RELIGION_COLOR = { Hindu: '#8a6f2a', Christian: '#3f5f75', Muslim: '#24594b', Other: '#94a3b8' };
const PALETTE = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
const pct = (n) => `${((n ?? 0) * 100).toFixed(1)}%`;
const num = (n) => (n ?? 0).toLocaleString();

function Kpi({ label, value, sub, accent }) {
  return (
    <div className="border-l border-slate-300 bg-white px-4 py-3 first:border-l-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="mt-2 truncate text-[22px] font-semibold leading-none tabular-nums" style={{ color: accent ?? '#0f172a' }} title={String(value)}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Panel({ title, eyebrow, right, children, className = '' }) {
  return (
    <div className={`border border-slate-300 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
        <div>
          {eyebrow && <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{eyebrow}</div>}
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Priority accent convention shared with StrategyBrief: high=rose, medium=amber, low=slate.
const PRIORITY = {
  high: { badge: 'border-rose-200 bg-rose-50 text-rose-800', accent: '#e11d48' },
  medium: { badge: 'border-amber-200 bg-amber-50 text-amber-800', accent: '#d97706' },
  low: { badge: 'border-slate-300 bg-white text-slate-600', accent: '#94a3b8' },
};

// Classification badge tone by leaning.
const CLASS_TONE = {
  Stronghold: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Swing: 'border-amber-200 bg-amber-50 text-amber-800',
  'Opposition-leaning': 'border-rose-200 bg-rose-50 text-rose-800',
  'Low-turnout': 'border-sky-200 bg-sky-50 text-sky-800',
  'No-data': 'border-slate-300 bg-white text-slate-500',
};

function Recommendations({ classification, priority, recommendations }) {
  const items = recommendations ?? [];
  const isEmpty = !classification || classification === 'No-data' || items.length === 0;
  return (
    <Panel
      eyebrow="Booth strategy"
      title="Recommendations"
      right={
        <div className="flex items-center gap-2">
          <span className={`border px-2 py-0.5 text-xs font-semibold ${CLASS_TONE[classification] ?? CLASS_TONE['No-data']}`}>
            {classification ?? 'No data'}
          </span>
          {priority && (
            <span className={`border px-2 py-0.5 text-[11px] font-medium capitalize ${(PRIORITY[priority] ?? PRIORITY.low).badge}`}>
              {priority} priority
            </span>
          )}
        </div>
      }
      className="mt-6"
    >
      {isEmpty ? (
        <p className="py-3 text-center text-sm text-slate-400">
          Not enough Form 20 / voter data to generate recommendations for this booth yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => {
            const p = PRIORITY[r.priority] ?? PRIORITY.low;
            return (
              <div key={r.id} className="flex border border-slate-200 bg-white">
                <span className="w-1 shrink-0" style={{ background: p.accent }} aria-hidden="true" />
                <div className="min-w-0 flex-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{r.title}</h4>
                    <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-medium capitalize ${p.badge}`}>{r.priority}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{r.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export default function BoothDetailPage() {
  const { id, psId } = useParams();
  const electionId = Number(id);
  const q = useQuery({ queryKey: ['booth', psId], queryFn: () => api.boothDetail(psId) });
  const d = q.data;

  const electionName = d ? `${d.election.assemblyName} ${d.election.electionYear ?? ''}`.trim() : 'Election';
  const dem = d?.demographics;
  const candBars = (d?.candidates ?? []).map((c) => ({ name: c.name, votes: c.votes }));

  // Family blocs in this booth — group voters by house number.
  const families = useMemo(() => {
    const m = new Map();
    for (const v of d?.voters ?? []) {
      const key = (v.houseNumber ?? '').trim();
      if (!key) continue;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(v);
    }
    return Array.from(m.entries())
      .map(([house, members]) => ({
        house,
        members,
        head: members.reduce((a, b) => (b.age > a.age ? b : a), members[0]),
      }))
      .filter((f) => f.members.length > 1)
      .sort((a, b) => b.members.length - a.members.length);
  }, [d]);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Elections', to: '/elections' },
          { label: electionName, to: `/elections/${electionId}` },
          { label: d ? `PS-${d.ps.serial}` : 'Booth' },
        ]}
      />

      {q.isError && (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{q.error.message}</div>
      )}
      {q.isPending && <div className="h-40 animate-pulse bg-slate-200/70" />}

      {d && (
        <>
          <div className="mb-6 border-b border-slate-300 pb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Polling station</div>
            <h1 className="text-[26px] font-semibold text-slate-950">PS-{d.ps.serial}</h1>
            <p className="mt-1 text-sm text-slate-600">{d.ps.name ?? '—'}</p>
          </div>

          {/* Turnout / result KPIs */}
          <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Registered voters" value={num(d.turnout.registered)} />
            <Kpi label="Voted" value={num(d.turnout.voted)} accent="#16a34a" />
            <Kpi label="Turnout" value={pct(Math.min(d.turnout.pct, 1))} />
            <Kpi label="Valid votes" value={num(d.totalValid)} />
            <Kpi label="NOTA" value={num(d.ps.notaVotes)} />
            <Kpi label="Leader" value={d.leader?.name ?? '—'} accent={colorFor(d.leader?.name)} sub={d.leader ? pct(d.leader.share) : ''} />
          </div>

          {/* Recommendations */}
          <Recommendations
            classification={d.classification}
            priority={d.priority}
            recommendations={d.recommendations}
          />

          {/* Votes at this booth */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Votes by candidate (this booth)" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={candBars} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e7e5de" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v) => num(v)} />
                  <Bar dataKey="votes">
                    {candBars.map((c) => <Cell key={c.name} fill={colorFor(c.name)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Religion mix (inferred)">
              {(dem?.byReligion ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No voter data for this booth</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={dem.byReligion} dataKey="count" nameKey="key" innerRadius={40} outerRadius={72} paddingAngle={2}>
                        {dem.byReligion.map((r, i) => <Cell key={r.key} fill={RELIGION_COLOR[r.key] ?? PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-1">
                    {dem.byReligion.map((r, i) => (
                      <li key={r.key} className="flex items-center gap-2 text-sm">
                        <span className="inline-block h-3 w-3" style={{ background: RELIGION_COLOR[r.key] ?? PALETTE[i % PALETTE.length] }} />
                        <span className="flex-1 text-slate-600">{r.key}</span>
                        <span className="tabular-nums text-slate-500">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>

          {/* Demographics — pictorial */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Panel title="Caste / community"><CommunityDonut data={dem?.byCommunity ?? []} /></Panel>
            <Panel title="Age groups"><AgeDistribution data={dem?.byAgeBucket ?? []} /></Panel>
            <Panel title="Gender"><GenderPictograph data={dem?.byGender ?? []} /></Panel>
            <Panel title="Household size">
              <HouseholdPictograph data={dem?.byHouseholdSize ?? []} firstTimeVoters={dem?.firstTimeVoters} />
            </Panel>
          </div>

          {/* Family blocs */}
          <Panel
            eyebrow="Households"
            title="Family blocs"
            right={<span className="border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{families.length} families</span>}
            className="mt-4"
          >
            <p className="mb-3 text-sm text-slate-500">Multi-voter houses in this booth. Persuade the head to move the whole bloc.</p>
            {families.length === 0 ? (
              <p className="py-3 text-center text-sm text-slate-400">No multi-voter households — run “Rebuild households” or check house numbers.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {families.slice(0, 12).map((f) => (
                  <div key={f.house} className="border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">House #{f.house}</span>
                      <span className="border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700">{f.members.length} voters</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Head: <span className="font-medium text-slate-700">{f.head.fullName ?? `${f.head.firstName} ${f.head.lastName}`}</span> · {f.head.age}y
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Voter list */}
          <Panel title={`Voters in this booth (${num(d.turnout.registered)})`} className="mt-4">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Age</th>
                    <th className="px-2 py-2">Gender</th>
                    <th className="px-2 py-2">Religion</th>
                    <th className="px-2 py-2">House</th>
                    <th className="px-2 py-2">EPIC</th>
                  </tr>
                </thead>
                <tbody>
                  {d.voters.map((v) => (
                    <tr key={v.id} className="border-t border-slate-200">
                      <td className="px-2 py-1.5 font-medium text-slate-700">{v.fullName ?? `${v.firstName} ${v.lastName}`}</td>
                      <td className="px-2 py-1.5">{v.age}</td>
                      <td className="px-2 py-1.5">{v.gender}</td>
                      <td className="px-2 py-1.5">{v.religion ?? '—'}</td>
                      <td className="px-2 py-1.5">{v.houseNumber ?? '—'}</td>
                      <td className="px-2 py-1.5 text-slate-400">{v.epic}</td>
                    </tr>
                  ))}
                  {d.voters.length === 0 && (
                    <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-400">No voters mapped to this booth.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
