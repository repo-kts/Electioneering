import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, StatCard, Surface, Loading, ErrorBox } from '../components/ui/kit.jsx';
import TrendChart from '../components/analytics/TrendChart.jsx';
import { api } from '../lib/api.js';
import { colorFor, colorForParty, colorForCandidate, num, pct, benchmarkFor } from '../components/elections/helpers.js';

const p1 = (n) => `${((n ?? 0) * 100).toFixed(1)}%`; // fraction → percent string

/**
 * Year-over-year history for a constituency. Rendered both as a standalone page
 * (default export) and inside the constituency page's "Trends" tab (TimelineContent).
 */
export function TimelineContent({ electionId }) {
  const [range, setRange] = useState('all'); // '3' | '5' | '10' | 'all'

  const electionQ = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => api.getElection(electionId),
  });
  const el = electionQ.data;

  const timelineQ = useQuery({
    enabled: !!el,
    queryKey: ['assemblyTimeline', el?.assemblyNo, el?.assemblyName, el?.electionType],
    queryFn: () => api.assemblyTimeline({ assemblyNo: el.assemblyNo, assemblyName: el.assemblyName, electionType: el.electionType }),
  });

  const allElections = timelineQ.data?.elections ?? []; // year DESC
  const rows = useMemo(
    () => (range === 'all' ? allElections : allElections.slice(0, Number(range))),
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
          nota: e.notaShare != null ? +(e.notaShare * 100).toFixed(2) : 0,
          party: e.winnerParty || e.winner?.party || e.winner?.name || '',
        })),
    [rows],
  );

  // Seat-control ribbon, chronological: who held the seat each year + how
  // competitive it was, plus how many times the seat changed hands.
  const control = useMemo(() => {
    const cells = [...rows].reverse().map((e) => ({
      year: e.electionYear ?? '—',
      party: e.winnerParty || e.winner?.party || '',
      winner: e.winner?.name ?? '',
      share: e.winner?.share ?? null,
    }));
    let flips = 0;
    let prev = null;
    for (const c of cells) {
      const key = c.party || c.winner;
      if (key && prev && key !== prev) flips += 1;
      if (key) prev = key;
    }
    return { cells, flips };
  }, [rows]);

  const latest = rows[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Window</span>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            {[
              ['3', 'Last 3'],
              ['5', 'Last 5'],
              ['10', 'Last 10'],
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
        {allElections.length > 0 && (
          <span className="text-xs text-slate-500">
            Showing {rows.length} of {allElections.length} {allElections.length === 1 ? 'election' : 'elections'}
            <span className="ml-1 text-slate-400">· each chart supports bar / line / area</span>
          </span>
        )}
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

          {/* Seat control ribbon — who held the seat each year + competitiveness band. */}
          <Surface
            title="Seat control"
            subtitle="Who won each year, coloured by party, with a competitiveness band from the winner's share. Read left → right, oldest to newest."
            right={
              <span className="text-xs text-slate-500">
                {control.cells.length} {control.cells.length === 1 ? 'election' : 'elections'} ·{' '}
                {control.flips === 0 ? 'never changed hands' : `${control.flips} ${control.flips === 1 ? 'change' : 'changes'} of hands`}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <div className="flex min-w-min gap-2">
                {control.cells.map((c, i) => {
                  const band = benchmarkFor(c.share);
                  return (
                    <div key={i} className="min-w-[120px] flex-1 border border-slate-200 bg-white">
                      <div className="h-1.5 w-full" style={{ background: colorForParty(c.party) }} />
                      <div className="p-2.5">
                        <div className="text-sm font-semibold tabular-nums text-slate-900">{c.year}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorForParty(c.party) }} />
                          <span className="truncate text-xs text-slate-600">{c.party || 'Ind.'}</span>
                        </div>
                        <div className="mt-1 text-xs tabular-nums text-slate-500">{c.share != null ? pct(c.share) : '—'}</div>
                        <span className={`mt-1.5 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold ${band.cls}`}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: band.dot }} />
                          {band.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Surface>

          {/* Turnout — its own chart (was combined with winning share). */}
          <TrendChart
            title="Turnout by year"
            subtitle="Percent of registered voters who voted, year by year."
            data={chartData}
            dataKey="turnout"
            name="Turnout"
            unit="%"
            domain={[0, 100]}
            color={colorFor('Turnout series')}
          />

          {/* Winning share — its own chart. */}
          <TrendChart
            title="Winning share by year"
            subtitle="The winner's share of the valid vote, year by year."
            data={chartData}
            dataKey="winShare"
            name="Winning share"
            unit="%"
            domain={[0, 100]}
            color={colorFor('Winning share series')}
          />

          {/* Margin over time — votes, coloured by winning party (bar view only). */}
          <TrendChart
            title="Victory margin over time"
            subtitle="Winner's lead over the runner-up, in votes, coloured by winning party."
            data={chartData}
            dataKey="margin"
            name="Margin"
            color="#64748b"
            cells={chartData.map((d) => colorForParty(d.party))}
          >
            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              {[...new Set(chartData.map((d) => d.party).filter(Boolean))].map((party) => (
                <span key={party} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-block h-3 w-3" style={{ background: colorForParty(party) }} />
                  {party}
                </span>
              ))}
            </div>
          </TrendChart>

          {/* NOTA over time — share of votes polled that went to None-of-the-above. */}
          <TrendChart
            title="NOTA over time"
            subtitle="None-of-the-above as a share of votes polled, year by year."
            data={chartData}
            dataKey="nota"
            name="NOTA"
            unit="%"
            color={colorFor('NOTA')}
          />

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
