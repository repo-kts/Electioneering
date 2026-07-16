// Compact "all years" analytics embedded in the constituency overview.
// Shows every recorded election year for this constituency at a glance:
// year chips (switch year), a turnout + winning-share trend, and a winner
// timeline. Full detail lives on the Yearly-trends page.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { Surface, Loading, ErrorBox } from '../ui/kit.jsx';
import { api } from '../../lib/api.js';
import { colorFor, colorForCandidate } from '../elections/helpers.js';

export default function AllYearsAnalytics({ assemblyNo, assemblyName, currentElectionId, electionId }) {
  const q = useQuery({
    enabled: !!(assemblyNo || assemblyName),
    queryKey: ['assemblyTimeline', assemblyNo, assemblyName],
    queryFn: () => api.assemblyTimeline({ assemblyNo, assemblyName }),
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
    <Surface
      title="All-year analytics"
      subtitle="Every election on record for this constituency — turnout, winning share, and who won each year."
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
      {q.data && elections.length > 0 && (
        <div className="space-y-5">
          {/* Winner-by-year timeline as selectable chips */}
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

          {chartData.length <= 1 ? (
            <p className="border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
              Only one election on record — add more years to plot a trend.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e7e5de" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={44} />
                <Tooltip formatter={(v, n) => [v == null ? '—' : `${v}%`, n === 'turnout' ? 'Turnout' : 'Winning share']} />
                <Legend formatter={(v) => (v === 'turnout' ? 'Turnout' : 'Winning share')} />
                <Line type="monotone" dataKey="turnout" stroke={colorFor('Turnout series')} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <Line type="monotone" dataKey="winShare" stroke={colorFor('Winning share series')} strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Surface>
  );
}
