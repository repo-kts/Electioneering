import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  computeBoothLeanings,
  computeCommunityLeaning,
  recomputePredictedLeaning,
  linkRollToBooths,
} from '../services/inference.js';
import { aggregate, attachElectionFields } from '../services/segmentation.js';
import { computeBoothTargets, computeTurnoutGap, computeSwing } from '../services/boothAnalytics.js';
import { assembleStrategyBrief } from '../services/strategy.js';
import { geocodeElectionBooths } from '../services/geocode.js';
import { computeBoothRecommendations } from '../services/boothRecommendations.js';
import {
  computePartyAnalytics,
  computeAssemblyTimeline,
  computeElectionsHierarchy,
} from '../services/electionInsights.js';

const router = Router();

// GET /api/analytics/community-leaning?electionId=X[&dimension=religion|community]
// Ecological estimate of each community's candidate leaning (statistical).
router.get(
  '/community-leaning',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const dimension = req.query.dimension === 'community' ? 'community' : 'religion';
    const result = await computeCommunityLeaning(electionId, dimension);
    res.json(result);
  }),
);

// GET /api/analytics/swing?electionA=X&electionB=Y
// Per-candidate + per-booth vote-share swing between two elections.
router.get(
  '/swing',
  asyncHandler(async (req, res) => {
    const { electionA, electionB } = z
      .object({ electionA: z.coerce.number().int(), electionB: z.coerce.number().int() })
      .parse({ electionA: req.query.electionA, electionB: req.query.electionB });
    const result = await computeSwing(electionA, electionB);
    res.json(result);
  }),
);

// GET /api/analytics/booth-targets?electionId=X[&ourCandidate=Name]
// Per-booth competitiveness classification for a chosen candidate +
// summary counts (swing booths, strongholds, opposition strongholds).
router.get(
  '/booth-targets',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const ourCandidate = (req.query.ourCandidate as string) || undefined;
    const result = await computeBoothTargets(electionId, ourCandidate);
    res.json(result);
  }),
);

// GET /api/analytics/turnout-gap?electionId=X[&ourCandidate=Name]
// GOTV list — favorable/winnable booths with below-median turnout.
router.get(
  '/turnout-gap',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const ourCandidate = (req.query.ourCandidate as string) || undefined;
    const result = await computeTurnoutGap(electionId, ourCandidate);
    res.json(result);
  }),
);

// GET /api/analytics/strategy?electionId=X[&candidate=Name]
// Candidate campaign strategy brief: aggregate booth priorities,
// recommendations, and data-quality gaps for planning.
router.get(
  '/strategy',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const candidate = (req.query.candidate as string) || undefined;
    const result = await assembleStrategyBrief(electionId, candidate);
    res.json(result);
  }),
);

// POST /api/analytics/recompute?electionId=X[&link=1]
// Recomputes predictedLeaning for every voter linked to a PS in the election.
// link=1 also relinks voters to PS by name match before computing.
router.post(
  '/recompute',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    let linked = 0;
    if (req.query.link === '1') {
      linked = await linkRollToBooths(electionId);
    }
    const r = await recomputePredictedLeaning(electionId);
    res.json({ electionId, linked, ...r });
  }),
);

// GET /api/analytics/booth/:boothId
// Everything about one booth: candidate votes + share, turnout, and the
// voter-roll demographics for that booth (community/religion/age/gender/
// household) plus a voter sample. Powers the booth drill-down page.
router.get(
  '/booth/:boothId',
  asyncHandler(async (req, res) => {
    const boothId = Number(req.params.boothId);
    const booth = await prisma.booth.findUnique({
      where: { id: boothId },
      include: {
        election: true,
        pollingStation: true,
        voteResults: { include: { candidate: true } },
      },
    });
    if (!booth) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
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

    // Roll for this booth (per-election), with the linked voter.
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

    // Booth classification + concrete campaign recommendations.
    const reco = await computeBoothRecommendations(booth.electionId, booth.id, {
      leader: leader ? { name: leader.name, share: leader.share } : null,
      runnerUp: runnerUp ? { name: runnerUp.name, share: runnerUp.share } : null,
      totalValid,
      notaShare: totalPolled > 0 ? booth.notaVotes / totalPolled : 0,
      demographics,
      registered,
    });

    res.json({
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
    });
  }),
);

