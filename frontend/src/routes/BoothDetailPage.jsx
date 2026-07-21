import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import BoothMap from '../components/analytics/BoothMap.jsx';
import { DemographicCard } from '../components/analytics/BoothDemographics.jsx';
import FilterableTable from '../components/analytics/FilterableTable.jsx';
import DraggablePanel from '../components/analytics/DraggablePanel.jsx';
import { api } from '../lib/api.js';
import { partyColor, colorForParty, benchmarkFor } from '../components/elections/helpers.js';
import { boothStory } from '../components/analytics/narrative.js';

function colorFor(s) {
  if (!s) return '#94a3b8';
  const palette = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
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

function Recommendations({ benchmark, priority, recommendations }) {
  const items = recommendations ?? [];
  const isEmpty = items.length === 0;
  return (
    <Panel
      eyebrow="Booth strategy"
      title="Recommendations"
      right={
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-semibold ${benchmark.cls}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: benchmark.dot }} />
            {benchmark.label} · {benchmark.range}
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

// Plain-language read of the booth — the first thing an advisor should see.
function BoothBanner({ d }) {
  const s = boothStory(d);
  if (!s.headline) return null;
  return (
    <div className="mb-4 border border-slate-200 border-l-4 border-l-accent-500 bg-[#fbfaf7] px-4 py-3">
      <div className="text-sm font-semibold text-slate-900">{s.headline}</div>
      {s.detail && <div className="mt-0.5 text-sm text-slate-600">{s.detail}</div>}
    </div>
  );
}

// Tooltip for the vote chart — axis shows `key`; the other dimension (`sub`)
// only surfaces here on hover.
function VoteTooltip({ active, payload, subLabel }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-900">{d.key}</div>
      {d.sub && <div className="text-slate-600">{subLabel}: {d.sub}</div>}
      <div className="tabular-nums text-slate-700">{num(d.votes)} votes · {pct(d.share)}</div>
    </div>
  );
}

export default function BoothDetailPage() {
  const { id, psId } = useParams();
  const electionId = Number(id);
  const q = useQuery({ queryKey: ['booth', psId], queryFn: () => api.boothDetail(psId) });
  const d = q.data;
  const dem = d?.demographics;

  const electionName = d ? `${d.election.assemblyName} ${d.election.electionYear ?? ''}`.trim() : 'Election';
  const benchmark = benchmarkFor(d?.leader?.share);

  const [voteView, setVoteView] = useState('party'); // 'party' | 'candidate'

  // Votes aggregated by party — bars are parties, candidate shows on hover.
  const partyBars = useMemo(() => {
    const total = d?.totalValid ?? 0;
    const m = new Map();
    for (const c of d?.candidates ?? []) {
      const key = c.party?.trim() || c.name; // independents fall back to their name
      const e = m.get(key) ?? { key, votes: 0, top: null, topVotes: -1 };
      e.votes += c.votes;
      if (c.votes > e.topVotes) { e.top = c.name; e.topVotes = c.votes; }
      m.set(key, e);
    }
    return Array.from(m.values())
      .map((e) => ({ key: e.key, votes: e.votes, sub: e.top, color: colorForParty(e.key), share: total > 0 ? e.votes / total : 0 }))
      .sort((a, b) => b.votes - a.votes);
  }, [d]);

  // Votes per candidate — bars are candidates, party shows on hover.
  const candidateBars = useMemo(() => {
    const total = d?.totalValid ?? 0;
    return (d?.candidates ?? [])
      .map((c) => ({
        key: c.name,
        votes: c.votes,
        sub: c.party || 'Independent',
        color: partyColor(c.party) ?? colorFor(c.name),
        share: total > 0 ? c.votes / total : 0,
      }))
      .sort((a, b) => b.votes - a.votes);
  }, [d]);

  const voteBars = voteView === 'party' ? partyBars : candidateBars;

  // Voters whose name matches a candidate contesting this booth — surface them.
  const candidateNames = useMemo(
    () => new Set((d?.candidates ?? []).map((c) => c.name.trim().toLowerCase())),
    [d],
  );
  const voterName = (v) => (v.fullName ?? `${v.firstName} ${v.lastName}`).trim();
  const isCandidateVoter = (v) => candidateNames.has(voterName(v).toLowerCase());
  // Candidate-matches first, so they sit at the top of the list.
  const voters = useMemo(() => {
    const list = [...(d?.voters ?? [])];
    list.sort((a, b) => Number(isCandidateVoter(b)) - Number(isCandidateVoter(a)));
    return list;
  }, [d, candidateNames]);
  const matchedCount = (d?.voters ?? []).filter(isCandidateVoter).length;

  // Single-booth map item (uses the election-level geocode, if present).
  const mapItems = d
    ? [{
        id: d.ps.id,
        serial: d.ps.serial,
        name: d.ps.name,
        latitude: d.ps.latitude,
        longitude: d.ps.longitude,
        leader: d.leader?.name,
        leaderShare: d.leader?.share,
        totalValid: d.totalValid,
        registeredVoters: d.turnout.registered,
      }]
    : [];

  return (
    <div>
      <Breadcrumbs
        items={[
          {
            label: d?.election?.electionType || 'Elections',
            to: d?.election?.electionType === 'Lok Sabha Election' ? '/elections/lok-sabha' : '/elections/assembly',
          },
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
          {/* Plain-language read + action first, so the "what to do" leads. */}
          <BoothBanner d={d} />
          <Recommendations
            benchmark={benchmark}
            priority={d.priority}
            recommendations={d.recommendations}
          />

          {/* Hero — booth details on the left, location map on the right */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <div className="flex flex-col border border-slate-300 bg-white">
              <div className="border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Polling station</div>
                    <h1 className="text-[26px] font-semibold leading-tight text-slate-950">PS-{d.ps.serial}</h1>
                    <p className="mt-0.5 text-sm text-slate-600">{d.ps.name ?? '—'}</p>
                    {d.ps.address && <p className="mt-0.5 text-xs text-slate-400">{d.ps.address}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold ${benchmark.cls}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: benchmark.dot }} />
                    {benchmark.label} <span className="font-normal opacity-70">· {benchmark.range}</span>
                  </span>
                </div>
              </div>
              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3">
                <Kpi label="Total voters" value={num(d.turnout.registered)} />
                <Kpi label="Voted" value={num(d.turnout.voted)} accent="#16a34a" sub={pct(Math.min(d.turnout.pct, 1)) + ' turnout'} />
                <Kpi label="Valid votes" value={num(d.totalValid)} />
                <Kpi label="NOTA" value={num(d.ps.notaVotes)} />
                <Kpi label="Leader" value={d.leader?.name ?? '—'} accent={partyColor(d.leader?.party) ?? colorFor(d.leader?.name)} sub={d.leader ? pct(d.leader.share) : ''} />
                <Kpi label="Runner-up" value={d.runnerUp?.name ?? '—'} sub={d.runnerUp ? pct(d.runnerUp.share) : ''} />
              </div>

              {/* Booth details */}
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Booth details</div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
                  {[
                    ['Name', d.ps.name],
                    ['Polling station number', d.ps.serial != null ? `PS-${d.ps.serial}` : null],
                    ['Address', d.ps.address],
                    ['City / Village', d.ps.cityVillage],
                    ['Ward No.', d.ps.ward],
                    ['Tola / Mohalla', d.ps.tolaMohalla],
                    ['Post Office', d.ps.postOffice],
                    ['Legislative Assembly Name', d.election.assemblyName],
                    ['Legislative Assembly Number', d.election.assemblyNo],
                    ['Legislative Assembly Seat Type', d.election.assemblySeatType],
                    ['Loksabha Name', d.election.parlName],
                    ['Loksabha Number', d.election.parlNo],
                    ['Loksabha Seat Type', d.election.parlSeatType],
                    ['Police Station', d.ps.policeStation],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
                      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
                      <dd className="min-w-0 truncate text-right text-sm font-medium text-slate-800" title={value ?? ''}>{value ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/* Location map */}
            <div className="border border-slate-300 bg-white">
              <div className="border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Location</div>
                <h3 className="text-sm font-semibold text-slate-950">Booth on the map</h3>
              </div>
              <div className="p-3">
                <BoothMap items={mapItems} electionId={electionId} />
              </div>
            </div>
          </div>

          {/* Vote results (this booth) — toggle party / candidate */}
          <Panel
            title="Vote results (this booth)"
            className="mt-6"
            right={
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                {[['party', 'By party'], ['candidate', 'By candidate']].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVoteView(v)}
                    className={`px-3 py-1 text-xs font-medium transition ${voteView === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            {voteBars.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No Form 20 data recorded for this booth.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={voteBars} margin={{ left: 8, right: 16, top: 8, bottom: voteView === 'candidate' ? 72 : 24 }}>
                  <CartesianGrid stroke="#e7e5de" vertical={false} />
                  <XAxis
                    type="category"
                    dataKey="key"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={voteView === 'candidate' ? -22 : 0}
                    textAnchor={voteView === 'candidate' ? 'end' : 'middle'}
                    height={voteView === 'candidate' ? 90 : 30}
                  />
                  <YAxis type="number" tick={{ fontSize: 11 }} tickFormatter={num} />
                  <Tooltip content={<VoteTooltip subLabel={voteView === 'party' ? 'Top candidate' : 'Party'} />} cursor={{ fill: '#f7f5f0' }} />
                  <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                    {voteBars.map((b) => <Cell key={b.key} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          {/* Community composition — caste / community / religion / category */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DemographicCard title="Religion" data={dem?.byReligion ?? []} scheme="religion" />
            <DemographicCard title="Community" data={dem?.byCommunity ?? []} scheme="community" orderKeys={['Gen', 'OBC', 'SC', 'ST']} />
            <DemographicCard title="Category" data={dem?.byCategory ?? []} />
            <DemographicCard title="Caste" data={dem?.byCaste ?? []} />
          </div>

          {/* Age / gender / household */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DemographicCard title="Age groups" data={dem?.byAgeBucket ?? []} orderKeys={['18-25', '26-40', '41-60', '61-80', '80+']} />
            <DemographicCard title="Gender" data={dem?.byGender ?? []} scheme="gender" />
            <DemographicCard
              title="Households"
              data={dem?.byHouseholdSize ?? []}
              unitLabel="households"
              footer={
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  <span>First-time voters (≤19)</span>
                  <strong className="tabular-nums text-slate-800">{num(dem?.firstTimeVoters)}</strong>
                </div>
              }
            />
          </div>

          {/* Voter list — draggable panel */}
          <DraggablePanel
            title={`Voters in this booth (${num(d.turnout.registered)})`}
            right={matchedCount > 0 ? (
              <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {matchedCount} candidate {matchedCount === 1 ? 'match' : 'matches'}
              </span>
            ) : null}
            className="mt-4"
          >
            <FilterableTable
              rows={voters}
              getRowKey={(v) => v.id}
              searchPlaceholder="Search voters by name, EPIC…"
              rowClassName={(v) => (isCandidateVoter(v) ? 'bg-amber-50' : '')}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  filterValue: (v) => voterName(v),
                  className: 'font-medium text-slate-700',
                  render: (v) => (
                    <span className="flex items-center gap-2">
                      {voterName(v)}
                      {isCandidateVoter(v) && (
                        <span className="border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          Candidate
                        </span>
                      )}
                    </span>
                  ),
                },
                { key: 'age', label: 'Age' },
                { key: 'gender', label: 'Gender' },
                { key: 'caste', label: 'Caste' },
                { key: 'community', label: 'Community' },
                { key: 'religion', label: 'Religion' },
                { key: 'houseNumber', label: 'House' },
                { key: 'epic', label: 'EPIC', className: 'text-slate-400' },
              ]}
            />
          </DraggablePanel>

        </>
      )}
    </div>
  );
}
