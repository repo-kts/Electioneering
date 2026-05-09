import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  computePollingStationLeanings,
  recomputePredictedLeaning,
  linkVotersToPollingStations,
} from '../services/inference.js';
import { aggregate } from '../services/segmentation.js';

const router = Router();

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
      linked = await linkVotersToPollingStations(electionId);
    }
    const r = await recomputePredictedLeaning(electionId);
    res.json({ electionId, linked, ...r });
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
    const stations = await prisma.pollingStation.findMany({
      where: { electionId },
      orderBy: { serial: 'asc' },
      include: { _count: { select: { voters: true } } },
    });
    const leanings = await computePollingStationLeanings(electionId);
    const items = stations.map((ps) => {
      const lean = leanings.get(ps.id);
      return {
        id: ps.id,
        serial: ps.serial,
        name: ps.name,
        registeredVoters: ps._count.voters,
        totalValid: lean?.totalValid ?? 0,
        leader: lean?.leader ?? null,
        leaderShare: lean?.leaderShare ?? 0,
        byCandidate: lean?.byCandidate ?? {},
      };
    });
    res.json({ electionId, items });
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
    const voters = await prisma.voter.findMany({ where: voterWhere });
    const voterAggs = aggregate(voters);

    // Election candidate totals + per-PS leanings
    let electionPayload: object | null = null;
    let turnoutHistory: Array<{
      electionId: number;
      electionYear: number | null;
      voted: number;
      registered: number;
      pct: number;
      totalValid: number;
    }> = [];
    if (election) {
      const ps = await prisma.pollingStation.findMany({
        where: { electionId: election.id },
        include: {
          voteResults: { include: { candidate: true } },
        },
      });
      const candTotals = new Map<number, { id: number; name: string; party: string | null; votes: number }>();
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
              votes: vr.votes,
            });
        }
      }
      const candidates = Array.from(candTotals.values())
        .map((c) => ({ ...c, share: totalValid > 0 ? c.votes / totalValid : 0 }))
        .sort((a, b) => b.votes - a.votes);

      // Turnout for this election from VoterTurnout (where Voter is in scope)
      const voterIds = voters.map((v) => v.id);
      const voted = voterIds.length
        ? await prisma.voterTurnout.count({
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
        select: { id: true, electionYear: true },
      });
      for (const e of sameAssembly) {
        const v = voterIds.length
          ? await prisma.voterTurnout.count({
              where: { electionId: e.id, voterId: { in: voterIds }, voted: true },
            })
          : 0;
        const psE = await prisma.pollingStation.findMany({
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

export default router;
