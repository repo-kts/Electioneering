import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { recomputePredictedLeaning, linkRollToBooths } from '../services/inference.js';
import { upsertPollingStation, upsertBooth } from '../services/booths.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const electionSchema = z.object({
  state: z.string().trim().min(1),
  parlNo: z.string().trim().min(1),
  parlName: z.string().trim().min(1),
  assemblyNo: z.string().trim().min(1),
  assemblyName: z.string().trim().min(1),
  assemblySeatType: z.string().trim().optional(),
  parlSeatType: z.string().trim().optional(),
  electionType: z.string().trim().default('Assembly Election'),
  electionYear: z.coerce.number().int().min(1950).max(2100).optional(),
  totalElectors: z.coerce.number().int().nonnegative().optional(),
});

// GET /api/elections
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.election.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { candidates: true, booths: true } } },
    });
    res.json({ items });
  }),
);

// GET /api/elections/:id (full Form 20 view)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const election = await prisma.election.findUnique({
      where: { id },
      include: {
        candidates: { orderBy: { position: 'asc' } },
        booths: {
          orderBy: { serial: 'asc' },
          include: { voteResults: true, pollingStation: true },
        },
      },
    });
    if (!election) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json(election);
  }),
);

// POST /api/elections
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = electionSchema.parse(req.body);
    const election = await prisma.election.create({ data });
    res.status(201).json(election);
  }),
);

// PUT /api/elections/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = electionSchema.partial().parse(req.body);
    const election = await prisma.election.update({ where: { id }, data });
    res.json(election);
  }),
);

// DELETE /api/elections/:id (admin only)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.election.delete({ where: { id } });
    res.status(204).end();
  }),
);

// ─── Candidates (dynamic per election) ────────────────────────────────
const candidateSchema = z.object({
  name: z.string().trim().min(1),
  // nullable so the UI can both set and CLEAR party/alliance
  party: z.string().trim().nullish(),
  alliance: z.string().trim().nullish(),
  position: z.coerce.number().int().nonnegative().optional(),
});

router.get(
  '/:id/candidates',
  asyncHandler(async (req, res) => {
    const electionId = Number(req.params.id);
    const items = await prisma.candidate.findMany({
      where: { electionId },
      orderBy: { position: 'asc' },
    });
    res.json({ items });
  }),
);

router.post(
  '/:id/candidates',
  asyncHandler(async (req, res) => {
    const electionId = Number(req.params.id);
    const data = candidateSchema.parse(req.body);
    const last = await prisma.candidate.findFirst({
      where: { electionId },
      orderBy: { position: 'desc' },
    });
    const candidate = await prisma.candidate.create({
      data: {
        electionId,
        name: data.name,
        party: data.party,
        alliance: data.alliance,
        position: data.position ?? (last ? last.position + 1 : 0),
      },
    });
    res.status(201).json(candidate);
  }),
);

router.put(
  '/:id/candidates/:cid',
  asyncHandler(async (req, res) => {
    const cid = Number(req.params.cid);
    const data = candidateSchema.partial().parse(req.body);
    const candidate = await prisma.candidate.update({ where: { id: cid }, data });
    res.json(candidate);
  }),
);

router.delete(
  '/:id/candidates/:cid',
  asyncHandler(async (req, res) => {
    const cid = Number(req.params.cid);
    await prisma.candidate.delete({ where: { id: cid } });
    res.status(204).end();
  }),
);

// ─── Form 20 bulk save (replace polling stations + results) ───────────
const form20RowSchema = z.object({
  serial: z.coerce.number().int().min(1),
  name: z.string().trim().optional(),
  rejectedVotes: z.coerce.number().int().nonnegative().default(0),
  notaVotes: z.coerce.number().int().nonnegative().default(0),
  tenderedVotes: z.coerce.number().int().nonnegative().default(0),
  // votes keyed by candidateId
  votes: z.record(z.string(), z.coerce.number().int().nonnegative()),
});

const form20SaveSchema = z.object({
  rows: z.array(form20RowSchema),
});

// PUT /api/elections/:id/form20  → replace all polling-station rows
router.put(
  '/:id/form20',
  asyncHandler(async (req, res) => {
    const electionId = Number(req.params.id);
    const { rows } = form20SaveSchema.parse(req.body);

    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: { candidates: true },
    });
    if (!election) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    const validCandIds = new Set(election.candidates.map((c) => c.id));

    await prisma.$transaction(async (tx) => {
      // Clear only the vote results (not booths — deleting booths would cascade
      // away the BoothVoter roll mappings). Booths are re-upserted below.
      const existingBooths = await tx.booth.findMany({ where: { electionId }, select: { id: true } });
      await tx.voteResult.deleteMany({ where: { boothId: { in: existingBooths.map((b) => b.id) } } });
      for (const row of rows) {
        const pollingStationId = await upsertPollingStation(
          tx,
          { assemblyNo: election.assemblyNo, assemblyName: election.assemblyName, name: row.name },
          row.serial,
        );
        const boothId = await upsertBooth(tx, {
          electionId,
          pollingStationId,
          serial: row.serial,
          name: row.name,
          rejectedVotes: row.rejectedVotes,
          notaVotes: row.notaVotes,
          tenderedVotes: row.tenderedVotes,
        });
        const voteEntries = Object.entries(row.votes)
          .map(([cid, v]) => ({
            boothId,
            candidateId: Number(cid),
            votes: v,
          }))
          .filter((e) => validCandIds.has(e.candidateId));
        if (voteEntries.length) {
          await tx.voteResult.createMany({ data: voteEntries });
        }
      }
    });

    // Reconcile roll→booth links then recompute predicted leaning
    try {
      await linkRollToBooths(electionId);
      await recomputePredictedLeaning(electionId);
    } catch (err) {
      console.error('[inference] recompute failed', err);
    }

    const fresh = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: { orderBy: { position: 'asc' } },
        booths: {
          orderBy: { serial: 'asc' },
          include: { voteResults: true, pollingStation: true },
        },
      },
    });
    res.json(fresh);
  }),
);

export default router;
