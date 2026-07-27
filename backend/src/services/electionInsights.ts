// Election-level insight aggregates that power the party breakdown, the
// per-assembly timeline (year-over-year results), and the elections hierarchy
// tree (type → year → constituency). All numbers are real, derived from the
// Form 20 VoteResult grid + PollingStation reject/NOTA tallies.

import { prisma } from '../lib/prisma.js';
import { computeBoothLeanings } from './inference.js';

interface CandidateTotal {
  id: number;
  name: string;
  party: string | null;
  alliance: string | null;
  votes: number;
  share: number; // votes / totalValid
}

/**
 * Per-candidate vote totals for an election (includes zero-vote candidates),
 * sorted by votes desc, with each candidate's share of total valid votes.
 */
async function loadCandidateTotals(
  electionId: number,
): Promise<{ candidates: CandidateTotal[]; totalValid: number }> {
  const cands = await prisma.candidate.findMany({
    where: { electionId },
    orderBy: { position: 'asc' },
  });
  const sums = await prisma.voteResult.groupBy({
    by: ['candidateId'],
    where: { candidate: { electionId } },
    _sum: { votes: true },
  });
  const sumById = new Map(sums.map((s) => [s.candidateId, s._sum.votes ?? 0]));

  let totalValid = 0;
  const withVotes = cands.map((c) => {
    const votes = sumById.get(c.id) ?? 0;
    totalValid += votes;
    return { id: c.id, name: c.name, party: c.party, alliance: c.alliance, votes };
  });
  const candidates: CandidateTotal[] = withVotes
    .map((c) => ({ ...c, share: totalValid > 0 ? c.votes / totalValid : 0 }))
    .sort((a, b) => b.votes - a.votes);
  return { candidates, totalValid };
}

function partyKey(party: string | null | undefined): string {
  const p = party?.trim();
  return p && p.length ? p : 'Independent';
}
function allianceKey(alliance: string | null | undefined): string {
  const a = alliance?.trim();
  return a && a.length ? a : 'Unaligned';
}

// ─── 1. Party analytics ───────────────────────────────────────────────────
export interface PartyAnalyticsResult {
  election: {
    id: number;
    assemblyNo: string;
    assemblyName: string;
    electionType: string;
    electionYear: number | null;
  };
  totalValid: number;
  parties: Array<{
    party: string;
    votes: number;
    share: number;
    candidateCount: number;
    boothsLed: number;
    topCandidate: { name: string; votes: number } | null;
  }>;
  alliances: Array<{
    alliance: string;
    votes: number;
    share: number;
    partyCount: number;
    topParty: string | null;
  }>;
}

export async function computePartyAnalytics(electionId: number): Promise<PartyAnalyticsResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    const err = new Error('Election not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  const { candidates, totalValid } = await loadCandidateTotals(electionId);

  // Booths led per party — from per-PS leaders (matched by candidate name).
  const nameToParty = new Map(candidates.map((c) => [c.name, partyKey(c.party)]));
  const leanings = await computeBoothLeanings(electionId);
  const boothsLed = new Map<string, number>();
  for (const lean of leanings.values()) {
    if (!lean.leader || lean.totalValid === 0) continue;
    const key = nameToParty.get(lean.leader) ?? 'Independent';
    boothsLed.set(key, (boothsLed.get(key) ?? 0) + 1);
  }

  // Aggregate candidates into parties.
  const agg = new Map<
    string,
    { votes: number; candidateCount: number; top: { name: string; votes: number } | null }
  >();
  for (const c of candidates) {
    const key = partyKey(c.party);
    const e = agg.get(key) ?? { votes: 0, candidateCount: 0, top: null };
    e.votes += c.votes;
    e.candidateCount += 1;
    if (!e.top || c.votes > e.top.votes) e.top = { name: c.name, votes: c.votes };
    agg.set(key, e);
  }

  const parties = Array.from(agg.entries())
    .map(([party, e]) => ({
      party,
      votes: e.votes,
      share: totalValid > 0 ? e.votes / totalValid : 0,
      candidateCount: e.candidateCount,
      boothsLed: boothsLed.get(party) ?? 0,
      topCandidate: e.top,
    }))
    .sort((a, b) => b.votes - a.votes);

  // Aggregate candidates into alliances (a party's votes flow to its alliance).
  const allianceAgg = new Map<string, { votes: number; parties: Set<string>; topParty: string | null; topVotes: number }>();
  for (const c of candidates) {
    const key = allianceKey(c.alliance);
    const e = allianceAgg.get(key) ?? { votes: 0, parties: new Set<string>(), topParty: null, topVotes: -1 };
    e.votes += c.votes;
    e.parties.add(partyKey(c.party));
    if (c.votes > e.topVotes) { e.topVotes = c.votes; e.topParty = partyKey(c.party); }
    allianceAgg.set(key, e);
  }
  const alliances = Array.from(allianceAgg.entries())
    .map(([alliance, e]) => ({
      alliance,
      votes: e.votes,
      share: totalValid > 0 ? e.votes / totalValid : 0,
      partyCount: e.parties.size,
      topParty: e.topParty,
    }))
    .sort((a, b) => b.votes - a.votes);

  return {
    election: {
      id: election.id,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
      electionType: election.electionType,
      electionYear: election.electionYear,
    },
    totalValid,
    parties,
    alliances,
  };
}