// GET /api/analytics/booth-leaning?electionId=X
// Returns each polling station with its leader candidate, top shares, and
// the number of registered voters mapped to that station.
router.get(
  '/booth-leaning',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const booths = await prisma.booth.findMany({
      where: { electionId },
      orderBy: { serial: 'asc' },
      include: { pollingStation: true, _count: { select: { boothVoters: true } } },
    });
    const leanings = await computeBoothLeanings(electionId);
    const items = booths.map((b) => {
      const lean = leanings.get(b.id);
      return {
        id: b.id,
        serial: b.serial,
        name: b.name ?? b.pollingStation?.name ?? null,
        latitude: b.pollingStation?.latitude ?? null,
        longitude: b.pollingStation?.longitude ?? null,
        registeredVoters: b._count.boothVoters,
        totalValid: lean?.totalValid ?? 0,
        leader: lean?.leader ?? null,
        leaderShare: lean?.leaderShare ?? 0,
        byCandidate: lean?.byCandidate ?? {},
      };
    });
    const geocoded = items.filter((i) => i.latitude != null && i.longitude != null).length;
    res.json({ electionId, items, geocoded });
  }),
);

// POST /api/analytics/geocode?electionId=X[&force=1]
// Geocode polling stations to lat/long (OSM Nominatim) for the map view.
router.post(
  '/geocode',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const result = await geocodeElectionBooths(electionId, req.query.force === '1');
    res.json(result);
  }),
);

// GET /api/analytics/overview?electionId=&assemblyNo=&assemblyName=
// One-shot payload that powers the AnalyticsPage. All numbers are real:
//  - voters scoped by assemblyNo (or all)
//  - selected election's Form 20 candidate totals + share
//  - turnout history per election in the same assembly (or all)
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const params = z
      .object({
        electionId: z.coerce.number().int().optional(),
        assemblyNo: z.string().optional(),
        assemblyName: z.string().optional(),
      })
      .parse({
        electionId: req.query.electionId,
        assemblyNo: req.query.assemblyNo,
        assemblyName: req.query.assemblyName,
      });

    // Elections list — for picker
    const electionsList = await prisma.election.findMany({
      orderBy: [{ assemblyName: 'asc' }, { electionYear: 'desc' }],
    });

    // Resolve target election
    let election = null;
    if (params.electionId) {
      election = await prisma.election.findUnique({ where: { id: params.electionId } });
    } else if (params.assemblyNo && params.assemblyName) {
      election = await prisma.election.findFirst({
        where: { assemblyNo: params.assemblyNo, assemblyName: params.assemblyName },
        orderBy: { electionYear: 'desc' },
      });
    } else {
      election = electionsList[0] ?? null;
    }

    // Voter scope = assembly of the selected election (or first election),
    // or all voters if nothing selected.
    const voterWhere: { assemblyNo?: string; assemblyName?: string } = {};
    if (election) {
      voterWhere.assemblyNo = election.assemblyNo;
      voterWhere.assemblyName = election.assemblyName;
    }
    const voterRows = await prisma.voter.findMany({
      where: voterWhere,
      include: election
        ? {
            boothVoters: {
              where: { electionId: election.id },
              include: { booth: { include: { pollingStation: true } } },
            },
          }
        : undefined,
    });
    const voters = attachElectionFields(voterRows, election?.id);
    const voterAggs = aggregate(voters);

    // Election candidate totals + per-PS leanings
    let electionPayload: object | null = null;
    let turnoutHistory: Array<{
      electionId: number;
      electionYear: number | null;
      electionType: string;
      voted: number;
      registered: number;
      pct: number;
      totalValid: number;
    }> = [];
    if (election) {
      const ps = await prisma.booth.findMany({
        where: { electionId: election.id },
        include: {
          voteResults: { include: { candidate: true } },
        },
      });
      const candTotals = new Map<number, { id: number; name: string; party: string | null; alliance: string | null; votes: number }>();
      let totalValid = 0;
      let totalRejected = 0;
      let totalNota = 0;
      let totalTendered = 0;
      for (const p of ps) {
        totalRejected += p.rejectedVotes;
        totalNota += p.notaVotes;
        totalTendered += p.tenderedVotes;
        for (const vr of p.voteResults) {
          totalValid += vr.votes;
          const prev = candTotals.get(vr.candidateId);
          if (prev) prev.votes += vr.votes;
          else
            candTotals.set(vr.candidateId, {
              id: vr.candidateId,
              name: vr.candidate.name,
              party: vr.candidate.party,
              alliance: vr.candidate.alliance,
              votes: vr.votes,
            });
        }
      }
      const candidates = Array.from(candTotals.values())
        .map((c) => ({ ...c, share: totalValid > 0 ? c.votes / totalValid : 0 }))
        .sort((a, b) => b.votes - a.votes);

      // Turnout for this election from BoothVoter (where Voter is in scope)
      const voterIds = voters.map((v) => v.id);
      const voted = voterIds.length
        ? await prisma.boothVoter.count({
            where: { electionId: election.id, voterId: { in: voterIds }, voted: true },
          })
        : 0;
      const registered = voters.length;

      electionPayload = {
        id: election.id,
        assemblyNo: election.assemblyNo,
        assemblyName: election.assemblyName,
        electionYear: election.electionYear,
        electionType: election.electionType,
        totalElectors: election.totalElectors,
        candidates,
        totalValid,
        totalRejected,
        totalNota,
        totalTendered,
        totalCast: totalValid + totalRejected + totalNota,
        leader: candidates[0] ?? null,
        runnerUp: candidates[1] ?? null,
        turnout: {
          voted,
          registered,
          pct: registered > 0 ? voted / registered : 0,
        },
      };

      // Turnout history across same-assembly elections
      const sameAssembly = await prisma.election.findMany({
        where: { assemblyNo: election.assemblyNo, assemblyName: election.assemblyName },
        orderBy: { electionYear: 'asc' },
        select: { id: true, electionYear: true, electionType: true },
      });
      for (const e of sameAssembly) {
        const v = voterIds.length
          ? await prisma.boothVoter.count({
              where: { electionId: e.id, voterId: { in: voterIds }, voted: true },
            })
          : 0;
        const psE = await prisma.booth.findMany({
          where: { electionId: e.id },
          include: { voteResults: true },
        });
        const valid = psE.reduce(
          (acc, p) => acc + p.voteResults.reduce((s, r) => s + r.votes, 0),
          0,
        );
        turnoutHistory.push({
          electionId: e.id,
          electionYear: e.electionYear,
          electionType: e.electionType,
          voted: v,
          registered: voters.length,
          pct: voters.length > 0 ? v / voters.length : 0,
          totalValid: valid,
        });
      }
    }

    res.json({
      scope: {
        assemblyNo: election?.assemblyNo ?? null,
        assemblyName: election?.assemblyName ?? null,
      },
      electionsList,
      election: electionPayload,
      voters: {
        total: voters.length,
        ...voterAggs,
      },
      turnoutHistory,
    });
  }),
);

