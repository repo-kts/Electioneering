import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, StatCard, Surface, Loading, ErrorBox } from '../components/ui/kit.jsx';
import PartyShareTimeline from '../components/analytics/PartyShareTimeline.jsx';
import { api } from '../lib/api.js';
import { colorForParty, num, pct } from '../components/elections/helpers.js';

/**
 * Party & alliance breakdown for a constituency. Rendered as a standalone page
 * (default, single election) and inside the constituency page's "Parties" tab
 * (PartyContent). When `showAll` is set the tab shows the party vote-share
 * across every year; otherwise it shows the single election's breakdown.
 */
export function PartyContent({ electionId, showAll = false, assemblyNo, assemblyName, electionType }) {
  const q = useQuery({
    enabled: !showAll,
    queryKey: ['partyAnalytics', electionId],
    queryFn: () => api.partyAnalytics(electionId),
  });

  const totalValid = q.data?.totalValid ?? 0;
  const parties = q.data?.parties ?? [];
  const alliances = q.data?.alliances ?? [];

  // "Filter by party" for the votes-by-party chart: focus on the top N parties.
  const [topN, setTopN] = useState('all'); // 'all' | '3' | '5' | '10'
  const bars = useMemo(() => {
    const all = parties.map((p) => ({ name: p.party, votes: p.votes }));
    return topN === 'all' ? all : all.slice(0, Number(topN));
  }, [parties, topN]);
  const donut = useMemo(
    () => parties.slice(0, 8).map((p) => ({ name: p.party, value: p.votes })),
    [parties],
  );
  const leader = parties[0];

  // All-years view: party support over time (single stacked chart, Top-N + toggle).
  // Placed after all hooks so hook order stays stable when `showAll` toggles.
  if (showAll) {
    return (
      <PartyShareTimeline
        assemblyNo={assemblyNo}
        assemblyName={assemblyName}
        electionType={electionType}
      />
    );
  }

  return (
    <div className="space-y-6">
      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isPending && <Loading className="h-28" />}

      {q.data && parties.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No party results recorded for this election yet. Assign parties to candidates to see this breakdown.
        </div>
      )}

      {parties.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-4">
            <StatCard label="Parties" value={num(parties.length)} />
            <StatCard label="Total valid votes" value={num(totalValid)} />
            <StatCard label="Leading party" value={leader?.party ?? '—'} sub={leader ? `${pct(leader.share)} · ${num(leader.votes)}` : ''} tone="green" />
            <StatCard label="Booths led" value={num(leader?.boothsLed)} sub={leader ? `by ${leader.party}` : ''} />
          </div>

          {/* Alliance rollup — a party's votes flow to its alliance */}
          {alliances.length > 0 && (
            <div className="border border-slate-300 bg-white">
              <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                By alliance
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-sm">
                {alliances.map((a) => (
                  <div key={a.alliance} className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-900">{a.alliance}</span>
                    <span className="text-slate-500">{pct(a.share)} · {num(a.votes)}</span>
                    <span className="text-xs text-slate-400">({a.partyCount} {a.partyCount === 1 ? 'party' : 'parties'}, top {a.topParty})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Votes by party */}
            <Surface
              title="Votes by party"
              subtitle="Total valid votes each party received."
              info="Total valid votes each party received in this election. X axis = party; Y axis = votes. Use 'Show' to focus on the top parties. Bars coloured by party."
              className="lg:col-span-3"
              right={
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  Show
                  <select
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    <option value="all">All{parties.length ? ` (${parties.length})` : ''}</option>
                    <option value="3">Top 3</option>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                  </select>
                </label>
              }
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={bars} margin={{ left: 16, right: 8, top: 8, bottom: 64 }}>
                  <CartesianGrid stroke="#e7e5de" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-22} textAnchor="end" height={80} label={{ value: 'Party', position: 'insideBottom', offset: 6, style: { fontSize: 11, fill: '#64748b' } }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => num(v)} label={{ value: 'Votes', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
                  <Tooltip formatter={(v) => [num(v), 'Votes']} cursor={{ fill: '#f7f5f0' }} />
                  <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                    {bars.map((b) => <Cell key={b.name} fill={colorForParty(b.name)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Surface>

            {/* Vote-share donut */}
            <Surface title="Vote share" subtitle="Share of valid votes." info="Each party's share of the total valid vote (top 8 parties). Hover a slice for its votes and party." className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
                    {donut.map((d) => <Cell key={d.name} fill={colorForParty(d.name)} stroke="#fff" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [num(v), n]} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-3 divide-y divide-slate-100">
                {parties.slice(0, 8).map((p) => (
                  <li key={p.party} className="flex items-center gap-2.5 py-2">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForParty(p.party) }} />
                    <span className="flex-1 truncate text-sm text-slate-700">{p.party}</span>
                    <span className="w-14 text-right text-sm font-semibold tabular-nums text-slate-900">{pct(p.share)}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          </div>

          {/* Table */}
          <Surface title="Party breakdown" subtitle="Sorted by total votes." bodyClass="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[minmax(0,1.3fr)_110px_90px_110px_100px_minmax(0,1.2fr)] gap-3 border-b border-slate-200 bg-[#fbfaf7] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <div>Party</div>
                  <div className="text-right">Votes</div>
                  <div className="text-right">Share</div>
                  <div className="text-right">Candidates</div>
                  <div className="text-right">Booths led</div>
                  <div>Top candidate</div>
                </div>
                {parties.map((p, i) => (
                  <div
                    key={p.party}
                    className="grid grid-cols-[minmax(0,1.3fr)_110px_90px_110px_100px_minmax(0,1.2fr)] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForParty(p.party) }} />
                      <span className="truncate text-sm font-medium text-slate-900">{p.party}</span>
                      {i === 0 && <span className="border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700">Lead</span>}
                    </div>
                    <div className="text-right text-sm tabular-nums text-slate-800">{num(p.votes)}</div>
                    <div className="text-right text-sm font-semibold tabular-nums text-slate-900">{pct(p.share)}</div>
                    <div className="text-right text-sm tabular-nums text-slate-700">{num(p.candidateCount)}</div>
                    <div className="text-right text-sm tabular-nums text-slate-700">{num(p.boothsLed)}</div>
                    <div className="truncate text-sm text-slate-600">
                      {p.topCandidate ? (
                        <>
                          {p.topCandidate.name}
                          <span className="text-slate-400"> · {num(p.topCandidate.votes)}</span>
                        </>
                      ) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Surface>
        </>
      )}
    </div>
  );
}

export default function PartyAnalyticsPage() {
  const { id } = useParams();
  const electionId = Number(id);
  const q = useQuery({ queryKey: ['partyAnalytics', electionId], queryFn: () => api.partyAnalytics(electionId) });
  const el = q.data?.election;
  const name = el ? `${el.assemblyName ?? 'Election'} ${el.electionYear ?? ''}`.trim() : 'Election';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: 'Elections', to: '/elections' },
            { label: name, to: `/elections/${electionId}` },
            { label: 'Party analytics' },
          ]}
        />
        <PageHeader
          eyebrow="Party performance"
          title={`${name} — party analytics`}
          subtitle={el ? `${el.assemblyNo != null ? el.assemblyNo + '-' : ''}${el.assemblyName} · ${el.electionType ?? ''}` : 'Loading…'}
        />
      </div>
      <PartyContent electionId={electionId} />
    </div>
  );
}
