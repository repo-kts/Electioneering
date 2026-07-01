import { prisma } from '../lib/prisma.js';
import { computeBoothTargets, computeTurnoutGap, type BoothTarget } from './boothAnalytics.js';

type Priority = 'high' | 'medium' | 'low';

export interface StrategyBrief {
  election: {
    id: number;
    state: string;
    assemblyNo: string;
    assemblyName: string;
    electionType: string;
    electionYear: number | null;
  };
  candidate: string;
  summary: {
    booths: number;
    mappedVoters: number;
    medianTurnout: number;
    safeWin: number;
    marginalWin: number;
    swing: number;
    marginalLoss: number;
    safeLoss: number;
    noData: number;
  };
  plays: Array<{
    id: string;
    priority: Priority;
    title: string;
    metric: string;
    rationale: string;
    booths: Array<{
      id: number;
      serial: number;
      name: string | null;
      classification: BoothTarget['classification'];
      registeredVoters: number;
      turnoutPct: number;
      ourShare: number;
      margin: number;
      leader: string | null;
      topOpponent: string | null;
    }>;
  }>;
  recommendations: string[];
  dataQuality: Array<{ label: string; value: number; severity: Priority; note: string }>;
}

function pct(n: number) {
  return `${(Math.min(Math.max(n, -1), 1) * 100).toFixed(0)}%`;
}

function boothLite(b: BoothTarget) {
  return {
    id: b.id,
    serial: b.serial,
    name: b.name,
    classification: b.classification,
    registeredVoters: b.registeredVoters,
    turnoutPct: b.turnoutPct,
    ourShare: b.ourShare,
    margin: b.margin,
    leader: b.leader,
    topOpponent: b.topOpponent,
  };
}

