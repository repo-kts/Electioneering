// Booth-level recommendations. Given one polling station's Form 20 result,
// turnout, and voter-roll demographics — plus the election-wide turnout context
// — classifies the booth and produces 2–5 concrete, human-readable campaign
// actions (GOTV, consolidate stronghold, persuade swing community, first-time
// voter outreach, contain opposition strongholds, address NOTA dissatisfaction).

import { computeBoothTargets } from './boothAnalytics.js';
import type { SegmentAggregates } from './segmentation.js';

type Priority = 'high' | 'medium' | 'low';

export type BoothClassification =
  | 'Stronghold'
  | 'Swing'
  | 'Opposition-leaning'
  | 'Low-turnout'
  | 'No-data';

export interface BoothRecommendation {
  id: string;
  priority: Priority;
  title: string;
  detail: string;
}

export interface BoothRecommendationResult {
  classification: BoothClassification;
  priority: Priority;
  recommendations: BoothRecommendation[];
}

export interface BoothRecommendationInput {
  leader: { name: string; share: number } | null; // booth leader (0..1 share)
  runnerUp: { name: string; share: number } | null;
  totalValid: number;
  notaShare: number; // nota / total polled, 0..1
  demographics: SegmentAggregates;
  registered: number; // voters mapped to this booth
}

interface ClassifyContext extends BoothRecommendationInput {
  turnoutPct: number; // this booth (polled / registered)
  medianTurnoutPct: number; // election-wide median booth turnout
  electionLeader: string | null; // election overall leader ("our side")
}

function pct(n: number): string {
  return `${Math.round(Math.min(Math.max(n, 0), 1) * 100)}%`;
}

/**
 * Pure classification + recommendation logic. Kept separate from data loading so
 * the booth handler can feed it already-loaded numbers.
 */