// GET /api/analytics/party?electionId=X
// Party-level vote aggregation for one election: votes, share, candidate count,
// booths led, and top candidate per party. Null/empty party → "Independent".
router.get(
  '/party',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const result = await computePartyAnalytics(electionId);
    res.json(result);
  }),
);

// GET /api/analytics/assembly-timeline?assemblyNo=X&assemblyName=Y[&limit=N]
// Year-over-year results for one assembly constituency: turnout, winner,
// runner-up, and margin per election, newest first. `limit` caps the count.
router.get(
  '/assembly-timeline',
  asyncHandler(async (req, res) => {
    const params = z
      .object({
        assemblyNo: z.string().optional(),
        assemblyName: z.string().optional(),
        limit: z.coerce.number().int().min(1).optional(),
      })
      .refine((p) => p.assemblyNo || p.assemblyName, {
        message: 'assemblyNo or assemblyName is required',
      })
      .parse({
        assemblyNo: req.query.assemblyNo,
        assemblyName: req.query.assemblyName,
        limit: req.query.limit,
      });
    const result = await computeAssemblyTimeline(params);
    res.json(result);
  }),
);

// GET /api/analytics/hierarchy
// All elections grouped into a tree: Election Type → Year → Constituency,
// with electionCount + totalElectors rollups at each level.
router.get(
  '/hierarchy',
  asyncHandler(async (_req, res) => {
    const result = await computeElectionsHierarchy();
    res.json(result);
  }),
);

export default router;
