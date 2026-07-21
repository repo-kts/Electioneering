import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AllYearsAnalytics from '../components/analytics/AllYearsAnalytics.jsx';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import InsightsSection from '../components/analytics/InsightsSection.jsx';
import ActionPlan from '../components/analytics/ActionPlan.jsx';
import BoothExplorer from '../components/analytics/BoothExplorer.jsx';
import { TimelineContent } from './AssemblyTimelinePage.jsx';
import { PartyContent } from './PartyAnalyticsPage.jsx';
import { StrategyContent } from './StrategyPage.jsx';
import { PageHeader, StatCard, Surface, Button, Loading, ErrorBox } from '../components/ui/kit.jsx';
import { api } from '../lib/api.js';
import { partyColor, colorFor, pct, num } from '../components/elections/helpers.js';
import { constituencyStory } from '../components/analytics/narrative.js';

const TABS = [
  ['overview', 'Overview'],
  ['booths', 'Booths'],
  ['trends', 'Trends'],
  ['parties', 'Parties'],
  ['winplan', 'Win plan'],
];

export default function ElectionOverviewPage() {
  const { id } = useParams();
  const entryId = Number(id); // election we arrived on (latest year of the constituency)

  const [searchParams] = useSearchParams();
  // '' = all years (default). Otherwise the chosen year's viewId.
  const [selectedYear, setSelectedYear] = useState(
    searchParams.get('booths') ? String(entryId) : '',
  );
  const [tab, setTab] = useState(searchParams.get('booths') ? 'booths' : (searchParams.get('tab') || 'overview'));
  const showAll = selectedYear === '';
  const viewId = selectedYear ? Number(selectedYear) : entryId;

  const overviewQ = useQuery({
    queryKey: ['analytics', 'overview', viewId],
    queryFn: () => api.analyticsOverview(viewId),
  });

  const data = overviewQ.data;
  const election = data?.election;
  const voters = data?.voters;

  // Narrative across every recorded year of this constituency+type.
  const timelineQ = useQuery({
    enabled: !!election,
    queryKey: ['assemblyTimeline', election?.assemblyNo, election?.assemblyName],
    queryFn: () => api.assemblyTimeline({ assemblyNo: election.assemblyNo, assemblyName: election.assemblyName }),
  });
  const story = useMemo(
    () => constituencyStory(timelineQ.data?.elections ?? [], { electionType: election?.electionType }),
    [timelineQ.data, election],
  );

  // Map each candidate to their party so BJP/INC keep their theme color everywhere.
  const partyByName = useMemo(() => {
    const m = {};
    for (const c of election?.candidates ?? []) m[c.name] = c.party;
    return m;
  }, [election]);
  const colorForName = (nm) => partyColor(partyByName[nm]) ?? colorFor(nm);

  const candBars = useMemo(
    () => (election?.candidates ?? []).map((c) => ({ name: c.name, votes: c.votes })),
    [election],
  );
  const donut = useMemo(
    () => (election?.candidates ?? []).slice(0, 6).map((c) => ({ name: c.name, value: c.votes })),
    [election],
  );

  const constituency = election ? election.assemblyName : 'Constituency';
  const headerTitle = election
    ? (showAll ? election.assemblyName : `${election.assemblyName} ${election.electionYear ?? ''}`.trim())
    : 'Constituency';

  const yearOptions = useMemo(() => {
    if (!election) return [];
    return (data?.electionsList ?? [])
      .filter(
        (e) =>
          e.assemblyNo === election.assemblyNo &&
          e.assemblyName === election.assemblyName &&
          e.electionType === election.electionType,
      )
      .sort((a, b) => (b.electionYear ?? 0) - (a.electionYear ?? 0));
  }, [data, election]);

  const viewYear = election?.electionYear;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            {
              label: election?.electionType || 'Elections',
              to: election?.electionType === 'Lok Sabha Election' ? '/elections/lok-sabha' : '/elections/assembly',
            },
            { label: constituency },
          ]}
        />
        <PageHeader
          eyebrow={election ? election.electionType : 'Results'}
          title={headerTitle}
          subtitle={election
            ? `${election.assemblyNo}-${election.assemblyName}${election.state ? ' · ' + election.state : ''}${showAll ? ` · all ${yearOptions.length || 1} ${yearOptions.length === 1 ? 'year' : 'years'}` : ''}`
            : 'Loading…'}
          actions={
            <Link to="/segment">
              <Button variant="secondary"><span className="text-slate-700">Voter search</span></Button>
            </Link>
          }
        />

        {/* Year switcher — defaults to "All years"; pick a year to drill in. */}
        {election && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Showing</span>
            <label className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border-0 bg-transparent p-0 pr-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-0"
              >
                <option value="">All years</option>
                {yearOptions.map((e) => (
                  <option key={e.id} value={e.id}>{e.electionYear ?? '—'}</option>
                ))}
              </select>
            </label>
            {!showAll && (
              <button
                type="button"
                onClick={() => setSelectedYear('')}
                className="text-xs font-medium text-accent-600 hover:text-accent-700"
              >
                ← Back to all years
              </button>
            )}
          </div>
        )}

        {/* Tab nav */}
        {election && (
          <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition ${
                  tab === key
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {overviewQ.isError && <ErrorBox message={overviewQ.error.message} onRetry={() => overviewQ.refetch()} />}
      {overviewQ.isPending && <Loading className="h-28" />}

      {/* When drilling a single-year analysis while "All years" is selected, we
          fall back to the latest year — say so plainly. */}
      {election && showAll && tab !== 'overview' && tab !== 'trends' && (
        <div className="border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Showing the latest election ({viewYear ?? '—'}) — pick a year above to analyse a different one.
        </div>
      )}

      {/* ── Overview tab ── */}
      {election && tab === 'overview' && showAll && (
        <>
          {story.length > 0 && (
            <Surface eyebrow="At a glance" title="What the record shows">
              <ul className="space-y-2">
                {story.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </Surface>
          )}
          <AllYearsAnalytics
            electionId={viewId}
            currentElectionId={viewId}
            assemblyNo={election.assemblyNo}
            assemblyName={election.assemblyName}
          />
        </>
      )}

      {election && tab === 'overview' && !showAll && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total voters" value={num(voters?.total)} />
            <StatCard label="Turnout" value={pct(election.turnout.pct)} sub={`${num(election.turnout.voted)} / ${num(election.turnout.registered)}`} />
            <StatCard label="Valid votes" value={num(election.totalValid)} />
            <StatCard label="NOTA" value={num(election.totalNota)} sub={election.totalCast ? pct(election.totalNota / election.totalCast) : ''} />
            <StatCard label="Leader" value={election.leader?.name ?? '—'} sub={election.leader ? `${pct(election.leader.share)} · ${num(election.leader.votes)}` : ''} tone="green" />
            <StatCard label="Margin" value={election.leader && election.runnerUp ? num(election.leader.votes - election.runnerUp.votes) : '—'} sub={election.runnerUp ? `over ${election.runnerUp.name}` : ''} />
          </div>

          {/* Prescriptive action plan — the "so what / do this" */}
          <ActionPlan electionId={viewId} />

          {/* Candidate results */}
          <Surface title="Candidate results" subtitle="Form 20 totals across all polling stations.">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={candBars} margin={{ left: 8, right: 8, top: 8, bottom: 56 }}>
                    <CartesianGrid stroke="#e7e5de" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-22} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => num(v)} cursor={{ fill: '#f7f5f0' }} />
                    <Bar dataKey="votes">
                      {candBars.map((c) => <Cell key={c.name} fill={colorForName(c.name)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {donut.map((d) => <Cell key={d.name} fill={colorForName(d.name)} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [num(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-3 divide-y divide-slate-100">
                  {(election?.candidates ?? []).map((c, i) => (
                    <li key={c.name}>
                      <Link
                        to={`/elections/${viewId}/candidate/${encodeURIComponent(c.name)}`}
                        className="group flex items-center gap-2.5 border-b border-slate-100 py-2.5 transition last:border-b-0 hover:bg-[#fbfaf7]"
                      >
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForName(c.name) }} />
                        <span className="flex-1 truncate text-sm text-slate-700">{c.name}</span>
                        {i === 0 && <span className="border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700">Won</span>}
                        <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-900">{pct(c.share)}</span>
                        <span className="text-xs font-medium text-accent-600 opacity-0 transition group-hover:opacity-100">report →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Surface>

          {/* Insights */}
          <Surface title="Insights" subtitle="Religion mix, community leaning estimates, and swing vs the last election.">
            <InsightsSection
              electionId={viewId}
              religionData={voters?.byReligion ?? []}
              turnoutHistory={data?.turnoutHistory ?? []}
            />
          </Surface>
        </div>
      )}

      {/* ── Booths tab ── */}
      {election && tab === 'booths' && <BoothExplorer electionId={viewId} />}

      {/* ── Trends tab ── */}
      {election && tab === 'trends' && <TimelineContent electionId={viewId} />}

      {/* ── Parties tab ── */}
      {election && tab === 'parties' && <PartyContent electionId={viewId} />}

      {/* ── Win plan tab ── */}
      {election && tab === 'winplan' && <StrategyContent electionId={viewId} />}
    </div>
  );
}