// ─── 2. Assembly timeline (year-over-year) ─────────────────────────────────
export interface AssemblyTimelineResult {
  assembly: { assemblyNo: string | null; assemblyName: string | null; state: string | null };
  elections: Array<{
    electionId: number;
    electionYear: number | null;
    electionType: string;
    totalElectors: number | null;
    turnout: { voted: number; registered: number | null; pct: number };
    totalValid: number;
    winner: { name: string; party: string | null; alliance: string | null; votes: number; share: number } | null;
    runnerUp: { name: string; party: string | null; alliance: string | null; votes: number; share: number } | null;
    margin: number;
    winnerParty: string | null;
    winnerAlliance: string | null;
    nota: number;
    notaShare: number; // nota / total polled
  }>;
}

export async function computeAssemblyTimeline(opts: {
  assemblyNo?: string;
  assemblyName?: string;
  electionType?: string;
  limit?: number;
}): Promise<AssemblyTimelineResult> {
  const where: { assemblyNo?: string; assemblyName?: string; electionType?: string } = {};
  if (opts.assemblyNo) where.assemblyNo = opts.assemblyNo;
  if (opts.assemblyName) where.assemblyName = opts.assemblyName;
  if (opts.electionType) where.electionType = opts.electionType;

  const rows = await prisma.election.findMany({
    where,
    orderBy: { electionYear: 'desc' },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const first = rows[0] ?? null;
  const elections = await Promise.all(
    rows.map(async (e) => {
      const { candidates, totalValid } = await loadCandidateTotals(e.id);
      const psAgg = await prisma.booth.aggregate({
        where: { electionId: e.id },
        _sum: { rejectedVotes: true, notaVotes: true },
      });
      const rejected = psAgg._sum.rejectedVotes ?? 0;
      const nota = psAgg._sum.notaVotes ?? 0;
      const voted = totalValid + rejected + nota; // total polled
      const registered = e.totalElectors;
      const winner = candidates[0] ?? null;
      const runnerUp = candidates[1] ?? null;
      return {
        electionId: e.id,
        electionYear: e.electionYear,
        electionType: e.electionType,
        totalElectors: e.totalElectors,
        turnout: {
          voted,
          registered,
          pct: registered && registered > 0 ? voted / registered : 0,
        },
        totalValid,
        winner: winner
          ? { name: winner.name, party: winner.party, alliance: winner.alliance, votes: winner.votes, share: winner.share }
          : null,
        runnerUp: runnerUp
          ? {
              name: runnerUp.name,
              party: runnerUp.party,
              alliance: runnerUp.alliance,
              votes: runnerUp.votes,
              share: runnerUp.share,
            }
          : null,
        margin: (winner?.votes ?? 0) - (runnerUp?.votes ?? 0),
        winnerParty: winner?.party ?? null,
        winnerAlliance: winner?.alliance ?? null,
        nota,
        notaShare: voted > 0 ? nota / voted : 0,
      };
    }),
  );

  return {
    assembly: {
      assemblyNo: first?.assemblyNo ?? opts.assemblyNo ?? null,
      assemblyName: first?.assemblyName ?? opts.assemblyName ?? null,
      state: first?.state ?? null,
    },
    elections,
  };
}

// ─── 2b. Party vote-share timeline (party × year) ──────────────────────────
// Powers the constituency "Party vote-share over time" stacked chart: one row
// per election year, each carrying that year's per-party vote totals. `parties`
// is the union of parties across all years, ranked by total votes (stable
// series order + Top-N folding on the client).
export interface PartyShareTimelineResult {
  assembly: { assemblyNo: string | null; assemblyName: string | null; state: string | null };
  parties: string[];
  years: Array<{
    electionId: number;
    electionYear: number | null;
    electionType: string;
    totalValid: number;
    byParty: Record<string, number>;
  }>;
}

export async function computePartyShareTimeline(opts: {
  assemblyNo?: string;
  assemblyName?: string;
  electionType?: string;
}): Promise<PartyShareTimelineResult> {
  // The election page is anchored to a single electionType; scope to it so
  // Assembly and Lok Sabha elections (which can share an assemblyNo/Name) are
  // not compared on one axis.
  const where: { assemblyNo?: string; assemblyName?: string; electionType?: string } = {};
  if (opts.assemblyNo) where.assemblyNo = opts.assemblyNo;
  if (opts.assemblyName) where.assemblyName = opts.assemblyName;
  if (opts.electionType) where.electionType = opts.electionType;

  const rows = await prisma.election.findMany({
    where,
    orderBy: { electionYear: 'desc' },
  });
  const first = rows[0] ?? null;

  const totals = new Map<string, number>(); // party -> votes across all years
  const years = await Promise.all(
    rows.map(async (e) => {
      const { candidates, totalValid } = await loadCandidateTotals(e.id);
      const byParty: Record<string, number> = {};
      for (const c of candidates) {
        const key = partyKey(c.party);
        byParty[key] = (byParty[key] ?? 0) + c.votes;
        totals.set(key, (totals.get(key) ?? 0) + c.votes);
      }
      return {
        electionId: e.id,
        electionYear: e.electionYear,
        electionType: e.electionType,
        totalValid,
        byParty,
      };
    }),
  );

  const parties = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([party]) => party);

  return {
    assembly: {
      assemblyNo: first?.assemblyNo ?? opts.assemblyNo ?? null,
      assemblyName: first?.assemblyName ?? opts.assemblyName ?? null,
      state: first?.state ?? null,
    },
    parties,
    years,
  };
}

// ─── 3. Elections hierarchy (type → constituency, years nested per row) ─────
export interface HierarchyYear {
  electionId: number;
  year: number | null;
  electionType: string;
  totalElectors: number | null;
  pollingStations: number;
  winner: { name: string; party: string | null; share: number } | null;
}

export interface HierarchyConstituency {
  key: string;
  assemblyNo: string;
  assemblyName: string;
  state: string;
  parlName: string;
  latestElectionId: number; // link target (most recent year)
  yearCount: number;
  totalElectors: number | null; // latest year's electors
  pollingStations: number; // latest year
  winner: { name: string; party: string | null; share: number } | null; // latest year
  years: HierarchyYear[]; // newest first
}

export interface ElectionsHierarchyResult {
  types: Array<{
    electionType: string;
    constituencyCount: number;
    yearCount: number;
    totalElectors: number;
    constituencies: HierarchyConstituency[];
  }>;
}

// ─── 4. Constituency rollups (one row per assembly, merged across types) ────
// Powers the "Booth wise election" landing: unlike the hierarchy (which splits
// by electionType), this collapses every election of an assembly into a single
// constituency entry keyed on assemblyNo::assemblyName.
export interface ConstituencyRollup {
  key: string;
  state: string;
  parlNo: string;
  parlName: string;
  assemblyNo: string;
  assemblyName: string;
  electionCount: number;
  years: number[]; // distinct, newest first
  types: string[]; // distinct election types present
  distinctBooths: number; // distinct physical polling stations across all its elections
  totalElectors: number | null; // latest election
  latestElectionId: number;
  winner: { name: string; party: string | null; share: number } | null; // latest election
}

export async function computeConstituencyRollups(): Promise<{ constituencies: ConstituencyRollup[] }> {
  const elections = await prisma.election.findMany({
    orderBy: [{ assemblyName: 'asc' }, { electionYear: 'desc' }],
  });

  const byKey = new Map<string, typeof elections>();
  for (const e of elections) {
    const key = `${e.assemblyNo}::${e.assemblyName}`;
    const arr = byKey.get(key) ?? [];
    arr.push(e);
    byKey.set(key, arr);
  }

  const constituencies = await Promise.all(
    Array.from(byKey.entries()).map(async ([key, rows]) => {
      // Latest by electionYear (nulls last).
      const latest = [...rows].sort(
        (a, b) => (b.electionYear ?? -Infinity) - (a.electionYear ?? -Infinity),
      )[0];
      const ids = rows.map((r) => r.id);
      const distinctPs = await prisma.booth.findMany({
        where: { electionId: { in: ids } },
        select: { pollingStationId: true },
        distinct: ['pollingStationId'],
      });
      const { candidates } = await loadCandidateTotals(latest.id);
      const w = candidates[0] ?? null;
      const years = Array.from(
        new Set(rows.map((r) => r.electionYear).filter((y): y is number => y != null)),
      ).sort((a, b) => b - a);
      const types = Array.from(new Set(rows.map((r) => r.electionType)));
      return {
        key,
        state: latest.state,
        parlNo: latest.parlNo,
        parlName: latest.parlName,
        assemblyNo: latest.assemblyNo,
        assemblyName: latest.assemblyName,
        electionCount: rows.length,
        years,
        types,
        distinctBooths: distinctPs.length,
        totalElectors: latest.totalElectors,
        latestElectionId: latest.id,
        winner: w ? { name: w.name, party: w.party, share: w.share } : null,
      };
    }),
  );

  constituencies.sort((a, b) => a.assemblyName.localeCompare(b.assemblyName));
  return { constituencies };
}

// ─── 5. Constituency booths (distinct physical booths across all elections) ──
// One row per physical booth (building + wing) used anywhere in the constituency,
// with its latest-election headline result + turnout and an all-elections average.
// A booth's identity is its serial-stripped name, so two booths sharing a
// building stay separate and the same booth stays one across renumbered years.
export interface ConstituencyBooth {
  id: number; // pollingStationId (the stable per-booth identity across years)
  name: string | null;
  serial: number; // latest election's serial
  latitude: number | null;
  longitude: number | null;
  electionsCount: number;
  registeredVoters: number; // latest election
  totalValid: number; // latest election
  leader: string | null;
  leaderParty: string | null; // leading candidate's party (latest election)
  leaderShare: number;
  runnerUp: string | null;
  runnerUpParty: string | null; // runner-up candidate's party (latest election)
  runnerUpShare: number;
  margin: number; // leaderShare - runnerUpShare
  turnoutPct: number; // latest election
  avgTurnout: number; // mean across the PS's elections
  byParty: Record<string, number>; // party → vote share (0..1), latest election
  // Full per-election history for this booth (all elections, newest first) —
  // powers the all-years treemap. Independent of any year/type filter.
  elections: {
    year: number | null;
    electionType: string;
    votes: number;
    leader: string | null;
    leaderParty: string | null;
    leaderShare: number;
    margin: number;
    turnoutPct: number;
  }[];
}

function topTwo(byCandidate: Record<string, number>): {
  leader: string | null;
  leaderShare: number;
  runnerUp: string | null;
  runnerUpShare: number;
} {
  const sorted = Object.entries(byCandidate).sort((a, b) => b[1] - a[1]);
  return {
    leader: sorted[0]?.[0] ?? null,
    leaderShare: sorted[0]?.[1] ?? 0,
    runnerUp: sorted[1]?.[0] ?? null,
    runnerUpShare: sorted[1]?.[1] ?? 0,
  };
}

export async function computeConstituencyBooths(opts: {
  assemblyNo?: string;
  assemblyName?: string;
  electionYear?: number;
  electionType?: string;
}): Promise<{
  constituency: { assemblyNo: string | null; assemblyName: string | null; state: string | null; parlName: string | null };
  // Distinct year/type options across ALL of the constituency's elections, so the
  // UI can offer filters even while `items` reflects only the selected election(s).
  elections: { year: number | null; electionType: string }[];
  items: ConstituencyBooth[];
}> {
  const where: { assemblyNo?: string; assemblyName?: string } = {};
  if (opts.assemblyNo) where.assemblyNo = opts.assemblyNo;
  if (opts.assemblyName) where.assemblyName = opts.assemblyName;

  const allElections = await prisma.election.findMany({
    where,
    orderBy: { electionYear: 'desc' },
  });

  // Filter options (unfiltered list) — newest first, deduped by type+year.
  const optionSeen = new Set<string>();
  const electionOptions: { year: number | null; electionType: string }[] = [];
  for (const e of allElections) {
    const key = `${e.electionType}::${e.electionYear ?? ''}`;
    if (!optionSeen.has(key)) {
      optionSeen.add(key);
      electionOptions.push({ year: e.electionYear ?? null, electionType: e.electionType });
    }
  }

  // Narrow to the selected year/type (if any) for the booth rollup below.
  const elections = allElections.filter(
    (e) =>
      (opts.electionYear == null || e.electionYear === opts.electionYear) &&
      (opts.electionType == null || e.electionType === opts.electionType),
  );

  const first = allElections[0] ?? null; // constituency metadata (filter-independent)
  const yearById = new Map(allElections.map((e) => [e.id, e.electionYear ?? -Infinity]));
  const electionById = new Map(allElections.map((e) => [e.id, e]));
  // Elections that pass the year/type filter — used to pick each booth's headline.
  const filteredIds = new Set(elections.map((e) => e.id));

  // Booth leanings + booths + candidates cover ALL elections, so each booth's
  // per-election history is complete regardless of the year/type filter.
  const leaningByElection = new Map<number, Awaited<ReturnType<typeof computeBoothLeanings>>>();
  await Promise.all(
    allElections.map(async (e) => {
      leaningByElection.set(e.id, await computeBoothLeanings(e.id));
    }),
  );

  const booths = await prisma.booth.findMany({
    where: { electionId: { in: allElections.map((e) => e.id) } },
    include: { pollingStation: true, _count: { select: { boothVoters: true } } },
  });

  // Candidate name → party, keyed per election (leanings are keyed by name only).
  const candidates = await prisma.candidate.findMany({
    where: { electionId: { in: allElections.map((e) => e.id) } },
    select: { electionId: true, name: true, party: true },
  });
  const nameToParty = new Map(candidates.map((c) => [`${c.electionId}::${c.name}`, c.party]));
  const partyOf = (electionId: number, name: string | null) =>
    name ? nameToParty.get(`${electionId}::${name}`) ?? null : null;

  // Group by physical polling station.
  const byPs = new Map<number, typeof booths>();
  for (const b of booths) {
    const arr = byPs.get(b.pollingStationId) ?? [];
    arr.push(b);
    byPs.set(b.pollingStationId, arr);
  }

  // Per-booth per-election record (for the all-years views). Newest first.
  const historyOf = (group: typeof booths) =>
    [...group]
      .sort((a, b) => (yearById.get(b.electionId) ?? -Infinity) - (yearById.get(a.electionId) ?? -Infinity))
      .map((b) => {
        const l = leaningByElection.get(b.electionId)?.get(b.id);
        const t = topTwo(l?.byCandidate ?? {});
        const votes = l?.totalValid ?? 0;
        const polled = votes + b.rejectedVotes + b.notaVotes;
        const reg = b._count.boothVoters;
        const e = electionById.get(b.electionId);
        return {
          year: e?.electionYear ?? null,
          electionType: e?.electionType ?? '',
          votes,
          leader: t.leader,
          leaderParty: partyOf(b.electionId, t.leader),
          leaderShare: t.leaderShare,
          margin: t.leaderShare - t.runnerUpShare,
          turnoutPct: reg > 0 ? polled / reg : 0,
        };
      });

  const items: ConstituencyBooth[] = Array.from(byPs.entries())
    .map(([psId, group]): ConstituencyBooth | null => {
    // Headline = the group's most recent election that passes the filter. A PS
    // with no booth in the filtered set didn't run then, so it's dropped.
    const sorted = [...group]
      .filter((b) => filteredIds.has(b.electionId))
      .sort(
        (a, b) => (yearById.get(b.electionId) ?? -Infinity) - (yearById.get(a.electionId) ?? -Infinity),
      );
    const head = sorted[0];
    if (!head) return null;
    const lean = leaningByElection.get(head.electionId)?.get(head.id);
    const tops = topTwo(lean?.byCandidate ?? {});
    const totalValid = lean?.totalValid ?? 0;

    // Roll the headline election's per-candidate shares up to per-party shares.
    const byParty: Record<string, number> = {};
    for (const [cand, share] of Object.entries(lean?.byCandidate ?? {})) {
      const party = partyOf(head.electionId, cand) ?? cand;
      byParty[party] = (byParty[party] ?? 0) + share;
    }
    const registered = head._count.boothVoters;
    const totalPolled = totalValid + head.rejectedVotes + head.notaVotes;

    const turnouts = group
      .map((b) => {
        const l = leaningByElection.get(b.electionId)?.get(b.id);
        const tv = l?.totalValid ?? 0;
        const polled = tv + b.rejectedVotes + b.notaVotes;
        return b._count.boothVoters > 0 ? polled / b._count.boothVoters : 0;
      })
      .filter((t) => t > 0);
    const avgTurnout = turnouts.length ? turnouts.reduce((s, t) => s + t, 0) / turnouts.length : 0;

    return {
      id: psId,
      // Prefer the station's serial-stripped name ("… (East Wing)") over the
      // booth's raw "2 - … (East Wing)"; the serial shows separately as PS-<n>.
      name: head.pollingStation?.name ?? head.name ?? null,
      serial: head.serial,
      latitude: head.pollingStation?.latitude ?? null,
      longitude: head.pollingStation?.longitude ?? null,
      // Elections this booth ran in, within the current year/type filter.
      electionsCount: sorted.length,
      registeredVoters: registered,
      totalValid,
      leader: tops.leader,
      leaderParty: partyOf(head.electionId, tops.leader),
      leaderShare: tops.leaderShare,
      runnerUp: tops.runnerUp,
      runnerUpParty: partyOf(head.electionId, tops.runnerUp),
      runnerUpShare: tops.runnerUpShare,
      margin: tops.leaderShare - tops.runnerUpShare,
      turnoutPct: registered > 0 ? totalPolled / registered : 0,
      avgTurnout,
      byParty,
      elections: historyOf(group),
    };
  })
    .filter((it): it is ConstituencyBooth => it !== null);

  items.sort((a, b) => a.serial - b.serial);

  return {
    constituency: {
      assemblyNo: first?.assemblyNo ?? opts.assemblyNo ?? null,
      assemblyName: first?.assemblyName ?? opts.assemblyName ?? null,
      state: first?.state ?? null,
      parlName: first?.parlName ?? null,
    },
    elections: electionOptions,
    items,
  };
}

export async function computeElectionsHierarchy(): Promise<ElectionsHierarchyResult> {
  const elections = await prisma.election.findMany({
    orderBy: [{ electionType: 'asc' }, { assemblyName: 'asc' }, { electionYear: 'desc' }],
  });

  const enriched = await Promise.all(
    elections.map(async (e) => {
      const { candidates } = await loadCandidateTotals(e.id);
      const pollingStations = await prisma.booth.count({ where: { electionId: e.id } });
      const w = candidates[0] ?? null;
      return {
        election: e,
        pollingStations,
        winner: w ? { name: w.name, party: w.party, share: w.share } : null,
      };
    }),
  );

  // type → constituency(assemblyNo::assemblyName) → year rows
  const typeMap = new Map<string, Map<string, HierarchyConstituency>>();

  for (const item of enriched) {
    const e = item.election;
    const consMap = typeMap.get(e.electionType) ?? new Map<string, HierarchyConstituency>();
    const key = `${e.assemblyNo}::${e.assemblyName}`;
    const yearRow: HierarchyYear = {
      electionId: e.id,
      year: e.electionYear,
      electionType: e.electionType,
      totalElectors: e.totalElectors,
      pollingStations: item.pollingStations,
      winner: item.winner,
    };
    const existing = consMap.get(key);
    if (existing) {
      existing.years.push(yearRow);
    } else {
      consMap.set(key, {
        key,
        assemblyNo: e.assemblyNo,
        assemblyName: e.assemblyName,
        state: e.state,
        parlName: e.parlName,
        latestElectionId: e.id,
        yearCount: 1,
        totalElectors: e.totalElectors,
        pollingStations: item.pollingStations,
        winner: item.winner,
        years: [yearRow],
      });
    }
    typeMap.set(e.electionType, consMap);
  }

  const types = Array.from(typeMap.entries())
    .map(([electionType, consMap]) => {
      const constituencies = Array.from(consMap.values())
        .map((c) => {
          // Order years newest first; the newest defines the row's headline stats.
          c.years.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
          const latest = c.years[0];
          return {
            ...c,
            yearCount: c.years.length,
            latestElectionId: latest.electionId,
            totalElectors: latest.totalElectors,
            pollingStations: latest.pollingStations,
            winner: latest.winner,
          };
        })
        .sort((a, b) => a.assemblyName.localeCompare(b.assemblyName));
      return {
        electionType,
        constituencyCount: constituencies.length,
        yearCount: constituencies.reduce((s, c) => s + c.yearCount, 0),
        totalElectors: constituencies.reduce((s, c) => s + (c.totalElectors ?? 0), 0),
        constituencies,
      };
    })
    .sort((a, b) => a.electionType.localeCompare(b.electionType));

  return { types };
}
