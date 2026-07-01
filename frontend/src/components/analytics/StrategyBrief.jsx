import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Surface, Button, Loading, ErrorBox } from '../ui/kit.jsx';
import { api } from '../../lib/api.js';

const pct = (n) => `${((n ?? 0) * 100).toFixed(0)}%`;
const num = (n) => (n ?? 0).toLocaleString();

const PRIORITY = {
  high: 'border-rose-200 bg-rose-50 text-rose-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-300 bg-white text-slate-600',
};

const CLASS_LABEL = {
  'Safe-win': 'Safe win',
  'Marginal-win': 'Narrow win',
  Swing: 'Swing',
  'Marginal-loss': 'Recoverable loss',
  'Safe-loss': 'Opposition strong',
  'No-data': 'No data',
};

export default function StrategyBrief({ electionId, candidates = [] }) {
  const [candidate, setCandidate] = useState(candidates[0]?.name ?? '');
  useEffect(() => {
    if (!candidate && candidates[0]?.name) setCandidate(candidates[0].name);
  }, [candidate, candidates]);
  const q = useQuery({
    queryKey: ['analytics', 'strategy', electionId, candidate],
    queryFn: () => api.strategyBrief(electionId, candidate || undefined),
    enabled: !!electionId,
  });

  const plays = q.data?.plays ?? [];
  const candidateStats = useMemo(() => {
    const idx = candidates.findIndex((c) => c.name === (q.data?.candidate ?? candidate));
    const c = idx >= 0 ? candidates[idx] : null;
    const leader = candidates[0];
    return {
      votes: c?.votes ?? 0,
      share: c?.share ?? 0,
      rank: idx >= 0 ? idx + 1 : null,
      margin: c && leader ? c.votes - leader.votes : 0,
    };
  }, [candidate, candidates, q.data?.candidate]);

  return (
    <Surface
      title="Campaign strategy brief"
      subtitle="Booth-level action plan generated from Form 20 results, turnout gaps, and voter-roll readiness."
      right={
        <div className="flex items-center gap-2">
          <select
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
            className="w-52"
          >
            {candidates.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      }
    >
      {q.isPending && <Loading className="h-44" />}
      {q.isError && <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-4 lg:grid-cols-7">
            <Metric label="Candidate votes" value={num(candidateStats.votes)} />
            <Metric label="Vote share" value={pct(candidateStats.share)} />
            <Metric label="Rank" value={candidateStats.rank ? `${candidateStats.rank}/${candidates.length}` : '—'} />
            <Metric label="Booths" value={num(q.data.summary.booths)} />
            <Metric label="Mapped voters" value={num(q.data.summary.mappedVoters)} />
            <Metric label="Median turnout" value={pct(q.data.summary.medianTurnout)} />
            <Metric
              label="Vs leader"
              value={candidateStats.margin >= 0 ? 'Leader' : num(candidateStats.margin)}
              tone={candidateStats.margin >= 0 ? 'text-accent-700' : 'text-rose-700'}
            />
          </div>

          <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-3 lg:grid-cols-6">
            <Metric label="Safe wins" value={q.data.summary.safeWin} tone="text-accent-700" />
            <Metric label="Narrow wins" value={q.data.summary.marginalWin} tone="text-amber-700" />
            <Metric label="Swing" value={q.data.summary.swing} tone="text-rose-700" />
            <Metric label="Recoverable losses" value={q.data.summary.marginalLoss} tone="text-amber-700" />
            <Metric label="Safe losses" value={q.data.summary.safeLoss} tone="text-rose-700" />
            <Metric label="No data" value={q.data.summary.noData} tone="text-slate-500" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              {plays.map((play) => (
                <PlayCard key={play.id} play={play} electionId={electionId} />
              ))}
            </div>

            <div className="space-y-4">
              <div className="border border-slate-300 bg-white">
                <div className="border-b border-slate-200 bg-[#fbfaf7] px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-950">Recommended actions</h3>
                </div>
                <ol className="divide-y divide-slate-200">
                  {q.data.recommendations.map((r, i) => (
                    <li key={r} className="flex gap-3 px-4 py-3 text-sm text-slate-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-slate-300 bg-[#f7f5f0] text-xs font-semibold text-slate-700">
                        {i + 1}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="border border-slate-300 bg-white">
                <div className="border-b border-slate-200 bg-[#fbfaf7] px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-950">Data readiness</h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {q.data.dataQuality.map((d) => (
                    <div key={d.label} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-800">{d.label}</span>
                        <span className={`border px-2 py-0.5 text-xs font-medium ${PRIORITY[d.severity]}`}>
                          {num(d.value)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{d.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Link to={`/elections/${electionId}/candidate/${encodeURIComponent(q.data.candidate)}`}>
                <Button variant="primary" className="w-full">Open candidate report</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Surface>
  );
}

function Metric({ label, value, tone = 'text-slate-950' }) {
  return (
    <div className="border-b border-r border-slate-200 px-3 py-3 last:border-r-0 lg:border-b-0">
      <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function PlayCard({ play, electionId }) {
  return (
    <div className="border border-slate-300 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-[#fbfaf7] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">{play.title}</h3>
            <span className={`border px-2 py-0.5 text-[11px] font-medium ${PRIORITY[play.priority]}`}>
              {play.priority}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{play.rationale}</p>
        </div>
        <div className="text-right text-sm font-semibold tabular-nums text-slate-950">{play.metric}</div>
      </div>

      {play.booths.length === 0 ? (
        <div className="px-4 py-5 text-sm text-slate-400">No booth currently matches this play.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Booth</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 text-right font-medium">Our %</th>
                <th className="px-3 py-2 text-right font-medium">Margin</th>
                <th className="px-3 py-2 text-right font-medium">Turnout</th>
              </tr>
            </thead>
            <tbody>
              {play.booths.slice(0, 6).map((b) => (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-[#fbfaf7]">
                  <td className="px-4 py-2">
                    <Link to={`/elections/${electionId}/booth/${b.id}`} className="font-medium text-slate-900 hover:text-accent-700">
                      PS-{b.serial}
                    </Link>
                    <div className="max-w-[260px] truncate text-xs text-slate-500" title={b.name ?? ''}>{b.name ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{CLASS_LABEL[b.classification] ?? b.classification}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{pct(b.ourShare)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${b.margin >= 0 ? 'text-accent-700' : 'text-rose-700'}`}>
                    {b.margin >= 0 ? '+' : ''}{pct(b.margin)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{pct(b.turnoutPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
