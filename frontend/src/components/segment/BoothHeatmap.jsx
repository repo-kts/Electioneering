import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../ui/Loader.jsx';
import { api } from '../../lib/api.js';

function colorFor(name) {
  if (!name) return '#94a3b8';
  const palette = ['#24594b', '#6f4e37', '#5f6f52', '#7a4e57', '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const CLASS_COLOR = {
  'Safe-win': '#15803d',
  'Marginal-win': '#65a30d',
  Swing: '#d97706',
  'Marginal-loss': '#dc6e2e',
  'Safe-loss': '#b91c1c',
  'No-data': '#94a3b8',
};
const CLASS_ORDER = ['Safe-win', 'Marginal-win', 'Swing', 'Marginal-loss', 'Safe-loss', 'No-data'];

export default function BoothHeatmap({ elections = [] }) {
  const [electionId, setElectionId] = useState(elections[0]?.id ?? null);
  const [mode, setMode] = useState('leader'); // 'leader' | 'targets'
  const [candidate, setCandidate] = useState('');
  const qc = useQueryClient();

  const heatmap = useQuery({
    queryKey: ['analytics', 'boothLeaning', electionId],
    queryFn: () => api.boothLeaning(electionId),
    enabled: !!electionId,
  });

  const targetsQ = useQuery({
    queryKey: ['booth-targets', electionId, candidate],
    queryFn: () => api.boothTargets(electionId, candidate || undefined),
    enabled: !!electionId && mode === 'targets',
    placeholderData: (p) => p,
  });

  const recompute = useMutation({
    mutationFn: () => api.recomputeLeaning(electionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics', 'boothLeaning', electionId] });
      qc.invalidateQueries({ queryKey: ['analytics', 'overview'] });
      qc.invalidateQueries({ queryKey: ['voters'] });
    },
  });

  const allCandidates = useMemo(() => {
    if (!heatmap.data?.items) return [];
    const set = new Set();
    for (const ps of heatmap.data.items) {
      Object.keys(ps.byCandidate ?? {}).forEach((c) => set.add(c));
    }
    return Array.from(set);
  }, [heatmap.data]);

  return (
    <Card>
      <Card.Head
        title="Booth heatmap"
        subtitle="Each polling station coloured by its dominant predicted candidate (Form 20 share). Recompute after editing Form 20."
      />
      <Card.Body>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label className="text-xs text-slate-500">Election:</label>
          <select
            value={electionId ?? ''}
            onChange={(e) => setElectionId(e.target.value ? Number(e.target.value) : null)}
            className="field field-sm"
          >
            <option value="">— pick —</option>
            {elections.map((e) => (
              <option key={e.id} value={e.id}>
                {e.assemblyNo}-{e.assemblyName} {e.electionYear ?? ''}
              </option>
            ))}
          </select>
          <Button
            onClick={() => recompute.mutate()}
            disabled={!electionId || recompute.isPending || heatmap.isFetching}
          >
            {recompute.isPending ? 'Recomputing…' : 'Recompute'}
          </Button>
          {heatmap.isFetching && !heatmap.isPending && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><Spinner size={12} /> refreshing…</span>
          )}
          {recompute.isError && (
            <span className="text-xs text-rose-600">{recompute.error.message}</span>
          )}

          {/* Color mode toggle (Tailwind) */}
          <div className="ml-auto inline-flex overflow-hidden border border-slate-300">
            {[
              ['leader', 'Leader'],
              ['targets', 'Targets'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-3 py-1 text-xs font-medium transition ${
                  mode === key ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 hover:bg-[#f7f5f0]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'targets' && (
            <select
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
            >
              <option value="">Auto (leader)</option>
              {allCandidates.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {!electionId && <div className="border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">Select an election to view the heatmap.</div>}

        {electionId && heatmap.isPending && <SkeletonRows rows={4} cols={4} rowHeight={70} />}

        {heatmap.isError && (
          <ErrorState
            error={heatmap.error}
            onRetry={() => heatmap.refetch()}
            title="Couldn't load booth leanings"
          />
        )}

        {mode === 'leader' && heatmap.data?.items?.length > 0 && (
          <>
            <div className="overflow-hidden border border-slate-200">
              <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(120px,0.8fr)_120px] gap-3 border-b border-slate-200 bg-[#fbfaf7] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 max-md:hidden">
                <div>Booth</div>
                <div>Polling station</div>
                <div>Leader</div>
                <div className="text-right">Valid</div>
              </div>
              {heatmap.data.items.map((ps) => {
                const color = colorFor(ps.leader);
                return (
                  <div
                    key={ps.id}
                    className="grid gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 md:grid-cols-[88px_minmax(0,1fr)_minmax(120px,0.8fr)_120px] md:items-center md:gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ background: color }} />
                      <span className="text-sm font-semibold text-slate-900">PS-{ps.serial}</span>
                    </div>
                    <div className="truncate text-sm text-slate-600" title={ps.name ?? ''}>{ps.name ?? '—'}</div>
                    <div className="truncate text-sm font-medium" style={{ color }}>{ps.leader ?? '—'} <span className="text-xs font-normal text-slate-500">({((ps.leaderShare ?? 0) * 100).toFixed(0)}%)</span></div>
                    <div className="text-right text-sm tabular-nums text-slate-700">
                      {ps.totalValid}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              {allCandidates.map((c) => (
                <span key={c} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-block h-3 w-3" style={{ background: colorFor(c) }} />
                  {c}
                </span>
              ))}
            </div>
          </>
        )}

        {heatmap.data && heatmap.data.items?.length === 0 && (
          <div className="border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No polling stations for this election.</div>
        )}

        {/* Targets mode — booths colored by competitiveness (Tailwind) */}
        {mode === 'targets' && electionId && (
          <>
            {targetsQ.isPending && <SkeletonRows rows={4} cols={4} rowHeight={70} />}
            {targetsQ.isError && (
              <ErrorState error={targetsQ.error} onRetry={() => targetsQ.refetch()} title="Couldn't load targets" />
            )}
            {targetsQ.data && (
              <>
                <div className="mb-3 text-xs text-slate-500">
                  Booths colored by competitiveness for <strong className="text-slate-700">{targetsQ.data.ourCandidate}</strong>.
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                  {targetsQ.data.items.map((b) => {
                    const c = CLASS_COLOR[b.classification] ?? '#94a3b8';
                    return (
                      <div
                        key={b.id}
                        className="border bg-white p-2"
                        style={{ borderTop: `4px solid ${c}` }}
                        title={`PS-${b.serial} ${b.name ?? ''}\n${b.classification}\nOur: ${(b.ourShare * 100).toFixed(1)}%  margin ${(b.margin * 100).toFixed(1)}%`}
                      >
                        <div className="text-xs font-semibold text-slate-700">PS-{b.serial}</div>
                        <div className="truncate text-[11px] text-slate-400">{b.name ?? '—'}</div>
                        <span
                          className="mt-1 inline-block border px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: c + '22', color: c }}
                        >
                          {b.classification}
                        </span>
                        <div className="mt-1 text-[11px] tabular-nums text-slate-500">
                          {(b.ourShare * 100).toFixed(0)}% · margin {(b.margin * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {CLASS_ORDER.map((k) => (
                    <span key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="inline-block h-3 w-3" style={{ background: CLASS_COLOR[k] }} />
                      {k}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
