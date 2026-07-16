import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import BoothMap from '../components/analytics/BoothMap.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import InsightsSection from '../components/analytics/InsightsSection.jsx';
import StrategyBrief from '../components/analytics/StrategyBrief.jsx';
import { PageHeader, StatCard, Surface, Pill, Button, Loading, ErrorBox } from '../components/ui/kit.jsx';
import { api } from '../lib/api.js';

function colorFor(s) {
  if (!s) return '#94a3b8';
  const palette = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
const pct = (n) => `${((n ?? 0) * 100).toFixed(1)}%`;
const num = (n) => (n ?? 0).toLocaleString();

export default function ElectionOverviewPage() {
  const { id } = useParams();
  const electionId = Number(id);

  const overviewQ = useQuery({
    queryKey: ['analytics', 'overview', electionId],
    queryFn: () => api.analyticsOverview(electionId),
  });
  const boothQ = useQuery({
    queryKey: ['analytics', 'boothLeaning', electionId],
    queryFn: () => api.boothLeaning(electionId),
  });

  const qc = useQueryClient();
  const { show } = useToast();
  const [boothView, setBoothView] = useState('grid'); // 'grid' | 'map'
  const geocode = useMutation({
    mutationFn: () => api.geocodeBooths(electionId),
    onSuccess: (r) => {
      show(`Geocoded ${r.geocoded} of ${r.total} booths`, r.failed ? 'warn' : 'success');
      qc.invalidateQueries({ queryKey: ['analytics', 'boothLeaning', electionId] });
      setBoothView('map');
    },
    onError: (e) => show(e.message || 'Geocoding failed', 'error'),
  });

  const data = overviewQ.data;
  const election = data?.election;
  const voters = data?.voters;
  const booths = boothQ.data?.items ?? [];
  const geocoded = boothQ.data?.geocoded ?? 0;

  const candBars = useMemo(
    () => (election?.candidates ?? []).map((c) => ({ name: c.name, votes: c.votes })),
    [election],
  );
  const donut = useMemo(
    () => (election?.candidates ?? []).slice(0, 6).map((c) => ({ name: c.name, value: c.votes })),
    [election],
  );

  const name = election ? `${election.assemblyName} ${election.electionYear ?? ''}`.trim() : 'Election';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: 'Elections', to: '/elections' }, { label: name }]} />
        <PageHeader
          eyebrow={election ? election.electionType : 'Results'}
          title={name}
          subtitle={election ? `${election.assemblyNo}-${election.assemblyName}${election.state ? ' · ' + election.state : ''}` : 'Loading…'}
          actions={
            <>
              <Link to="/segment">
                <Button variant="secondary"><span className="text-slate-700">Voter search</span></Button>
              </Link>
              <Link to={`/elections/${electionId}/parties`}>
                <Button variant="secondary"><span className="text-slate-700">Party analytics →</span></Button>
              </Link>
              <Link to={`/elections/${electionId}/timeline`}>
                <Button variant="secondary"><span className="text-slate-700">Yearly trends →</span></Button>
              </Link>
              <Link to={`/elections/${electionId}/strategy`}>
                <Button variant="primary">Win plan →</Button>
              </Link>
            </>
          }
        />
      </div>

      {overviewQ.isError && <ErrorBox message={overviewQ.error.message} onRetry={() => overviewQ.refetch()} />}
      {overviewQ.isPending && <Loading className="h-28" />}

      {/* KPIs */}
      {election && (
        <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total voters" value={num(voters?.total)} />
          <StatCard label="Turnout" value={pct(election.turnout.pct)} sub={`${num(election.turnout.voted)} / ${num(election.turnout.registered)}`} />
          <StatCard label="Valid votes" value={num(election.totalValid)} />
          <StatCard label="NOTA" value={num(election.totalNota)} sub={election.totalCast ? pct(election.totalNota / election.totalCast) : ''} />
          <StatCard label="Leader" value={election.leader?.name ?? '—'} sub={election.leader ? `${pct(election.leader.share)} · ${num(election.leader.votes)}` : ''} tone="green" />
          <StatCard label="Margin" value={election.leader && election.runnerUp ? num(election.leader.votes - election.runnerUp.votes) : '—'} sub={election.runnerUp ? `over ${election.runnerUp.name}` : ''} />
        </div>
      )}

      {/* Booth grid */}
      <Surface
        title="Polling stations"
        subtitle="Leading candidate and valid vote count by booth."
        right={
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
              {['grid', 'map'].map((v) => (
                <button
                  key={v}
                  onClick={() => setBoothView(v)}
                  className={`px-3 py-1 text-xs font-medium capitalize transition ${boothView === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {boothView === 'map' && geocoded < booths.length && (
              <button
                onClick={() => geocode.mutate()}
                disabled={geocode.isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {geocode.isPending ? 'Geocoding…' : `Geocode booths (${geocoded}/${booths.length})`}
              </button>
            )}
          </div>
        }
      >
        {boothView === 'map' ? (
          <BoothMap items={booths} electionId={electionId} />
        ) : boothQ.isError ? (
          <ErrorBox message={boothQ.error.message} onRetry={() => boothQ.refetch()} />
        ) : boothQ.isPending ? (
          <div className="divide-y divide-slate-200 border border-slate-200">
            {Array.from({ length: 6 }).map((_, i) => <Loading key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            <div className="overflow-hidden border border-slate-200">
              <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(120px,0.8fr)_120px] gap-3 border-b border-slate-200 bg-[#fbfaf7] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 max-md:hidden">
                <div>Booth</div>
                <div>Polling station</div>
                <div>Leader</div>
                <div className="text-right">Valid</div>
              </div>
              {booths.map((ps) => {
                const reported = (ps.totalValid ?? 0) > 0;
                const c = colorFor(ps.leader);
                return (
                  <Link
                    key={ps.id}
                    to={`/elections/${electionId}/booth/${ps.id}`}
                    className="group grid gap-2 border-b border-slate-100 px-3 py-3 transition last:border-b-0 hover:bg-[#fbfaf7] md:grid-cols-[88px_minmax(0,1fr)_minmax(120px,0.8fr)_120px] md:items-center md:gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ background: reported ? c : '#cbd5e1' }} />
                      <span className="text-sm font-semibold text-slate-900">PS-{ps.serial}</span>
                    </div>
                    <div className="truncate text-sm text-slate-600" title={ps.name ?? ''}>{ps.name ?? '—'}</div>
                    {reported ? (
                      <>
                        <div className="truncate text-sm font-medium" style={{ color: c }}>{ps.leader ?? '—'} <span className="text-xs font-normal text-slate-500">({pct(ps.leaderShare)})</span></div>
                        <div className="flex items-center justify-between gap-3 text-sm tabular-nums text-slate-700 md:justify-end">
                          <span>{num(ps.totalValid)}</span>
                          <span className="text-slate-400 transition group-hover:text-slate-950">→</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-slate-400">No Form 20 data</div>
                        <div className="text-right text-slate-400">—</div>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              {[...new Set(booths.filter((b) => b.leader).map((b) => b.leader))].map((l) => (
                <span key={l} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-block h-3 w-3" style={{ background: colorFor(l) }} />
                  {l}
                </span>
              ))}
            </div>
          </>
        )}
      </Surface>

      {election && <StrategyBrief electionId={electionId} candidates={election.candidates ?? []} />}

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
                  {candBars.map((c) => <Cell key={c.name} fill={colorFor(c.name)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                  {donut.map((d) => <Cell key={d.name} fill={colorFor(d.name)} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [num(v), n]} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-3 divide-y divide-slate-100">
              {(election?.candidates ?? []).map((c, i) => (
                <li key={c.name}>
                  <Link
                    to={`/elections/${electionId}/candidate/${encodeURIComponent(c.name)}`}
                    className="group flex items-center gap-2.5 border-b border-slate-100 py-2.5 transition last:border-b-0 hover:bg-[#fbfaf7]"
                  >
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(c.name) }} />
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
      {election && (
        <Surface title="Insights" subtitle="Religion mix, community leaning estimates, and swing vs the last election.">
          <InsightsSection
            electionId={electionId}
            religionData={voters?.byReligion ?? []}
            turnoutHistory={data?.turnoutHistory ?? []}
          />
        </Surface>
      )}
    </div>
  );
}
