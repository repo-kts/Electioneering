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
import { DemographicCard } from '../components/analytics/BoothDemographics.jsx';
import InsightsSection from '../components/analytics/InsightsSection.jsx';
import { partyColor, colorFor, colorForCandidate, colorForParty, num, pct, boothName, boothTag } from '../components/elections/helpers.js';

const GRID = '#e7e5de';

// Stacked-bar tooltip: every segment in the hovered election, largest first,
// with the stack total underneath. Zero-vote series are dropped.
function StackTooltip({ active, payload, label }) {
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
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">{num(p.value)}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-slate-200 pt-1.5">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold tabular-nums text-slate-900">{num(total)}</span>
      </div>
    </div>
  );
}

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

  // Votes per election, grouped by party or by candidate. X axis is one group
  // per election in the current Type/Year filter, so "All years" compares years
  // side by side and a single year collapses to one group. `topN` caps how many
  // series are drawn; everything past the cut is summed into "Others".
  const { voteOverTime, voteSeries, voteTotalSeries } = useMemo(() => {
    const labelById = new Map(timeline.map((t) => [t.electionId, t.label]));
    const totals = new Map();
    const rows = filteredElections.map((e) => {
      const row = { label: labelById.get(e.election.id) ?? String(e.election.electionYear) };
      for (const c of e.candidates ?? []) {
        const key = voteView === 'party' ? (c.party?.trim() || c.name) : c.name;
        row[key] = (row[key] ?? 0) + (c.votes ?? 0);
        totals.set(key, (totals.get(key) ?? 0) + (c.votes ?? 0));
      }
      return row;
    });

    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const limit = topN === 'all'
      ? ranked.length
      : topN === 'custom'
        ? Math.max(1, Number(customN) || 1)
        : Number(topN);
    const top = ranked.slice(0, limit);
    const rest = ranked.slice(limit);
    if (rest.length) {
      for (const row of rows) {
        let other = 0;
        for (const k of rest) {
          other += row[k] ?? 0;
          delete row[k];
        }
        if (other > 0) row.Others = other;
      }
    }

    const series = top.map((key) => ({
      key,
      color: voteView === 'party' ? colorForParty(key) : colorForCandidate(key, partyByName[key]),
    }));
    if (rest.length) series.push({ key: 'Others', color: '#94a3b8' });
    return { voteOverTime: rows, voteSeries: series, voteTotalSeries: ranked.length };
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
          { label: 'Booth wise election', to: '/elections/booths' },
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

              {/* KPI rollup */}
              <div className="mb-5 grid grid-cols-2 border border-slate-300 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Elections here" value={num(filteredElections.length)} sub={type === 'all' && year === 'all' ? 'all on record' : 'in filter'} />
                <StatCard label="Avg turnout" value={pct(agg?.avgTurnout)} sub={consAvgTurnout ? `constituency ${pct(consAvgTurnout)}` : undefined} tone={agg?.avgTurnout >= consAvgTurnout ? 'green' : 'default'} />
                <StatCard label="Most frequent winner" value={agg?.mostFrequentWinner?.name ?? '—'} sub={agg?.mostFrequentWinner ? `${agg.mostFrequentWinner.times}× · ${agg.mostFrequentWinner.party ?? ''}` : undefined} accent={agg?.mostFrequentWinner ? colorForCandidate(agg.mostFrequentWinner.name, agg.mostFrequentWinner.party) : undefined} />
                <StatCard label="Latest margin" value={pct(agg?.latestMargin)} sub="leader − runner-up" />
                <StatCard label="Registered (latest)" value={num(agg?.registeredVoters)} />
              </div>

              {/* Votes per election, by party or candidate */}
              <Surface
                title="Vote results by election"
                subtitle="Votes polled at this booth, one group per election. Use the Type and Year filters above to narrow the axis."
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
                {voteOverTime.length === 0 ? (
                  <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">No election results in this filter.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={voteOverTime} margin={{ left: 8, right: 16, top: 20, bottom: 8 }} barCategoryGap="28%">
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={56} allowDecimals={false} />
                      <Tooltip content={<StackTooltip />} cursor={{ fill: '#eef0ec' }} />
                      <Legend />
                      {voteSeries.map((s, i) => (
                        <Bar
                          key={s.key}
                          dataKey={s.key}
                          name={s.key}
                          fill={s.color}
                          stackId="votes"
                          maxBarSize={96}
                          radius={i === voteSeries.length - 1 ? [4, 4, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Surface>

              {/* Result & turnout, per election */}
              <Surface title="Turnout & winning share by election" subtitle="Every election at this booth, compared side by side. Each bar group is labelled with its year and type (AE = Assembly, LS = Lok Sabha).">
                {trendData.length === 0 ? (
                  <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">No election results in this filter.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={trendData} margin={{ left: 8, right: 16, top: 20, bottom: 8 }} barGap={2} barCategoryGap="28%">
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={44} />
                      <Tooltip formatter={(v, n) => [v == null ? '—' : `${v}%`, n]} cursor={{ fill: '#f7f5f0' }} />
                      <Legend />
                      <Bar name="Turnout" dataKey="turnout" fill={colorFor('Turnout series')} maxBarSize={72} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="turnout" position="top" fontSize={10} fill="#64748b" formatter={(v) => (v == null ? '' : `${v}%`)} />
                      </Bar>
                      <Bar name="Winning share" dataKey="winShare" fill={colorFor('Winning share series')} maxBarSize={72} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="winShare" position="top" fontSize={10} fill="#64748b" formatter={(v) => (v == null ? '' : `${v}%`)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Surface>

              {/* Vote share by candidate, per election */}
              {candShareData.length > 0 && candNames.length > 0 && (
                <Surface className="mt-4" title="Vote share by candidate" subtitle="Each candidate's booth vote-share, compared election to election.">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={candShareData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }} barGap={2} barCategoryGap="24%">
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
                      <Tooltip formatter={(v, n) => [v == null ? '—' : `${v}%`, n]} cursor={{ fill: '#f7f5f0' }} />
                      <Legend />
                      {candNames.map((nm) => (
                        <Bar key={nm} name={nm} dataKey={nm} fill={colorForName(nm)} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
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
