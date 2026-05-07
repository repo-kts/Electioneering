import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const electionSchema = z.object({
  state: z.string().trim().min(1),
  parlNo: z.string().trim().min(1),
  parlName: z.string().trim().min(1),
  assemblyNo: z.string().trim().min(1),
  assemblyName: z.string().trim().min(1),
  electionType: z.string().trim().default('Assembly Election'),
  totalElectors: z.coerce.number().int().nonnegative().optional(),
});

// GET /api/elections
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.election.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { candidates: true, pollingStations: true } } },
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
        pollingStations: {
          orderBy: { serial: 'asc' },
          include: { voteResults: true },
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

// DELETE /api/elections/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.election.delete({ where: { id } });
    res.status(204).end();
  }),
);

// ─── Candidates (dynamic per election) ────────────────────────────────
const candidateSchema = z.object({
  name: z.string().trim().min(1),
  party: z.string().trim().optional(),
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
      // wipe existing PSs (cascades to VoteResult)
      await tx.pollingStation.deleteMany({ where: { electionId } });
      for (const row of rows) {
        const ps = await tx.pollingStation.create({
          data: {
            electionId,
            serial: row.serial,
            name: row.name,
            rejectedVotes: row.rejectedVotes,
            notaVotes: row.notaVotes,
            tenderedVotes: row.tenderedVotes,
          },
        });
        const voteEntries = Object.entries(row.votes)
          .map(([cid, v]) => ({
            pollingStationId: ps.id,
            candidateId: Number(cid),
            votes: v,
          }))
          .filter((e) => validCandIds.has(e.candidateId));
        if (voteEntries.length) {
          await tx.voteResult.createMany({ data: voteEntries });
        }
      }
    });

    const fresh = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: { orderBy: { position: 'asc' } },
        pollingStations: {
          orderBy: { serial: 'asc' },
          include: { voteResults: true },
        },
      },
    });
    res.json(fresh);
  }),
);

export default router;
