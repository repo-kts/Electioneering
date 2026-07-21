import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { PageHeader, Surface, StatCard, Loading, ErrorBox } from '../components/ui/kit.jsx';
import ActionPlan from '../components/analytics/ActionPlan.jsx';
import { api } from '../lib/api.js';

const num = (n) => Math.round(n ?? 0).toLocaleString();
const PRIORITY = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const FAVORABLE = ['Safe-win', 'Marginal-win', 'Swing'];
const FLIPPABLE = ['Swing', 'Marginal-loss'];

/**
 * The "Win plan" — a plain-language action plan on top, then a live result
 * simulator and the full strategy brief. Rendered as a standalone page (default)
 * and inside the constituency page's "Win plan" tab (StrategyContent).
 */
export function StrategyContent({ electionId, initialCandidate = '' }) {
  const [candidate, setCandidate] = useState(initialCandidate);

  const electionQ = useQuery({ queryKey: ['election', electionId], queryFn: () => api.getElection(electionId) });
  const targetsQ = useQuery({
    queryKey: ['booth-targets', electionId, candidate],
    queryFn: () => api.boothTargets(electionId, candidate || undefined),
    enabled: !!electionId,
    placeholderData: (p) => p,
  });
  const briefQ = useQuery({
    queryKey: ['strategy', electionId, candidate],
    queryFn: () => api.strategyBrief(electionId, candidate || undefined),
    enabled: !!electionId,
  });

  const items = targetsQ.data?.items ?? [];
  const ourCandidate = targetsQ.data?.ourCandidate ?? candidate;
  const medianTurnout = targetsQ.data?.medianTurnout ?? 0;
  const candidates = electionQ.data?.candidates ?? [];

  // ── Simulator state ──────────────────────────────────────────
  const [flips, setFlips] = useState(() => new Set());
  const [lift, setLift] = useState(0); // 0..0.25 turnout lift on favorable booths

  const sim = useMemo(() => {
    let our = 0;
    let rival = 0;
    for (const b of items) {
      our += b.ourShare * b.totalValid;
      rival += b.topOpponentShare * b.totalValid;
    }
    let gainFlip = 0;
    for (const b of items) {
      if (!flips.has(b.id)) continue;
      const ourV = b.ourShare * b.totalValid;
      const rivalV = b.topOpponentShare * b.totalValid;
      gainFlip += Math.max(rivalV - ourV, 0) + 1; // votes to overtake
    }
    let gainOur = 0;
    let gainRival = 0;
    for (const b of items) {
      if (!FAVORABLE.includes(b.classification)) continue;
      if (b.turnoutPct >= medianTurnout || b.registeredVoters === 0) continue;
      const newVoters = b.registeredVoters * lift;
      gainOur += newVoters * b.ourShare;
      gainRival += newVoters * b.topOpponentShare;
    }
    const baseMargin = our - rival;
    const projOur = our + gainFlip + gainOur;
    const projRival = rival + gainRival;
    const projMargin = projOur - projRival;
    return { our, rival, baseMargin, projOur, projRival, projMargin, gainFlip, gainOur, gainRival };
  }, [items, flips, lift, medianTurnout]);

  const flippable = useMemo(
    () => items.filter((b) => FLIPPABLE.includes(b.classification)).sort((a, b) => b.margin - a.margin),
    [items],
  );
  const gotvCount = useMemo(
    () => items.filter((b) => FAVORABLE.includes(b.classification) && b.turnoutPct < medianTurnout && b.registeredVoters > 0).length,
    [items, medianTurnout],
  );

  const won = sim.projMargin > 0;
  const flipped = sim.baseMargin <= 0 && sim.projMargin > 0;

  function toggleFlip(idv) {
    setFlips((prev) => {
      const n = new Set(prev);
      n.has(idv) ? n.delete(idv) : n.add(idv);
      return n;
    });
  }
  function flipAll() {
    setFlips(new Set(flippable.map((b) => b.id)));
  }
  function reset() {
    setFlips(new Set());
    setLift(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Pick swing booths to flip and a turnout lift — see the projected result update live. A planning model, not a prediction.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate</span>
          <select value={candidate} onChange={(e) => { setCandidate(e.target.value); reset(); }} className="w-auto">
            <option value="">Auto (leader)</option>
            {candidates.map((c) => <option key={c.id ?? c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {/* ── Plain-language action plan first ── */}
      <ActionPlan electionId={electionId} candidate={candidate || undefined} />

      {targetsQ.isError && <ErrorBox message={targetsQ.error.message} onRetry={() => targetsQ.refetch()} />}
      {targetsQ.isPending && <Loading className="h-40" />}

      {targetsQ.data && (
        <>
          {/* ── Simulator ── */}
          <Surface eyebrow={`Simulating for ${ourCandidate}`} title="Result simulator" bodyClass="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
              {/* controls */}
              <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Flip swing booths</h3>
                  <div className="flex gap-2 text-xs">
                    <button onClick={flipAll} className="font-medium text-accent-600 hover:underline">Select all</button>
                    <button onClick={reset} className="font-medium text-slate-500 hover:underline">Reset</button>
                  </div>
                </div>
                {flippable.length === 0 ? (
                  <p className="text-sm text-slate-400">No swing / recoverable booths to flip — the model has nothing to move here.</p>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
                    {flippable.map((b) => {
                      const need = Math.max(b.topOpponentShare * b.totalValid - b.ourShare * b.totalValid, 0) + 1;
                      const on = flips.has(b.id);
                      return (
                        <label key={b.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${on ? 'border-accent-300 bg-accent-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={on} onChange={() => toggleFlip(b.id)} />
                          <span className="font-semibold text-slate-700">PS-{b.serial}</span>
                          <span className="flex-1 truncate text-slate-500">{b.name ?? '—'}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{b.classification}</span>
                          <span className="w-20 text-right text-xs tabular-nums text-slate-500">+{num(need)} votes</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Turnout lift (GOTV)</h3>
                    <span className="text-sm font-bold tabular-nums text-accent-600">+{(lift * 100).toFixed(0)}%</span>
                  </div>
                  <input type="range" min="0" max="0.25" step="0.01" value={lift} onChange={(e) => setLift(Number(e.target.value))} className="w-full accent-accent-600" />
                  <p className="mt-1.5 text-xs text-slate-400">Applied to {gotvCount} favorable booth(s) below median turnout. You keep your booth vote-share of the new voters.</p>
                </div>
              </div>

              {/* scoreboard */}
              <div className="flex flex-col justify-center gap-4 bg-slate-50/60 p-6">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Projected margin</div>
                  <div className={`mt-1 text-4xl font-bold tracking-tight tabular-nums ${won ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {sim.projMargin >= 0 ? '+' : ''}{num(sim.projMargin)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">was {sim.baseMargin >= 0 ? '+' : ''}{num(sim.baseMargin)} · vs strongest rival per booth</div>
                </div>
                <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${won ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {flipped ? '🎯 This plan flips the seat' : won ? 'Holding the lead' : 'Still behind — add more booths'}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">Our votes</div>
                    <div className="font-bold tabular-nums text-slate-800">{num(sim.projOur)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Added by plan</div>
                    <div className="font-bold tabular-nums text-accent-600">+{num(sim.gainFlip + sim.gainOur)}</div>
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          {/* ── Strategy brief ── */}
          {briefQ.data && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Swing" value={briefQ.data.summary.swing} tone={briefQ.data.summary.swing ? 'amber' : 'default'} />
                <StatCard label="GOTV booths" value={gotvCount} />
                <StatCard label="Defend" value={briefQ.data.summary.marginalWin} />
                <StatCard label="Recoverable" value={briefQ.data.summary.marginalLoss} />
                <StatCard label="Safe win" value={briefQ.data.summary.safeWin} tone="green" />
                <StatCard label="Safe loss" value={briefQ.data.summary.safeLoss} tone="red" />
              </div>

              <Surface eyebrow="Field plan" title="Prioritised plays">
                <div className="space-y-3">
                  {briefQ.data.plays.filter((p) => p.booths.length).map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${PRIORITY[p.priority]}`}>{p.priority}</span>
                        <h3 className="text-sm font-semibold text-slate-800">{p.title}</h3>
                        <span className="text-xs font-medium text-slate-400">{p.metric}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-500">{p.rationale}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.booths.map((b) => (
                          <Link key={b.id} to={`/elections/${electionId}/booth/${b.id}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                            PS-{b.serial}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Surface eyebrow="Do this" title="Recommendations">
                  <ul className="space-y-2.5">
                    {briefQ.data.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">{i + 1}</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </Surface>
                <Surface eyebrow="Data quality" title="Coverage gaps">
                  <ul className="space-y-2.5">
                    {briefQ.data.dataQuality.map((d) => (
                      <li key={d.label} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 text-sm last:border-0">
                        <div>
                          <div className="font-medium text-slate-700">{d.label}</div>
                          <div className="text-xs text-slate-400">{d.note}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${PRIORITY[d.severity]}`}>{num(d.value)}</span>
                      </li>
                    ))}
                  </ul>
                </Surface>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function StrategyPage() {
  const { id } = useParams();
  const electionId = Number(id);
  const [params] = useSearchParams();
  const electionQ = useQuery({ queryKey: ['election', electionId], queryFn: () => api.getElection(electionId) });
  const electionName = electionQ.data ? `${electionQ.data.assemblyName} ${electionQ.data.electionYear ?? ''}`.trim() : 'Election';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: 'Elections', to: '/elections' }, { label: electionName, to: `/elections/${electionId}` }, { label: 'Win plan' }]} />
        <PageHeader eyebrow="Path to victory" title="Win plan" />
      </div>
      <StrategyContent electionId={electionId} initialCandidate={params.get('candidate') || ''} />
    </div>
  );
}
