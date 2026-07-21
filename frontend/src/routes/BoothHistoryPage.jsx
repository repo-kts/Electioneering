// Booth-wise flow, level 3: ONE physical booth across every election it took
// part in. Default view blends all election types on a single chronological
// timeline (turnout, winning share, margin, candidate vote-share, NOTA), with
// demographic coalitions + swing + leaning cross-tabs. Election-type and year
// dropdowns narrow it; narrowing to a single election shows that election's
// full booth read (reused from BoothElectionDetail). View-only.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { api } from '../lib/api.js';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, Surface, StatCard, Loading, ErrorBox } from '../components/ui/kit.jsx';
import BoothElectionDetail from '../components/analytics/BoothElectionDetail.jsx';
import { DemographicCard } from '../components/analytics/BoothDemographics.jsx';
import InsightsSection from '../components/analytics/InsightsSection.jsx';
import { partyColor, colorFor, colorForCandidate, num, pct } from '../components/elections/helpers.js';

const GRID = '#e7e5de';

export default function BoothHistoryPage() {
  const { psId } = useParams();
  const [type, setType] = useState('all');
  const [year, setYear] = useState('all');

  const q = useQuery({ queryKey: ['pollingStation', psId], queryFn: () => api.pollingStation(psId) });
  const d = q.data;

  // Sibling booths for the booth-vs-constituency comparison.
  const consQ = useQuery({
    enabled: !!d?.constituency?.assemblyNo || !!d?.constituency?.assemblyName,
    queryKey: ['constituencyBooths', d?.constituency?.assemblyNo, d?.constituency?.assemblyName],
    queryFn: () => api.constituencyBooths({ assemblyNo: d.constituency.assemblyNo, assemblyName: d.constituency.assemblyName }),
  });

  const elections = d?.elections ?? []; // newest first, each a full booth read
  const timeline = d?.timeline ?? []; // oldest → newest
  const types = useMemo(() => Array.from(new Set(elections.map((e) => e.election.electionType))), [elections]);
  const years = useMemo(
    () => Array.from(new Set(elections.map((e) => e.election.electionYear).filter((y) => y != null))).sort((a, b) => b - a),
    [elections],
  );

  const matches = (t, y) => (type === 'all' || t === type) && (year === 'all' || String(y) === String(year));
  const filteredElections = useMemo(
    () => elections.filter((e) => matches(e.election.electionType, e.election.electionYear)),
    [elections, type, year],
  );
  const filteredTimeline = useMemo(
    () => timeline.filter((t) => matches(t.type, t.year)),
    [timeline, type, year],
  );

  // Candidate name → party (for consistent line colors across the vote-share chart).
  const partyByName = useMemo(() => {
    const m = {};
    for (const e of elections) for (const c of e.candidates ?? []) if (c.party) m[c.name] = c.party;
    return m;
  }, [elections]);
  const colorForName = (nm) => partyColor(partyByName[nm]) ?? colorFor(nm);

  const trendData = useMemo(
    () => filteredTimeline.map((t) => ({
      label: t.label,
      turnout: t.turnoutPct != null ? +(t.turnoutPct * 100).toFixed(1) : null,
      winShare: t.winShare != null ? +(t.winShare * 100).toFixed(1) : null,
      margin: +((t.margin ?? 0) * 100).toFixed(1),
      nota: +((t.notaShare ?? 0) * 100).toFixed(2),
      winnerParty: t.winnerParty,
      winnerName: t.winnerName,
    })),
    [filteredTimeline],
  );

  // Vote-share-by-candidate over time (one line per candidate that ran).
  const { candShareData, candNames } = useMemo(() => {
    const rows = (d?.byCandidateOverTime ?? []).filter((r) => matches(r.type, r.year));
    const names = new Set();
    const data = rows.map((r) => {
      const row = { label: r.label };
      for (const [nm, share] of Object.entries(r.shares ?? {})) {
        row[nm] = +(share * 100).toFixed(1);
        names.add(nm);
      }
      return row;
    });
    return { candShareData: data, candNames: Array.from(names) };
  }, [d, type, year]);

  const singleElection = filteredElections.length === 1 ? filteredElections[0] : null;

  // Constituency comparison (latest election of each booth).
  const consAvgTurnout = useMemo(() => {
    const rows = (consQ.data?.items ?? []).map((b) => b.turnoutPct).filter((t) => t > 0);
    return rows.length ? rows.reduce((s, t) => s + t, 0) / rows.length : 0;
  }, [consQ.data]);

  const agg = d?.aggregate;
  const latestId = elections[0]?.election?.id;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Booth wise election', to: '/elections/booths' },
          d?.constituency
            ? { label: d.constituency.assemblyName ?? 'Constituency', to: `/elections/booths/${encodeURIComponent(d.constituency.assemblyNo ?? '')}/${encodeURIComponent(d.constituency.assemblyName ?? '')}` }
            : { label: 'Constituency' },
          { label: d ? `PS-${elections[0]?.ps?.serial ?? ''}` : 'Booth' },
        ]}
      />

      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isPending && <Loading className="h-40" />}
      {d && elections.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No elections on record for this booth yet.
        </div>
      )}

      {d && elections.length > 0 && (
        <>
          <PageHeader
            eyebrow={`${d.constituency?.assemblyName ?? ''}${d.constituency?.state ? ' · ' + d.constituency.state : ''}`}
            title={d.ps?.name ? `PS-${elections[0].ps.serial} · ${d.ps.name}` : `Booth PS-${elections[0].ps.serial}`}
            subtitle="This booth's full history across every election. Default view blends all election types over time — narrow by type or year below."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  Type
                  <select value={type} onChange={(e) => setType(e.target.value)} className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                    <option value="all">All types</option>
                    {types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  Year
                  <select value={year} onChange={(e) => setYear(e.target.value)} className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                    <option value="all">All years</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              </div>
            }
          />

          {/* Winner timeline — chips (click to focus that election) */}
          <div className="mb-5 flex flex-wrap gap-2">
            {[...timeline].reverse().map((t) => {
              const active = singleElection?.election?.id === t.electionId;
              return (
                <button
                  key={t.electionId}
                  type="button"
                  onClick={() => { setType(t.type); setYear(String(t.year)); }}
                  className={`flex items-center gap-2 border px-3 py-2 text-sm transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-[#fbfaf7]'}`}
                  title={t.type}
                >
                  <span className="font-semibold tabular-nums">{t.label}</span>
                  {t.winnerName && (
                    <>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorForCandidate(t.winnerName, t.winnerParty) }} />
                      <span className={`max-w-[130px] truncate text-xs ${active ? 'text-slate-200' : 'text-slate-500'}`}>{t.winnerName}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {singleElection ? (
            // Narrowed to one election → full single-election booth read.
            <BoothElectionDetail d={singleElection} electionId={singleElection.election.id} />
          ) : (
            <>
              {/* KPI rollup */}
              <div className="mb-5 grid grid-cols-2 border border-slate-300 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Elections here" value={num(filteredElections.length)} sub={type === 'all' && year === 'all' ? 'all on record' : 'in filter'} />
                <StatCard label="Avg turnout" value={pct(agg?.avgTurnout)} sub={consAvgTurnout ? `constituency ${pct(consAvgTurnout)}` : undefined} tone={agg?.avgTurnout >= consAvgTurnout ? 'green' : 'default'} />
                <StatCard label="Most frequent winner" value={agg?.mostFrequentWinner?.name ?? '—'} sub={agg?.mostFrequentWinner ? `${agg.mostFrequentWinner.times}× · ${agg.mostFrequentWinner.party ?? ''}` : undefined} accent={agg?.mostFrequentWinner ? colorForCandidate(agg.mostFrequentWinner.name, agg.mostFrequentWinner.party) : undefined} />
                <StatCard label="Latest margin" value={pct(agg?.latestMargin)} sub="leader − runner-up" />
                <StatCard label="Registered (latest)" value={num(agg?.registeredVoters)} />
              </div>

              {/* Result & turnout trends */}
              <Surface title="Turnout & winning share over time" subtitle="Every election at this booth, blended chronologically. Each point is labelled with its year and type (AE = Assembly, LS = Lok Sabha).">
                {trendData.length <= 1 ? (
                  <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">Only one election in this filter — widen it to plot a trend.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={44} />
                      <Tooltip formatter={(v, n) => [v == null ? '—' : `${v}%`, n]} />
                      <Legend />
                      <Line name="Turnout" type="monotone" dataKey="turnout" stroke={colorFor('Turnout series')} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                      <Line name="Winning share" type="monotone" dataKey="winShare" stroke={colorFor('Winning share series')} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Surface>

              {/* Vote share by candidate over time */}
              {candShareData.length > 1 && candNames.length > 0 && (
                <Surface className="mt-4" title="Vote share by candidate" subtitle="How each candidate's booth vote-share moved election to election.">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={candShareData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
                      <Tooltip formatter={(v, n) => [v == null ? '—' : `${v}%`, n]} />
                      <Legend />
                      {candNames.map((nm) => (
                        <Line key={nm} name={nm} type="monotone" dataKey={nm} stroke={colorForName(nm)} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Surface>
              )}

              {/* Victory margin + NOTA */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Surface title="Victory margin" subtitle="Leader − runner-up share, per election. Bars colored by the winning party.">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trendData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Margin']} />
                      <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                        {trendData.map((r, i) => <Cell key={i} fill={r.winnerParty ? colorForCandidate(r.winnerName, r.winnerParty) : colorFor(r.winnerName)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Surface>
                <Surface title="NOTA share" subtitle="None-of-the-above as a share of votes polled, per election.">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trendData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
                      <Tooltip formatter={(v) => [`${v}%`, 'NOTA']} />
                      <Bar dataKey="nota" fill={colorFor('NOTA')} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Surface>
              </div>

              {/* Demographic coalitions (latest roll) */}
              <div className="mt-6">
                <h2 className="mb-3 text-[15px] font-semibold text-slate-950">Demographic coalitions <span className="text-xs font-normal text-slate-500">· from the latest voter roll</span></h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <DemographicCard title="Religion" data={d.demographicsLatest?.byReligion ?? []} scheme="religion" />
                  <DemographicCard title="Community" data={d.demographicsLatest?.byCommunity ?? []} scheme="community" orderKeys={['Gen', 'OBC', 'SC', 'ST']} />
                  <DemographicCard title="Category" data={d.demographicsLatest?.byCategory ?? []} />
                  <DemographicCard title="Caste" data={d.demographicsLatest?.byCaste ?? []} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <DemographicCard title="Age groups" data={d.demographicsLatest?.byAgeBucket ?? []} orderKeys={['18-25', '26-40', '41-60', '61-80', '80+']} />
                  <DemographicCard title="Gender" data={d.demographicsLatest?.byGender ?? []} scheme="gender" />
                  <DemographicCard title="Occupation" data={d.demographicsLatest?.byOccupation ?? []} />
                </div>
              </div>

              {/* Swing + community-leaning cross-tabs (against the previous same-type election) */}
              {latestId && (
                <div className="mt-6">
                  <h2 className="mb-1 text-[15px] font-semibold text-slate-950">Swing & leaning</h2>
                  <InsightsSection
                    electionId={latestId}
                    religionData={d.demographicsLatest?.byReligion ?? []}
                    turnoutHistory={timeline.map((t) => ({ electionId: t.electionId, electionType: t.type, electionYear: t.year }))}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