export async function assembleStrategyBrief(
  electionId: number,
  requestedCandidate?: string,
): Promise<StrategyBrief> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    const err = new Error('Election not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  const targets = await computeBoothTargets(electionId, requestedCandidate);
  const gotv = await computeTurnoutGap(electionId, targets.ourCandidate);
  const s = targets.summary;

  const votersWhere = {
    assemblyNo: election.assemblyNo,
    assemblyName: election.assemblyName,
  };
  const [mappedVoters, votersMissingMobile, votersMissingHouse, votersMissingPs] = await Promise.all([
    prisma.voter.count({ where: votersWhere }),
    prisma.voter.count({ where: { ...votersWhere, OR: [{ mobile: null }, { mobile: '' }] } }),
    prisma.voter.count({ where: { ...votersWhere, OR: [{ houseNumber: null }, { houseNumber: '' }] } }),
    prisma.voter.count({ where: { ...votersWhere, pollingStationId: null } }),
  ]);

  const swing = targets.items
    .filter((b) => b.classification === 'Swing')
    .sort((a, b) => Math.abs(a.margin) - Math.abs(b.margin))
    .slice(0, 8);
  const defend = targets.items
    .filter((b) => b.classification === 'Marginal-win')
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 8);
  const contain = targets.items
    .filter((b) => b.classification === 'Marginal-loss')
    .sort((a, b) => Math.abs(a.margin) - Math.abs(b.margin))
    .slice(0, 8);
  const safeLoss = targets.items
    .filter((b) => b.classification === 'Safe-loss')
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 8);
  const mobilise = gotv.items.slice(0, 8);
  const dataGaps = targets.items
    .filter((b) => b.classification === 'No-data' || b.registeredVoters === 0)
    .slice(0, 8);

  const plays: StrategyBrief['plays'] = [
    {
      id: 'persuade-swing',
      priority: swing.length ? 'high' : 'low',
      title: 'Persuade swing booths',
      metric: `${s.Swing} booth${s.Swing === 1 ? '' : 's'}`,
      rationale: 'Booths within a 10-point deficit are the fastest path to changing the result.',
      booths: swing.map(boothLite),
    },
    {
      id: 'mobilise-turnout',
      priority: mobilise.length ? 'high' : 'low',
      title: 'Mobilise favorable low-turnout booths',
      metric: `${mobilise.length} booth${mobilise.length === 1 ? '' : 's'}`,
      rationale: `These booths are favorable or winnable but below the median turnout of ${pct(targets.medianTurnout)}.`,
      booths: mobilise.map(boothLite),
    },
    {
      id: 'defend-narrow-wins',
      priority: defend.length ? 'medium' : 'low',
      title: 'Defend narrow wins',
      metric: `${s['Marginal-win']} booth${s['Marginal-win'] === 1 ? '' : 's'}`,
      rationale: 'Small slippage here can erase current advantages; keep workers active through polling day.',
      booths: defend.map(boothLite),
    },
    {
      id: 'contain-losses',
      priority: contain.length ? 'medium' : 'low',
      title: 'Contain recoverable losses',
      metric: `${s['Marginal-loss']} booth${s['Marginal-loss'] === 1 ? '' : 's'}`,
      rationale: 'Do not over-invest in deep opposition strongholds; focus on narrowing recoverable deficits.',
      booths: contain.map(boothLite),
    },
    {
      id: 'limit-safe-losses',
      priority: 'low',
      title: 'Limit safe-loss spend',
      metric: `${s['Safe-loss']} booth${s['Safe-loss'] === 1 ? '' : 's'}`,
      rationale: 'These booths currently show deep deficits; hold basic presence and move scarce workers to closer booths.',
      booths: safeLoss.map(boothLite),
    },
    {
      id: 'fix-data-gaps',
      priority: dataGaps.length || votersMissingPs ? 'medium' : 'low',
      title: 'Fix booth data gaps',
      metric: `${dataGaps.length} booth${dataGaps.length === 1 ? '' : 's'}`,
      rationale: 'Strategy quality depends on mapped voter rolls and complete Form 20 booth results.',
      booths: dataGaps.map(boothLite),
    },
  ];

  const recommendations = [
    swing.length
      ? `Start field visits in ${swing.length} closest swing booth(s); keep messaging local and booth-specific.`
      : 'No swing booths detected from current Form 20 data.',
    mobilise.length
      ? `Run GOTV operations in ${mobilise.length} favorable low-turnout booth(s) before expanding persuasion work.`
      : 'No favorable low-turnout booth stands out from current turnout data.',
    defend.length
      ? `Assign senior workers to defend ${defend.length} narrow-win booth(s).`
      : 'Current narrow-win exposure is low.',
    contain.length
      ? `Treat ${contain.length} marginal-loss booth(s) as recoverable; set vote-gain targets booth by booth.`
      : 'No immediately recoverable loss booth detected.',
    safeLoss.length
      ? `${safeLoss.length} safe-loss booth(s) need containment only; do not treat them as primary persuasion targets.`
      : 'No deep-loss booth detected for the selected candidate.',
    votersMissingPs
      ? `${votersMissingPs.toLocaleString()} voter record(s) are not mapped to a polling station; fix this before final planning.`
      : 'Polling-station mapping is complete for the current voter scope.',
  ];

  const dataQuality: StrategyBrief['dataQuality'] = [
    {
      label: 'Voters mapped to constituency',
      value: mappedVoters,
      severity: mappedVoters ? 'low' : 'high',
      note: 'Base voter-roll size used for booth and household planning.',
    },
    {
      label: 'Missing polling-station link',
      value: votersMissingPs,
      severity: votersMissingPs > mappedVoters * 0.15 ? 'high' : votersMissingPs ? 'medium' : 'low',
      note: 'Unlinked voters weaken booth-level targeting and turnout planning.',
    },
    {
      label: 'Missing house number',
      value: votersMissingHouse,
      severity: votersMissingHouse > mappedVoters * 0.25 ? 'medium' : 'low',
      note: 'Household grouping needs house numbers from the voter roll.',
    },
    {
      label: 'Missing mobile',
      value: votersMissingMobile,
      severity: votersMissingMobile > mappedVoters * 0.5 ? 'medium' : 'low',
      note: 'Contact coverage for lawful outreach and volunteer follow-up.',
    },
  ];

  return {
    election: {
      id: election.id,
      state: election.state,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
      electionType: election.electionType,
      electionYear: election.electionYear,
    },
    candidate: targets.ourCandidate,
    summary: {
      booths: targets.items.length,
      mappedVoters,
      medianTurnout: targets.medianTurnout,
      safeWin: s['Safe-win'],
      marginalWin: s['Marginal-win'],
      swing: s.Swing,
      marginalLoss: s['Marginal-loss'],
      safeLoss: s['Safe-loss'],
      noData: s['No-data'],
    },
    plays,
    recommendations,
    dataQuality,
  };
}
