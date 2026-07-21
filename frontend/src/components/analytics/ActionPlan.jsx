import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Surface, Loading, ErrorBox } from '../ui/kit.jsx';
import { api } from '../../lib/api.js';
import { num, pct } from '../elections/helpers.js';

// "Do this next" — turns the booth-targeting numbers into a handful of concrete,
// prioritised actions with an expected vote yield. This is the prescriptive
// layer indiavotes.com can't match: not "what happened", but "what to do".

const PRIORITY = {
  high: { badge: 'border-rose-200 bg-rose-50 text-rose-800', accent: '#e11d48', label: 'High priority' },
  medium: { badge: 'border-amber-200 bg-amber-50 text-amber-800', accent: '#d97706', label: 'Medium priority' },
  low: { badge: 'border-slate-300 bg-white text-slate-600', accent: '#94a3b8', label: 'Low priority' },
};

export default function ActionPlan({ electionId, candidate }) {
  const targetsQ = useQuery({
    queryKey: ['booth-targets', electionId, candidate ?? ''],
    queryFn: () => api.boothTargets(electionId, candidate || undefined),
    enabled: !!electionId,
  });
  const gapQ = useQuery({
    queryKey: ['turnout-gap', electionId, candidate ?? ''],
    queryFn: () => api.turnoutGap(electionId, candidate || undefined),
    enabled: !!electionId,
  });

  const ourCandidate = targetsQ.data?.ourCandidate ?? candidate;
  const items = targetsQ.data?.items ?? [];
  const medianTurnout = targetsQ.data?.medianTurnout ?? 0;
  const gapItems = gapQ.data?.items ?? [];

  const cards = useMemo(() => {
    if (!items.length) return [];
    const out = [];

    // 1) Flip — swing / recoverable booths, closest first.
    const flip = items
      .filter((b) => b.classification === 'Swing' || b.classification === 'Marginal-loss')
      .sort((a, b) => b.margin - a.margin);
    if (flip.length) {
      const votesNeeded = flip.reduce(
        (s, b) => s + Math.max((b.topOpponentShare - b.ourShare) * b.totalValid, 0) + 1,
        0,
      );
      const closest = flip[0]?.margin ?? -1;
      out.push({
        id: 'flip',
        priority: closest > -0.05 ? 'high' : 'medium',
        title: 'Flip these swing booths',
        metric: `~${num(votesNeeded)} votes to flip all`,
        detail: `You're within reach in ${flip.length} ${flip.length === 1 ? 'booth' : 'booths'}. A focused persuasion push on a small number of voters turns each of these your way.`,
        booths: flip,
      });
    }

    // 2) GOTV — favourable booths that under-voted vs the median.
    if (gapItems.length) {
      const potential = gapItems.reduce(
        (s, b) => s + b.registeredVoters * Math.max(medianTurnout - b.turnoutPct, 0) * b.ourShare,
        0,
      );
      out.push({
        id: 'gotv',
        priority: potential > 500 ? 'high' : 'medium',
        title: 'Get your voters out (GOTV)',
        metric: `up to ~${num(Math.round(potential))} extra votes`,
        detail: `${gapItems.length} ${gapItems.length === 1 ? 'booth' : 'booths'} favour you but turned out below the ${pct(medianTurnout)} median. Driving turnout here banks votes cheaply — you already lead these booths.`,
        booths: gapItems,
      });
    }

    // 3) Defend — narrow wins at risk.
    const defend = items
      .filter((b) => b.classification === 'Marginal-win')
      .sort((a, b) => a.margin - b.margin);
    if (defend.length) {
      out.push({
        id: 'defend',
        priority: 'medium',
        title: 'Defend narrow wins',
        metric: `${defend.length} at risk`,
        detail: `You won ${defend.length} ${defend.length === 1 ? 'booth' : 'booths'} by a thin margin. Hold them — a small slip here costs you seats.`,
        booths: defend,
      });
    }

    // 4) Consolidate — strongholds (informational, keep morale/turnout up).
    const safe = items.filter((b) => b.classification === 'Safe-win');
    if (safe.length) {
      out.push({
        id: 'consolidate',
        priority: 'low',
        title: 'Consolidate strongholds',
        metric: `${safe.length} safe`,
        detail: `${safe.length} ${safe.length === 1 ? 'booth is' : 'booths are'} solidly yours. Maintain contact and keep turnout high — don't over-spend here.`,
        booths: safe,
      });
    }

    return out;
  }, [items, gapItems, medianTurnout]);

  return (
    <Surface
      eyebrow="Do this next"
      title="Your action plan"
      subtitle={ourCandidate ? `Prioritised, booth-level moves for ${ourCandidate} — with the votes each could add.` : 'Prioritised, booth-level moves — with the votes each could add.'}
    >
      {(targetsQ.isPending || gapQ.isPending) && <Loading className="h-40" />}
      {targetsQ.isError && <ErrorBox message={targetsQ.error.message} onRetry={() => targetsQ.refetch()} />}

      {targetsQ.data && cards.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No booth-level Form 20 data yet, or every booth is already safe — nothing to act on here.
        </p>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {cards.map((card) => (
            <ActionCard key={card.id} card={card} electionId={electionId} />
          ))}
        </div>
      )}
    </Surface>
  );
}

function ActionCard({ card, electionId }) {
  const p = PRIORITY[card.priority] ?? PRIORITY.low;
  return (
    <div className="flex border border-slate-200 bg-white">
      <span className="w-1 shrink-0" style={{ background: p.accent }} aria-hidden="true" />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{card.title}</h4>
          <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-medium ${p.badge}`}>{p.label}</span>
        </div>
        <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{card.metric}</div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{card.detail}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.booths.slice(0, 8).map((b) => (
            <Link
              key={b.id}
              to={`/elections/${electionId}/booth/${b.id}`}
              className="border border-slate-200 bg-[#fbfaf7] px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:border-accent-300 hover:text-accent-700"
              title={b.name ?? ''}
            >
              PS-{b.serial}
            </Link>
          ))}
          {card.booths.length > 8 && (
            <span className="px-1 py-0.5 text-xs text-slate-400">+{card.booths.length - 8} more</span>
          )}
        </div>
      </div>
    </div>
  );
}
