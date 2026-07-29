// The full per-election read of one booth: plain-language banner,
// recommendations, KPIs + booth details, location map, vote-result chart,
// demographic cards, and the voter list. Extracted from BoothDetailPage so the
// booth-wise station-history page can reuse the exact same single-election view.
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import BoothMap from './BoothMap.jsx';
import { DemographicCard } from './BoothDemographics.jsx';
import FilterableTable from './FilterableTable.jsx';
import DraggablePanel from './DraggablePanel.jsx';
import { partyColor, colorForParty, benchmarkFor, boothName, boothTag } from '../elections/helpers.js';
import { boothStory } from './narrative.js';
import InfoButton from '../ui/InfoButton.jsx';

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

function Panel({ title, eyebrow, right, info, children, className = '' }) {
  return (
    <div className={`border border-slate-300 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
        <div>
          {eyebrow && <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{eyebrow}</div>}
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
        {(right || info) && (
          <div className="flex shrink-0 items-center gap-2">
            {right}
            {info && <InfoButton text={info} />}
          </div>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Priority accent convention: high=rose, medium=amber, low=slate.
const PRIORITY = {
  high: { badge: 'border-rose-200 bg-rose-50 text-rose-800', accent: '#e11d48' },
  medium: { badge: 'border-amber-200 bg-amber-50 text-amber-800', accent: '#d97706' },
  low: { badge: 'border-slate-300 bg-white text-slate-600', accent: '#94a3b8' },
};

function Recommendations({ benchmark, leaderLabel, leaderDot, priority, recommendations }) {
  const items = recommendations ?? [];
  if (items.length === 0) return null;
  return (
    <Panel
      eyebrow="Booth strategy"
      title="Recommendations"
      right={
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-semibold ${benchmark.cls}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: benchmark.dot }} />
            {benchmark.label} · {benchmark.range}
            {leaderLabel && (
              <span className="ml-0.5 inline-flex items-center gap-1 border-l border-current/20 pl-1.5 font-medium opacity-90">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: leaderDot }} />
                {leaderLabel}
              </span>
            )}
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
    </Panel>
  );
}

function BoothBanner({ d }) {
  const s = boothStory(d);
  if (!s.headline) return null;
  return (
    <div className="mt-6 border border-slate-200 border-l-4 border-l-accent-500 bg-[#fbfaf7] px-4 py-3">
      <div className="text-sm font-semibold text-slate-900">{s.headline}</div>
      {s.detail && <div className="mt-0.5 text-sm text-slate-600">{s.detail}</div>}
    </div>
  );
}

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

/**
 * Full single-election booth read. `d` is the object from
 * GET /api/analytics/booth/:boothId (or one entry of a station history's
 * `elections[]`). `electionId` sets the booth map's default link context.
 */
/**
 * Booth identity: the station card (name, benchmark, detail list) beside the
 * location map. Constant across elections, so the station-history page renders
 * it above the all-years view too, not just inside a single-election read.
 */
export function StationOverview({ d, electionId }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const benchmark = benchmarkFor(d?.leader?.share);
  // The competitiveness band is the winner's-share bucket, so name whose share
  // it is (party, falling back to the leading candidate) right on the badge.
  const leaderLabel = d?.leader?.party || d?.leader?.name || null;
  const leaderDot = partyColor(d?.leader?.party) ?? colorFor(d?.leader?.name);

  // Geocoding runs for the whole election (one Nominatim lookup per polling
  // station, rate-limited server-side), so a run here places every sibling
  // booth too — not just this one.
  const placed = d?.ps?.latitude != null && d?.ps?.longitude != null;
  const geocode = useMutation({
    mutationFn: () => api.geocodeBooths(electionId, placed),
    onSuccess: (r) => {
      show(`Geocoded ${r.geocoded} of ${r.total} booths`, r.failed ? 'warn' : 'success');
      qc.invalidateQueries({ queryKey: ['pollingStation'] });
      qc.invalidateQueries({ queryKey: ['constituencyBooths'] });
      qc.invalidateQueries({ queryKey: ['analytics', 'boothLeaning', electionId] });
    },
    onError: (e) => show(e.message || 'Geocoding failed', 'error'),
  });

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

  if (!d) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <div className="flex flex-col border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Polling station</div>
              <h2 className="text-[26px] font-semibold leading-tight text-slate-950">{boothName(d.ps)}</h2>
              {boothTag(d.ps) && <p className="mt-0.5 text-sm font-medium tabular-nums text-slate-500">{boothTag(d.ps)}</p>}
              {d.ps.address && <p className="mt-0.5 text-xs text-slate-400">{d.ps.address}</p>}
            </div>
            <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold ${benchmark.cls}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: benchmark.dot }} />
              {benchmark.label} <span className="font-normal opacity-70">· {benchmark.range}</span>
              {leaderLabel && (
                <span className="ml-1 inline-flex items-center gap-1 border-l border-current/20 pl-1.5 font-medium opacity-90">
                  <span className="h-2 w-2 rounded-full" style={{ background: leaderDot }} />
                  {leaderLabel}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="px-5 py-4">
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
              ['General Election Name', d.election.parlName],
              ['General Election Number', d.election.parlNo],
              ['General Election Seat Type', d.election.parlSeatType],
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

      <div className="border border-slate-300 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Location</div>
            <h3 className="text-sm font-semibold text-slate-950">Booth on the map</h3>
          </div>
          {electionId && (
            <button
              type="button"
              onClick={() => geocode.mutate()}
              disabled={geocode.isPending}
              title="Looks up coordinates for every polling station in this election via OpenStreetMap. Takes a minute or two."
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {geocode.isPending ? 'Geocoding…' : placed ? 'Re-geocode booths' : 'Geocode booths'}
            </button>
          )}
        </div>
        <div className="p-3">
          <BoothMap items={mapItems} electionId={electionId} />
        </div>
      </div>
    </div>
  );
}

export default function BoothElectionDetail({ d, electionId }) {
  const dem = d?.demographics;
  const benchmark = benchmarkFor(d?.leader?.share);
  const leaderLabel = d?.leader?.party || d?.leader?.name || null;
  const leaderDot = partyColor(d?.leader?.party) ?? colorFor(d?.leader?.name);
  const [voteView, setVoteView] = useState('party');

  const partyBars = useMemo(() => {
    const total = d?.totalValid ?? 0;
    const m = new Map();
    for (const c of d?.candidates ?? []) {
      const key = c.party?.trim() || c.name;
      const e = m.get(key) ?? { key, votes: 0, top: null, topVotes: -1 };
      e.votes += c.votes;
      if (c.votes > e.topVotes) { e.top = c.name; e.topVotes = c.votes; }
      m.set(key, e);
    }
    return Array.from(m.values())
      .map((e) => ({ key: e.key, votes: e.votes, sub: e.top, color: colorForParty(e.key), share: total > 0 ? e.votes / total : 0 }))
      .sort((a, b) => b.votes - a.votes);
  }, [d]);

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

  const candidateNames = useMemo(
    () => new Set((d?.candidates ?? []).map((c) => c.name.trim().toLowerCase())),
    [d],
  );
  const voterName = (v) => (v.fullName ?? `${v.firstName} ${v.lastName}`).trim();
  const isCandidateVoter = (v) => candidateNames.has(voterName(v).toLowerCase());
  const voters = useMemo(() => {
    const list = [...(d?.voters ?? [])];
    list.sort((a, b) => Number(isCandidateVoter(b)) - Number(isCandidateVoter(a)));
    return list;
  }, [d, candidateNames]);
  const matchedCount = (d?.voters ?? []).filter(isCandidateVoter).length;

  if (!d) return null;

  return (
    <>
      <StationOverview d={d} electionId={electionId} />

      <div className="mt-4 grid grid-cols-2 border border-slate-300 bg-white sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total voters" value={num(d.turnout.registered)} />
        <Kpi label="Voted" value={num(d.turnout.voted)} accent="#16a34a" sub={pct(Math.min(d.turnout.pct, 1)) + ' turnout'} />
        <Kpi label="Valid votes" value={num(d.totalValid)} />
        <Kpi label="NOTA" value={num(d.ps.notaVotes)} />
        <Kpi label="Leader" value={d.leader?.name ?? '—'} accent={partyColor(d.leader?.party) ?? colorFor(d.leader?.name)} sub={d.leader ? pct(d.leader.share) : ''} />
        <Kpi label="Runner-up" value={d.runnerUp?.name ?? '—'} sub={d.runnerUp ? pct(d.runnerUp.share) : ''} />
      </div>

      <Panel
        title="Vote results (this election)"
        className="mt-6"
        info="Votes polled in this booth for the selected election. X axis = party (or candidate, via the toggle); Y axis = votes. Bars are coloured by party."
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
            <BarChart data={voteBars} margin={{ left: 16, right: 16, top: 8, bottom: voteView === 'candidate' ? 80 : 30 }}>
              <CartesianGrid stroke="#e7e5de" vertical={false} />
              <XAxis
                type="category"
                dataKey="key"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={voteView === 'candidate' ? -22 : 0}
                textAnchor={voteView === 'candidate' ? 'end' : 'middle'}
                height={voteView === 'candidate' ? 96 : 36}
                label={{ value: voteView === 'party' ? 'Party' : 'Candidate', position: 'insideBottom', offset: voteView === 'candidate' ? 4 : -2, style: { fontSize: 11, fill: '#64748b' } }}
              />
              <YAxis type="number" tick={{ fontSize: 11 }} tickFormatter={num} label={{ value: 'Votes', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
              <Tooltip content={<VoteTooltip subLabel={voteView === 'party' ? 'Top candidate' : 'Party'} />} cursor={{ fill: '#f7f5f0' }} />
              <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                {voteBars.map((b) => <Cell key={b.key} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DemographicCard title="Religion" data={dem?.byReligion ?? []} scheme="religion" />
        {/* Community card removed temporarily — uncomment to restore.
        <DemographicCard title="Community" data={dem?.byCommunity ?? []} scheme="community" orderKeys={['Gen', 'OBC', 'SC', 'ST']} /> */}
        <DemographicCard title="Category" data={dem?.byCategory ?? []} />
        <DemographicCard title="Caste" data={dem?.byCaste ?? []} />
      </div>

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

      <Recommendations benchmark={benchmark} leaderLabel={leaderLabel} leaderDot={leaderDot} priority={d.priority} recommendations={d.recommendations} />

      <BoothBanner d={d} />
    </>
  );
}
