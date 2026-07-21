// Single physical polling station ("booth") across every election it took part
// in. `buildBoothDetail` is the per-election read (extracted verbatim from the
// GET /booth/:boothId route so both share one code path); `buildStationHistory`
// stitches all of a PollingStation's booths into one cross-election bundle for
// the booth-wise analytics page (blended timeline + all-years demographics).

import { prisma } from '../lib/prisma.js';
import { aggregate, attachElectionFields } from './segmentation.js';
import { computeBoothRecommendations } from './boothRecommendations.js';

/** Everything about one booth for one election (candidate votes+share, turnout,
 *  roll demographics, classification/recommendations, voter sample). */
export async function buildBoothDetail(boothId: number) {
  const booth = await prisma.booth.findUnique({
    where: { id: boothId },
    include: {
      election: true,
      pollingStation: true,
      voteResults: { include: { candidate: true } },
    },
  });
  if (!booth) return null;
  const ps = booth.pollingStation;

  let totalValid = 0;
  for (const vr of booth.voteResults) totalValid += vr.votes;
  const candidates = booth.voteResults
    .map((vr) => ({
      id: vr.candidateId,
      name: vr.candidate.name,
      party: vr.candidate.party,
      alliance: vr.candidate.alliance,
      votes: vr.votes,
      share: totalValid > 0 ? vr.votes / totalValid : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const roll = await prisma.boothVoter.findMany({
    where: { boothId },
    orderBy: [{ houseNumber: 'asc' }],
    include: { voter: true },
  });
  const voters = attachElectionFields(
    roll.map((bv) => ({ ...bv.voter, boothVoters: [{ ...bv, booth }] })),
    booth.electionId,
  );
  const registered = roll.length;
  const voted = roll.reduce((n, bv) => n + (bv.voted ? 1 : 0), 0);

  const totalPolled = totalValid + booth.rejectedVotes + booth.notaVotes;
  const leader = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  const demographics = aggregate(voters);

  const reco = await computeBoothRecommendations(booth.electionId, booth.id, {
    leader: leader ? { name: leader.name, share: leader.share } : null,
    runnerUp: runnerUp ? { name: runnerUp.name, share: runnerUp.share } : null,
    totalValid,
    notaShare: totalPolled > 0 ? booth.notaVotes / totalPolled : 0,
    demographics,
    registered,
  });

  return {
    election: {
      id: booth.election.id,
      assemblyNo: booth.election.assemblyNo,
      assemblyName: booth.election.assemblyName,
      assemblySeatType: booth.election.assemblySeatType,
      parlNo: booth.election.parlNo,
      parlName: booth.election.parlName,
      parlSeatType: booth.election.parlSeatType,
      state: booth.election.state,
      electionType: booth.election.electionType,
      electionYear: booth.election.electionYear,
    },
    ps: {
      id: booth.id,
      pollingStationId: booth.pollingStationId,
      serial: booth.serial,
      name: booth.name ?? ps?.name ?? null,
      address: ps?.address ?? null,
      cityVillage: ps?.cityVillage ?? null,
      ward: ps?.ward ?? null,
      tolaMohalla: ps?.tolaMohalla ?? null,
      postOffice: ps?.postOffice ?? null,
      policeStation: ps?.policeStation ?? null,
      latitude: ps?.latitude ?? null,
      longitude: ps?.longitude ?? null,
      rejectedVotes: booth.rejectedVotes,
      notaVotes: booth.notaVotes,
      tenderedVotes: booth.tenderedVotes,
    },
    candidates,
    leader,
    runnerUp,
    totalValid,
    totalPolled,
    turnout: {
      registered,
      voted,
      pct: registered > 0 ? voted / registered : 0,
    },
    classification: reco.classification,
    priority: reco.priority,
    recommendations: reco.recommendations,
    demographics,
    voters: roll.slice(0, 500).map((bv) => ({
      id: bv.voter.id,
      fullName: bv.voter.fullName,
      firstName: bv.voter.firstName,
      lastName: bv.voter.lastName,
      age: bv.voter.age,
      gender: bv.voter.gender,
      religion: bv.voter.religion,
      caste: bv.voter.caste,
      community: bv.voter.community,
      category: bv.voter.category,
      houseNumber: bv.houseNumber,
      epic: bv.voter.epic,
      relationType: bv.voter.relationType,
      relativeName: bv.voter.relativeName,
    })),
  };
}

export type BoothDetail = NonNullable<Awaited<ReturnType<typeof buildBoothDetail>>>;

/** All elections held at one physical polling station, stitched into a single
 *  cross-election bundle: per-election detail + a blended chronological timeline
 *  + all-years rollup + latest-roll demographics + vote-share-over-time. */
export async function buildStationHistory(psId: number) {
  const ps = await prisma.pollingStation.findUnique({ where: { id: psId } });
  if (!ps) return null;

  const booths = await prisma.booth.findMany({
    where: { pollingStationId: psId },
    include: { election: true },
  });
  if (booths.length === 0) {
    return {
      ps: { id: ps.id, name: ps.name, address: ps.address, latitude: ps.latitude, longitude: ps.longitude },
      constituency: { assemblyNo: ps.assemblyNo, assemblyName: ps.assemblyName, state: null, parlName: null },
      elections: [],
      timeline: [],
      byCandidateOverTime: [],
      candidateNames: [],
      aggregate: null,
      demographicsLatest: null,
    };
  }

  // Per-election detail via the shared code path, newest election first.
  const details = (
    await Promise.all(booths.map((b) => buildBoothDetail(b.id)))
  ).filter((d): d is BoothDetail => d !== null);
  details.sort((a, b) => (b.election.electionYear ?? -Infinity) - (a.election.electionYear ?? -Infinity));

  const yearVal = (d: BoothDetail) => d.election.electionYear ?? 0;
  // Turnout from Form 20 (votes polled / roll size). The per-voter `voted` flag
  // (d.turnout.pct) is often un-imported and reads 0, so trend charts must use
  // the polled-vote figure to be meaningful.
  const polledTurnout = (d: BoothDetail) =>
    d.turnout.registered > 0 ? d.totalPolled / d.turnout.registered : 0;

  // Chronological (oldest → newest) timeline for trend charts.
  const chrono = [...details].sort((a, b) => yearVal(a) - yearVal(b));
  const timeline = chrono.map((d) => ({
    electionId: d.election.id,
    boothId: d.ps.id,
    year: d.election.electionYear,
    type: d.election.electionType,
    label: `${d.election.electionYear ?? '—'} · ${shortType(d.election.electionType)}`,
    turnoutPct: polledTurnout(d),
    registered: d.turnout.registered,
    voted: d.turnout.voted,
    winnerName: d.leader?.name ?? null,
    winnerParty: d.leader?.party ?? null,
    winShare: d.leader?.share ?? 0,
    runnerUpName: d.runnerUp?.name ?? null,
    runnerUpShare: d.runnerUp?.share ?? 0,
    margin: (d.leader?.share ?? 0) - (d.runnerUp?.share ?? 0),
    nota: d.ps.notaVotes,
    rejected: d.ps.rejectedVotes,
    notaShare: d.totalPolled > 0 ? d.ps.notaVotes / d.totalPolled : 0,
    totalValid: d.totalValid,
  }));

  // Vote-share-by-candidate over time (one row per election, share per candidate).
  const nameSet = new Set<string>();
  for (const d of chrono) for (const c of d.candidates) nameSet.add(c.name);
  const candidateNames = Array.from(nameSet);
  const byCandidateOverTime = chrono.map((d) => {
    const shares: Record<string, number> = {};
    for (const c of d.candidates) shares[c.name] = c.share;
    return {
      electionId: d.election.id,
      year: d.election.electionYear,
      type: d.election.electionType,
      label: `${d.election.electionYear ?? '—'} · ${shortType(d.election.electionType)}`,
      shares,
    };
  });

  // All-years rollup.
  const turnouts = timeline.map((t) => t.turnoutPct).filter((t) => t > 0);
  const winnerCounts = new Map<string, { count: number; party: string | null }>();
  for (const d of details) {
    if (!d.leader) continue;
    const e = winnerCounts.get(d.leader.name) ?? { count: 0, party: d.leader.party };
    e.count += 1;
    winnerCounts.set(d.leader.name, e);
  }
  const mostFrequent = Array.from(winnerCounts.entries()).sort((a, b) => b[1].count - a[1].count)[0] ?? null;
  const latest = details[0];

  const rollup = {
    electionsCount: details.length,
    years: chrono.map((d) => d.election.electionYear).filter((y): y is number => y != null),
    types: Array.from(new Set(details.map((d) => d.election.electionType))),
    avgTurnout: turnouts.length ? turnouts.reduce((s, t) => s + t, 0) / turnouts.length : 0,
    mostFrequentWinner: mostFrequent
      ? { name: mostFrequent[0], party: mostFrequent[1].party, times: mostFrequent[1].count }
      : null,
    latestWinner: latest.leader ? { name: latest.leader.name, party: latest.leader.party, share: latest.leader.share } : null,
    latestMargin: (latest.leader?.share ?? 0) - (latest.runnerUp?.share ?? 0),
    latestTurnout: polledTurnout(latest),
    registeredVoters: latest.turnout.registered,
  };

  return {
    ps: { id: ps.id, name: ps.name, address: ps.address, latitude: ps.latitude, longitude: ps.longitude },
    constituency: {
      assemblyNo: latest.election.assemblyNo,
      assemblyName: latest.election.assemblyName,
      state: latest.election.state,
      parlName: latest.election.parlName,
    },
    elections: details, // newest first; each is a full per-election booth read
    timeline, // oldest → newest, blended across types
    byCandidateOverTime,
    candidateNames,
    aggregate: rollup,
    demographicsLatest: latest.demographics,
  };
}

function shortType(t: string): string {
  if (/lok\s*sabha/i.test(t)) return 'LS';
  if (/assembly/i.test(t)) return 'AE';
  if (/by[-\s]?election/i.test(t)) return 'By';
  if (/panchayat/i.test(t)) return 'Panch';
  if (/municipal/i.test(t)) return 'Muni';
  return t;
}
