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
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, Cell, LabelList,
} from 'recharts';
import { api } from '../lib/api.js';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, Surface, StatCard, Loading, ErrorBox } from '../components/ui/kit.jsx';
import BoothElectionDetail, { StationOverview } from '../components/analytics/BoothElectionDetail.jsx';
import BoothScorecard from '../components/analytics/BoothScorecard.jsx';
import { DemographicCard } from '../components/analytics/BoothDemographics.jsx';
import InsightsSection from '../components/analytics/InsightsSection.jsx';
import { colorFor, colorForCandidate, colorForParty, boothName, boothTag } from '../components/elections/helpers.js';
import { StackTooltip, WinnerTooltip } from '../components/elections/chartTooltips.jsx';

const GRID = '#e7e5de';

export default function BoothHistoryPage() {
  const { psId } = useParams();
  const [type, setType] = useState('all');
  const [year, setYear] = useState('all');
  const [voteView, setVoteView] = useState('party'); // party | candidate
  const [topN, setTopN] = useState('3'); // '3' | 'custom' | 'all'
  const [customN, setCustomN] = useState(5); // series count when topN === 'custom'

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
  // Years available for the selected type (all types → every year).
  const years = useMemo(
    () => Array.from(new Set(
      elections
        .filter((e) => type === 'all' || e.election.electionType === type)
        .map((e) => e.election.electionYear)
        .filter((y) => y != null),
    )).sort((a, b) => b - a),
    [elections, type],
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

  // Candidate name → party (keeps the vote-results "by candidate" colours themed).
  const partyByName = useMemo(() => {
    const m = {};
    for (const e of elections) for (const c of e.candidates ?? []) if (c.party) m[c.name] = c.party;
    return m;
  }, [elections]);

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

  // Turnout + winning-share split by election type (Assembly vs Lok Sabha). Turnout
  // is guarded: implausible values (>105% or 0 — a data-import artefact) render as a
  // gap rather than a wrong bar.
  const trendByType = useMemo(() => {
    const byType = new Map();
    for (const t of filteredTimeline) {
      const type = t.type || 'Election';
      const arr = byType.get(type) ?? byType.set(type, []).get(type);
      const tp = t.turnoutPct;
      arr.push({
        label: t.label,
        turnout: tp != null && tp > 0 && tp <= 1.05 ? +(tp * 100).toFixed(1) : null,
        winShare: t.winShare != null ? +(t.winShare * 100).toFixed(1) : null,
        winnerName: t.winnerName,
        winnerParty: t.winnerParty,
      });
    }
    return [...byType.entries()].map(([type, rows]) => ({ type, rows }));
  }, [filteredTimeline]);

  // Votes per election, grouped by party or candidate — split into one chart per
  // election TYPE so Assembly and Lok Sabha aren't compared on the same axis
  // (different contests). `topN` caps series per chart; the rest fold into "Others".
  const { voteGroups, voteTotalSeries } = useMemo(() => {
    const labelById = new Map(timeline.map((t) => [t.electionId, t.label]));

    const build = (subset) => {
      const totals = new Map();
      const rows = subset.map((e) => {
        const row = { label: labelById.get(e.election.id) ?? String(e.election.electionYear) };
        for (const c of e.candidates ?? []) {
          const key = voteView === 'party' ? (c.party?.trim() || c.name) : c.name;
          row[key] = (row[key] ?? 0) + (c.votes ?? 0);
          totals.set(key, (totals.get(key) ?? 0) + (c.votes ?? 0));
        }
        return row;
      });
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
      const limit = topN === 'all' ? ranked.length : topN === 'custom' ? Math.max(1, Number(customN) || 1) : Number(topN);
      const top = ranked.slice(0, limit);
      const rest = ranked.slice(limit);
      if (rest.length) {
        for (const row of rows) {
          let other = 0;
          for (const k of rest) { other += row[k] ?? 0; delete row[k]; }
          if (other > 0) row.Others = other;
        }
      }
      const series = top.map((key) => ({
        key,
        color: voteView === 'party' ? colorForParty(key) : colorForCandidate(key, partyByName[key]),
      }));
      if (rest.length) series.push({ key: 'Others', color: '#94a3b8' });
      return { rows, series, totalSeries: ranked.length };
    };

    // Group by election type, preserving first-seen order.
    const byType = new Map();
    for (const e of filteredElections) {
      const t = e.election.electionType || 'Election';
      (byType.get(t) ?? byType.set(t, []).get(t)).push(e);
    }
    const groups = [...byType.entries()].map(([type, subset]) => ({ type, ...build(subset) }));
    return { voteGroups: groups, voteTotalSeries: Math.max(0, ...groups.map((g) => g.totalSeries)) };
  }, [filteredElections, timeline, voteView, partyByName, topN, customN]);

  // Detail view is driven by the Year filter, not by how many elections happen
  // to match — "All years" always shows the cross-election comparison, even when
  // only one election is on record.
  const singleElection = year !== 'all' && filteredElections.length === 1 ? filteredElections[0] : null;

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
          { label: 'Booth wise votes', to: '/elections/booths' },
          d?.constituency
            ? { label: d.constituency.assemblyName ?? 'Constituency', to: `/elections/booths/${encodeURIComponent(d.constituency.assemblyNo ?? '')}/${encodeURIComponent(d.constituency.assemblyName ?? '')}` }
            : { label: 'Constituency' },
          { label: d ? boothName(elections[0]?.ps) : 'Booth' },
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
            eyebrow={[d.constituency?.assemblyName, d.constituency?.state, boothTag(elections[0]?.ps)].filter(Boolean).join(' · ')}
            title={boothName(elections[0]?.ps)}
            meta={
              /* Winner timeline — chips (click to focus that election) */
              <div className="flex flex-wrap gap-2">
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
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  Type
                  <select value={type} onChange={(e) => { setType(e.target.value); setYear('all'); }} className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">
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

          {singleElection ? (
            // Narrowed to one election → full single-election booth read.
            <BoothElectionDetail d={singleElection} electionId={singleElection.election.id} />
          ) : (
            <>
              {/* Booth identity — same card as the single-election read, since the
                  station itself doesn't change between elections. */}
              {elections[0] && (
                <div className="mb-5">
                  <StationOverview d={elections[0]} electionId={elections[0].election.id} />
                </div>
              )}

              {/* Overall story of this booth across every election it fought */}
              <BoothScorecard timeline={filteredTimeline} registeredLatest={agg?.registeredVoters} />

              {/* Votes per election, by party or candidate */}
              <Surface
                title="Vote results by election"
                subtitle="Votes polled at this booth, split by election type so Assembly and General Election aren't compared on one axis. Use the Type and Year filters to narrow."
                info="Votes this booth polled in each recorded election, stacked by party (or candidate). X axis = election; Y axis = votes. Split by election type so Assembly and General Election aren't compared on one axis. Use Show/By-party to focus."
                className="mb-5"
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
                        <option value="all">All{voteTotalSeries ? ` (${voteTotalSeries})` : ''}</option>
                      </select>
                      {topN === 'custom' && (
                        <input
                          type="number"
                          min="1"
                          max={voteTotalSeries || undefined}
                          value={customN}
                          onChange={(e) => setCustomN(e.target.value)}
                          onBlur={(e) => setCustomN(Math.max(1, Number(e.target.value) || 1))}
                          aria-label="Number of series to show"
                          className="w-16 border border-slate-300 bg-white px-2 py-1 text-xs font-medium tabular-nums text-slate-700"
                        />
                      )}
                    </label>
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
                  </div>
                }
              >
                {voteGroups.length === 0 ? (
                  <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">No election results in this filter.</p>
                ) : (
                  <div className={voteGroups.length > 1 ? 'grid grid-cols-1 gap-5 lg:grid-cols-2' : ''}>
                    {voteGroups.map((g) => (
                      <div key={g.type} className="border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{g.type}</div>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={g.rows} margin={{ left: 16, right: 16, top: 20, bottom: 24 }} barCategoryGap="28%">
                            <CartesianGrid stroke={GRID} vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: 'Election', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#64748b' } }} />
                            <YAxis tick={{ fontSize: 11 }} width={60} allowDecimals={false} label={{ value: 'Votes', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
                            <Tooltip content={<StackTooltip />} cursor={{ fill: '#eef0ec' }} />
                            <Legend />
                            {g.series.map((s, i) => (
                              <Bar
                                key={s.key}
                                dataKey={s.key}
                                name={s.key}
                                fill={s.color}
                                stackId="votes"
                                maxBarSize={96}
                                radius={i === g.series.length - 1 ? [4, 4, 0, 0] : undefined}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              {/* Turnout, per election — split by type */}
              <Surface
                className="mb-5"
                title="Turnout by election"
                subtitle="Share of registered voters who polled, split by election type. Implausible imported values (>100% or 0) are shown as a gap."
                info="How turnout at this booth changed across elections. X axis = election; Y axis = turnout as a % of registered voters. Split by election type."
              >
                {trendByType.length === 0 ? (
                  <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">No election results in this filter.</p>
                ) : (
                  <div className={trendByType.length > 1 ? 'grid grid-cols-1 gap-5 lg:grid-cols-2' : ''}>
                    {trendByType.map((g) => (
                      <div key={g.type} className="border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{g.type}</div>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={g.rows} margin={{ left: 16, right: 16, top: 20, bottom: 24 }} barCategoryGap="30%">
                            <CartesianGrid stroke={GRID} vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: 'Election', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#64748b' } }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={48} label={{ value: 'Turnout (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
                            <Tooltip formatter={(v) => [v == null ? '—' : `${v}%`, 'Turnout']} cursor={{ fill: '#f7f5f0' }} />
                            <Bar name="Turnout" dataKey="turnout" fill={colorFor('Turnout series')} maxBarSize={64} radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="turnout" position="top" fontSize={10} fill="#64748b" formatter={(v) => (v == null ? '' : `${v}%`)} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              {/* Winning share, per election — split by type, coloured by party */}
              <Surface
                className="mb-5"
                title="Winning share by election"
                subtitle="The winner's vote share, coloured & labelled by their party and split by election type (Assembly vs General Election)."
                info="The winner's share of the vote at this booth each election. X axis = election; Y axis = winning share (%). Bars coloured & labelled by the winning party. Split by election type."
              >
                {trendByType.length === 0 ? (
                  <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">No election results in this filter.</p>
                ) : (
                  <div className={trendByType.length > 1 ? 'grid grid-cols-1 gap-5 lg:grid-cols-2' : ''}>
                    {trendByType.map((g) => (
                      <div key={g.type} className="border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{g.type}</div>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={g.rows} margin={{ left: 16, right: 16, top: 22, bottom: 24 }} barCategoryGap="30%">
                            <CartesianGrid stroke={GRID} vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: 'Election', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#64748b' } }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={48} label={{ value: 'Winning share (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
                            <Tooltip content={<WinnerTooltip valueLabel="Winning share" />} cursor={{ fill: '#f7f5f0' }} />
                            <Bar name="Winning share" dataKey="winShare" maxBarSize={64} radius={[4, 4, 0, 0]}>
                              {g.rows.map((r, i) => (
                                <Cell key={i} fill={r.winnerParty ? colorForCandidate(r.winnerName, r.winnerParty) : colorFor(r.winnerName)} />
                              ))}
                              <LabelList
                                position="top"
                                fontSize={10}
                                fill="#475569"
                                content={({ x, y, width, index }) => {
                                  const r = g.rows[index];
                                  if (r?.winShare == null) return null;
                                  return (
                                    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#475569">
                                      <tspan fontWeight="600">{r.winShare}%</tspan>
                                      <tspan x={x + width / 2} dy="-11" fill="#94a3b8">{r.winnerParty || 'Ind.'}</tspan>
                                    </text>
                                  );
                                }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              {/* Victory margin + NOTA */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Surface title="Victory margin" subtitle="Leader − runner-up share, per election. Bars coloured & labelled by the winning candidate's party." info="How decisively this booth was won each election. X axis = election; Y axis = the winner's lead over the runner-up in vote-share (%). Bars coloured & labelled by the winning party.">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={trendData} margin={{ left: 16, right: 16, top: 8, bottom: 24 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: 'Election', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#64748b' } }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" width={48} label={{ value: 'Margin (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
                      <Tooltip content={<WinnerTooltip valueLabel="Margin" />} cursor={{ fill: '#f7f5f0' }} />
                      <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                        {trendData.map((r, i) => <Cell key={i} fill={r.winnerParty ? colorForCandidate(r.winnerName, r.winnerParty) : colorFor(r.winnerName)} />)}
                        <LabelList dataKey="winnerParty" position="top" fontSize={10} fontWeight={600} fill="#475569" formatter={(v) => v || 'Ind.'} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Surface>
                <Surface title="NOTA share" subtitle="None-of-the-above as a share of votes polled, per election." info="How many voters at this booth chose None-Of-The-Above. X axis = election; Y axis = NOTA as a % of votes polled.">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trendData} margin={{ left: 16, right: 16, top: 8, bottom: 24 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: 'Election', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#64748b' } }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" width={48} label={{ value: 'NOTA (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b', textAnchor: 'middle' } }} />
                      <Tooltip formatter={(v) => [`${v}%`, 'NOTA']} />
                      <Bar dataKey="nota" fill={colorFor('NOTA')} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Surface>
              </div>

              {/* Demographic coalitions (latest roll) */}
              <div className="mt-6">
                <h2 className="mb-3 text-[15px] font-semibold text-slate-950">Demographic coalitions <span className="text-xs font-normal text-slate-500">· from the latest voter roll</span></h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DemographicCard title="Religion" data={d.demographicsLatest?.byReligion ?? []} scheme="religion" />
                  {/* Community card removed temporarily — uncomment to restore.
                  <DemographicCard title="Community" data={d.demographicsLatest?.byCommunity ?? []} scheme="community" orderKeys={['Gen', 'OBC', 'SC', 'ST']} /> */}
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
