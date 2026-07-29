// Compact "all years" analytics embedded in the constituency overview.
// Shows every recorded election year for this constituency at a glance:
// year chips (switch year), separate turnout & winning-share trend charts
// (each with a Bar/Line/Area view switcher), and vote results by election.
// Full detail lives on the Yearly-trends page.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Surface, Loading, ErrorBox } from '../ui/kit.jsx';
import TrendChart from './TrendChart.jsx';
import PartyShareTimeline from './PartyShareTimeline.jsx';
import { api } from '../../lib/api.js';
import { colorFor, colorForCandidate } from '../elections/helpers.js';

export default function AllYearsAnalytics({ assemblyNo, assemblyName, currentElectionId, electionId, electionType }) {
  const q = useQuery({
    enabled: !!(assemblyNo || assemblyName),
    queryKey: ['assemblyTimeline', assemblyNo, assemblyName, electionType],
    queryFn: () => api.assemblyTimeline({ assemblyNo, assemblyName, electionType }),
  });

  const elections = q.data?.elections ?? []; // year DESC
  const chartData = useMemo(
    () =>
      [...elections]
        .reverse()
        .map((e) => ({
          year: e.electionYear ?? '—',
          turnout: e.turnout?.pct != null ? +(e.turnout.pct * 100).toFixed(1) : null,
          winShare: e.winner?.share != null ? +(e.winner.share * 100).toFixed(1) : null,
        })),
    [elections],
  );

  return (
    <div className="space-y-6">
      <Surface
        title="All-year analytics"
        subtitle="Every election on record for this constituency — pick a year to open its full result."
        right={
          <Link
            to={`/elections/${electionId}/timeline`}
            className="text-xs font-medium text-accent-600 hover:text-accent-700"
          >
            Full yearly trends →
          </Link>
        }
      >
        {q.isPending && <Loading className="h-40" />}
        {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
        {q.data && elections.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No election history recorded yet.</p>
        )}
        {/* Winner-by-year timeline as selectable chips */}
        {q.data && elections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {elections.map((e) => {
              const active = e.electionId === currentElectionId;
              const w = e.winner;
              return (
                <Link
                  key={e.electionId}
                  to={`/elections/${e.electionId}`}
                  className={`flex items-center gap-2 border px-3 py-2 text-sm transition ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-[#fbfaf7]'
                  }`}
                >
                  <span className="font-semibold tabular-nums">{e.electionYear ?? '—'}</span>
                  {w && (
                    <>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: colorForCandidate(w.name, w.party) }}
                      />
                      <span className={`max-w-[140px] truncate text-xs ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                        {w.name}
                      </span>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Surface>

      {elections.length > 0 && (
        <>
          <TrendChart
            title="Turnout by year"
            subtitle="Percent of registered voters who voted, year by year."
            info="How voter turnout in this constituency has changed election to election. The X axis is the election year; the Y axis is turnout as a % of registered voters (higher = more people voted)."
            data={chartData}
            dataKey="turnout"
            name="Turnout"
            unit="%"
            yLabel="Turnout (%)"
            domain={[0, 100]}
            color={colorFor('Turnout series')}
          />
          <TrendChart
            title="Winning share by year"
            subtitle="The winner's share of the valid vote, year by year."
            info="The winning candidate's share of the valid vote in each election. The X axis is the election year; the Y axis is the winner's vote share (%). A rising line means more dominant wins."
            data={chartData}
            dataKey="winShare"
            name="Winning share"
            unit="%"
            yLabel="Winning share (%)"
            domain={[0, 100]}
            color={colorFor('Winning share series')}
          />
        </>
      )}

      {/* Vote results by year — mirrors the booth page's headline chart. */}
      <PartyShareTimeline
        assemblyNo={assemblyNo}
        assemblyName={assemblyName}
        electionType={electionType}
        title="Vote results by election"
        subtitle="Votes polled across every recorded election for this constituency. Use Top-N to focus and toggle votes vs share of the valid vote."
      />
    </div>
  );
}
