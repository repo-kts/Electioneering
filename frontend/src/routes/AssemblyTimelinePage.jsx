import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, StatCard, Surface, Loading, ErrorBox } from '../components/ui/kit.jsx';
import { api } from '../lib/api.js';
import { colorFor, colorForParty, colorForCandidate, num } from '../components/elections/helpers.js';

const p1 = (n) => `${((n ?? 0) * 100).toFixed(1)}%`; // fraction → percent string

/**
 * Year-over-year history for a constituency. Rendered both as a standalone page
 * (default export) and inside the constituency page's "Trends" tab (TimelineContent).
 */
export function TimelineContent({ electionId }) {
  const [range, setRange] = useState('all'); // 'all' | 'recent'

  const electionQ = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => api.getElection(electionId),
  });
  const el = electionQ.data;

  const timelineQ = useQuery({
    enabled: !!el,
    queryKey: ['assemblyTimeline', el?.assemblyNo, el?.assemblyName],
    queryFn: () => api.assemblyTimeline({ assemblyNo: el.assemblyNo, assemblyName: el.assemblyName }),
  });

  const allElections = timelineQ.data?.elections ?? []; // year DESC
  const rows = useMemo(
    () => (range === 'recent' ? allElections.slice(0, 5) : allElections),
    [allElections, range],
  );

  // Charts read chronologically (ascending year).
  const chartData = useMemo(
    () =>
      [...rows]
        .reverse()
        .map((e) => ({
          year: e.electionYear ?? '—',
          turnout: e.turnout?.pct != null ? +(e.turnout.pct * 100).toFixed(1) : null,
          winShare: e.winner?.share != null ? +(e.winner.share * 100).toFixed(1) : null,
          margin: e.margin ?? 0,
          party: e.winnerParty || e.winner?.party || e.winner?.name || '',
        })),
    [rows],
  );

  const latest = rows[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
          {[
            ['recent', 'Last 5 years'],
            ['all', 'All years'],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setRange(v)}
              className={`px-3 py-1.5 text-xs font-medium transition ${range === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(electionQ.isError || timelineQ.isError) && (
        <ErrorBox
          message={(electionQ.error || timelineQ.error).message}
          onRetry={() => (electionQ.isError ? electionQ.refetch() : timelineQ.refetch())}
        />
      )}
      {(electionQ.isPending || timelineQ.isPending) && <Loading className="h-28" />}

      {timelineQ.data && allElections.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No election history recorded for this constituency yet.
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Snapshot of most recent election in range */}
          {latest && (
            <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-4">
              <StatCard label={`Latest (${latest.electionYear ?? '—'})`} value={latest.winner?.name ?? '—'} sub={latest.winner ? `${latest.winner.party ?? ''} · ${p1(latest.winner.share)}` : ''} tone="green" />
              <StatCard label="Turnout" value={latest.turnout?.pct != null ? p1(latest.turnout.pct) : '—'} sub={latest.turnout ? `${num(latest.turnout.voted)} / ${num(latest.turnout.registered)}` : ''} />
              <StatCard label="Valid votes" value={num(latest.totalValid)} />
              <StatCard label="Margin" value={num(latest.margin)} sub={latest.runnerUp ? `over ${latest.runnerUp.name}` : ''} />
            </div>
          )}

          {/* Trend: turnout % & winning share % share one axis (both 0–100%). */}
          <Surface title="Turnout & winning share over time" subtitle="Percent of registered voters who voted, and the winner's vote share, by year.">
            {chartData.length <= 1 ? (
              <p className="py-8 text-center text-sm text-slate-500">Need at least two elections to plot a trend.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#e7e5de" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={44} />
                  <Tooltip formatter={(v, n) => [v == null ? '—' : `${v}%`, n === 'turnout' ? 'Turnout' : 'Winning share']} />
                  <Legend formatter={(v) => (v === 'turnout' ? 'Turnout' : 'Winning share')} />
                  <Line type="monotone" dataKey="turnout" stroke={colorFor('Turnout series')} strokeWidth={2} dot={{ r: 4 }} connectNulls label={{ position: 'top', fontSize: 10, fill: '#64748b', formatter: (v) => (v == null ? '' : `${v}%`) }} />
                  <Line type="monotone" dataKey="winShare" stroke={colorFor('Winning share series')} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Surface>

          {/* Margin over time — votes, so a separate chart (never a dual axis). */}
          <Surface title="Victory margin over time" subtitle="Winner's lead over the runner-up, in votes, colored by winning party.">
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No margin data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#e7e5de" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => num(v)} />
                  <Tooltip formatter={(v) => [num(v), 'Margin']} cursor={{ fill: '#f7f5f0' }} />
                  <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.year} fill={colorForParty(d.party)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Party legend for the margin bars */}
            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              {[...new Set(chartData.map((d) => d.party).filter(Boolean))].map((party) => (
                <span key={party} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-block h-3 w-3" style={{ background: colorForParty(party) }} />
                  {party}
                </span>
              ))}
            </div>
          </Surface>

          {/* Full table */}
          <Surface title="Election-by-election" subtitle="Every recorded election year for this constituency. Select a year to open its full results." bodyClass="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[80px_minmax(0,1.2fr)_minmax(0,1fr)_100px_110px_100px] gap-3 border-b border-slate-200 bg-[#fbfaf7] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <div>Year</div>
                  <div>Winner</div>
                  <div>Runner-up</div>
                  <div className="text-right">Turnout</div>
                  <div className="text-right">Valid votes</div>
                  <div className="text-right">Margin</div>
                </div>
                {rows.map((e) => (
                  <Link
                    key={e.electionId}
                    to={`/elections/${e.electionId}`}
                    className="group grid grid-cols-[80px_minmax(0,1.2fr)_minmax(0,1fr)_100px_110px_100px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 transition last:border-b-0 hover:bg-[#fbfaf7]"
                  >
                    <div>
                      <div className="text-sm font-semibold tabular-nums text-slate-900 group-hover:text-accent-700">{e.electionYear ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{e.electionType}</div>
                    </div>
                    <div className="min-w-0">
                      {e.winner ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForCandidate(e.winner.name, e.winner.party) }} />
                          <span className="truncate text-sm text-slate-700">
                            <span className="font-medium text-slate-900">{e.winner.name}</span>
                            {e.winner.party ? <span className="text-slate-500"> · {e.winner.party}</span> : null}
                          </span>
                          <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-slate-600">{p1(e.winner.share)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </div>
                    <div className="truncate text-sm text-slate-600">
                      {e.runnerUp ? (
                        <>
                          {e.runnerUp.name}
                          {e.runnerUp.party ? <span className="text-slate-400"> · {e.runnerUp.party}</span> : null}
                        </>
                      ) : '—'}
                    </div>
                    <div className="text-right text-sm tabular-nums text-slate-700">{e.turnout?.pct != null ? p1(e.turnout.pct) : '—'}</div>
                    <div className="text-right text-sm tabular-nums text-slate-700">{num(e.totalValid)}</div>
                    <div className="flex items-center justify-end gap-2 text-right text-sm tabular-nums text-slate-700">
                      <span>{num(e.margin)}</span>
                      <span className="text-slate-300 transition group-hover:text-slate-900">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Surface>
        </>
      )}
    </div>
  );
}

export default function AssemblyTimelinePage() {
  const { id } = useParams();
  const electionId = Number(id);
  const electionQ = useQuery({ queryKey: ['election', electionId], queryFn: () => api.getElection(electionId) });
  const el = electionQ.data;
  const name = el ? `${el.assemblyNo != null ? el.assemblyNo + '-' : ''}${el.assemblyName}` : 'Assembly';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: 'Elections', to: '/elections' },
            { label: el ? `${el.assemblyName} ${el.electionYear ?? ''}`.trim() : 'Election', to: `/elections/${electionId}` },
            { label: 'Yearly timeline' },
          ]}
        />
        <PageHeader
          eyebrow="Constituency history"
          title={`${el?.assemblyName ?? 'Assembly'} — yearly timeline`}
          subtitle={el ? `${name}${el.state ? ' · ' + el.state : ''}` : 'Loading…'}
        />
      </div>
      <TimelineContent electionId={electionId} />
    </div>
  );
}
