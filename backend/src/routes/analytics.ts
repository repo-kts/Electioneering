import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  computePollingStationLeanings,
  recomputePredictedLeaning,
  linkVotersToPollingStations,
} from '../services/inference.js';

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

export default router;