export function buildBoothRecommendations(ctx: ClassifyContext): BoothRecommendationResult {
  const { leader, runnerUp, totalValid, notaShare, demographics, registered } = ctx;

  if (totalValid === 0 || !leader) {
    return {
      classification: 'No-data',
      priority: 'low',
      recommendations: [
        {
          id: 'no-data',
          priority: 'medium',
          title: 'Capture booth results',
          detail:
            'No Form 20 vote data is recorded for this booth. Enter the polling-station result to unlock targeting and turnout analysis.',
        },
        {
          id: 'map-voters',
          priority: 'low',
          title: 'Map the voter roll',
          detail:
            registered > 0
              ? `${registered.toLocaleString()} voter(s) are linked here — add results to correlate them with candidate leaning.`
              : 'Link this booth to its electoral-roll voters so demographics and turnout can be computed.',
        },
      ],
    };
  }

  const margin = leader.share - (runnerUp?.share ?? 0);
  const leaderIsOurs = ctx.electionLeader != null && leader.name === ctx.electionLeader;
  const median = ctx.medianTurnoutPct;
  const turnout = ctx.turnoutPct;
  // Turnout is polled/registered; values > ~1 mean the voter roll mapped to this
  // booth is incomplete, so the comparison is unreliable — don't flag GOTV then.
  const turnoutReliable = turnout > 0 && turnout <= 1.05 && median > 0 && median <= 1.05;
  const lowTurnout = turnoutReliable && turnout < median * 0.85;

  // ── Classification (single label) ──────────────────────────────────────
  let classification: BoothClassification;
  let priority: Priority;
  if (lowTurnout) {
    classification = 'Low-turnout';
    priority = 'high';
  } else if (margin < 0.1) {
    classification = 'Swing';
    priority = 'high';
  } else if (leaderIsOurs) {
    classification = 'Stronghold';
    priority = 'low';
  } else {
    classification = 'Opposition-leaning';
    priority = 'medium';
  }

  // ── Recommendations (ranked, capped at 5) ──────────────────────────────
  const recs: BoothRecommendation[] = [];

  if (lowTurnout) {
    recs.push({
      id: 'gotv',
      priority: 'high',
      title: 'Run a get-out-the-vote drive',
      detail: `Turnout here (${pct(turnout)}) trails the constituency median (${pct(
        median,
      )}). Mobilise ${registered.toLocaleString()} registered voter(s) with reminders and polling-day transport.`,
    });
  }

  if (margin < 0.1 && !leaderIsOurs) {
    recs.push({
      id: 'persuade-swing',
      priority: 'high',
      title: 'Persuade this swing booth',
      detail: `Only ${pct(margin)} separates ${leader.name} from ${
        runnerUp?.name ?? 'the runner-up'
      }. Concentrate canvassing and local issues here — it is winnable.`,
    });
  } else if (margin < 0.1 && leaderIsOurs) {
    recs.push({
      id: 'defend-narrow',
      priority: 'high',
      title: 'Defend a narrow lead',
      detail: `Lead of just ${pct(margin)} over ${
        runnerUp?.name ?? 'the runner-up'
      }. Keep workers active through polling day to avoid slippage.`,
    });
  } else if (leaderIsOurs) {
    recs.push({
      id: 'consolidate',
      priority: 'medium',
      title: 'Consolidate the stronghold',
      detail: `${leader.name} leads by ${pct(
        margin,
      )} (${pct(leader.share)} share). Protect turnout and use committed supporters here to volunteer elsewhere.`,
    });
  } else {
    recs.push({
      id: 'contain-opposition',
      priority: 'medium',
      title: 'Contain an opposition-leaning booth',
      detail: `${leader.name} leads by ${pct(
        margin,
      )}. Limit spend to defensive presence and identify persuadable pockets rather than over-investing.`,
    });
  }

  // Dominant-community targeting (skip the "unknown" bucket).
  const topCommunity = demographics.byCommunity.find((c) => c.key && c.key !== '—');
  if (topCommunity && registered > 0) {
    const shareOfRoll = topCommunity.count / registered;
    if (shareOfRoll >= 0.25) {
      recs.push({
        id: 'community-outreach',
        priority: shareOfRoll >= 0.5 ? 'high' : 'medium',
        title: `Engage the ${topCommunity.key} community`,
        detail: `${topCommunity.key} voters are ${pct(shareOfRoll)} of this booth's roll (${topCommunity.count.toLocaleString()} voters). Tailor outreach and messaging to their concerns.`,
      });
    }
  }

  // First-time / young-voter outreach.
  if (demographics.firstTimeVoters > 0 && registered > 0) {
    const share = demographics.firstTimeVoters / registered;
    if (share >= 0.03) {
      recs.push({
        id: 'first-time-voters',
        priority: 'medium',
        title: 'Reach first-time voters',
        detail: `${demographics.firstTimeVoters.toLocaleString()} first-time voter(s) (${pct(
          share,
        )} of the roll) are here — register, inform, and follow up with them early.`,
      });
    }
  }

  // NOTA dissatisfaction signal.
  if (notaShare >= 0.03) {
    recs.push({
      id: 'nota',
      priority: 'medium',
      title: 'Address voter dissatisfaction',
      detail: `NOTA is ${pct(
        notaShare,
      )} of votes polled here — unusually high. Investigate local grievances that are pushing voters away from every candidate.`,
    });
  }

  // Guarantee at least two recommendations.
  if (recs.length < 2) {
    recs.push({
      id: 'canvass',
      priority: 'low',
      title: 'Maintain booth-level canvassing',
      detail:
        'Keep a booth agent and door-to-door contact active to hold the current position and catch any late movement.',
    });
  }

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  return { classification, priority, recommendations: recs.slice(0, 5) };
}

/**
 * Loads the election-wide turnout context (median booth turnout + this booth's
 * turnout, both polled/registered) and returns the classification +
 * recommendations for one polling station.
 */
export async function computeBoothRecommendations(
  electionId: number,
  psId: number,
  input: BoothRecommendationInput,
): Promise<BoothRecommendationResult> {
  const targets = await computeBoothTargets(electionId);
  const me = targets.items.find((i) => i.id === psId);
  return buildBoothRecommendations({
    ...input,
    turnoutPct: me?.turnoutPct ?? 0,
    medianTurnoutPct: targets.medianTurnout,
    electionLeader: targets.ourCandidate || null,
  });
}
