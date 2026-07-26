import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { recomputePredictedLeaning } from '../services/inference.js';
import { resolveBoothsByCode, upsertBooth, replaceBoothGrid } from '../services/booths.js';
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

// ─── Copy voters into another election ────────────────────────────────
// Replicates a source election's roll into the target without a manual Excel
// re-import. Voters are the stable EPIC-keyed masters — they are REUSED, not
// duplicated. For each source BoothVoter we ensure a per-election Booth on the
// same master PollingStation for the target, then create the target BoothVoter
// (same voter, copied roll position). Predicted leaning is reset — it recomputes
// from the target's own Form 20 once uploaded. Idempotent: re-copying skips
// voters already placed in the target (unique electionId+voterId).
const copyVotersSchema = z.object({
  fromElectionId: z.coerce.number().int().positive(),
});

// POST /api/elections/:id/copy-voters  { fromElectionId }  (admin only)
router.post(
  '/:id/copy-voters',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    const { fromElectionId } = copyVotersSchema.parse(req.body);

    if (fromElectionId === targetId) {
      res.status(400).json({ error: 'BadRequest', message: 'Source and target elections must differ.' });
      return;
    }

    const [target, source] = await Promise.all([
      prisma.election.findUnique({ where: { id: targetId } }),
      prisma.election.findUnique({ where: { id: fromElectionId } }),
    ]);
    if (!target || !source) {
      res.status(404).json({ error: 'NotFound', message: 'Source or target election not found.' });
      return;
    }

    // Source roll entries + the master polling station behind each booth.
    const sourceBVs = await prisma.boothVoter.findMany({
      where: { electionId: fromElectionId },
      select: {
        voterId: true,
        partNumber: true,
        partName: true,
        partSerial: true,
        houseNumber: true,
        sectionNo: true,
        sectionName: true,
        booth: { select: { pollingStationId: true, serial: true, name: true } },
      },
    });
    if (sourceBVs.length === 0) {
      res.status(400).json({ error: 'BadRequest', message: 'Source election has no voters to copy.' });
      return;
    }

    // Ensure a per-election Booth on the target for every referenced master PS.
    const psMeta = new Map<number, { serial: number; name: string | null }>();
    for (const bv of sourceBVs) {
      const psId = bv.booth.pollingStationId;
      if (!psMeta.has(psId)) psMeta.set(psId, { serial: bv.booth.serial, name: bv.booth.name });
    }
    const psToBooth = new Map<number, number>();
    for (const [psId, meta] of psMeta) {
      const boothId = await upsertBooth(prisma, {
        electionId: targetId,
        pollingStationId: psId,
        serial: meta.serial,
        name: meta.name,
      });
      psToBooth.set(psId, boothId);
    }

    // Create the target roll entries (same voters), leaning reset.
    const bvData = sourceBVs.map((bv) => ({
      electionId: targetId,
      boothId: psToBooth.get(bv.booth.pollingStationId) as number,
      voterId: bv.voterId,
      partNumber: bv.partNumber,
      partName: bv.partName,
      partSerial: bv.partSerial,
      houseNumber: bv.houseNumber,
      sectionNo: bv.sectionNo,
      sectionName: bv.sectionName,
    }));
    const result = await prisma.boothVoter.createMany({ data: bvData, skipDuplicates: true });

    // If the target already has a Form 20, immediately populate leanings.
    try {
      await recomputePredictedLeaning(targetId);
    } catch (err) {
      console.error('[inference] recompute after copy failed', err);
    }

    await prisma.uploadHistory.create({
      data: {
        fileName: `Copy from ${source.assemblyNo}-${source.assemblyName}${source.electionYear ? ` (${source.electionYear})` : ''}`,
        source: `Copied · ${source.assemblyName} → ${target.assemblyName}`,
        kind: 'voter',
        records: result.count,
        constituency: `${target.assemblyNo}-${target.assemblyName}`,
        status: 'validated',
      },
    });

    res.status(201).json({
      copied: result.count,
      requested: sourceBVs.length,
      duplicates: sourceBVs.length - result.count,
      booths: psToBooth.size,
    });
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

// ─── Form 20 bulk save (replace results for booths named by UNIQUE_CODE) ──
const form20RowSchema = z.object({
  code: z.string().trim().min(1), // master-booth UNIQUE_CODE (resolves the booth)
  serial: z.coerce.number().int().min(0).default(0),
  rejectedVotes: z.coerce.number().int().nonnegative().default(0),
  notaVotes: z.coerce.number().int().nonnegative().default(0),
  tenderedVotes: z.coerce.number().int().nonnegative().default(0),
  // votes keyed by candidateId
  votes: z.record(z.string(), z.coerce.number().int().nonnegative()),
});

const form20SaveSchema = z.object({
  rows: z.array(form20RowSchema),
});

// PUT /api/elections/:id/form20  → replace results for each named booth
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

    // Resolve booths by UNIQUE_CODE; reject the save if any code is unknown /
    // from another constituency (booths are never created here).
    const byCode = await resolveBoothsByCode(prisma, rows.map((r) => r.code));
    const unknown = rows
      .filter((r) => {
        const b = byCode.get(r.code);
        if (!b) return true;
        const ba = (b.assemblyNo ?? '').trim();
        const ea = (election.assemblyNo ?? '').trim();
        return ba && ea ? ba !== ea : (b.parlNo ?? '').trim() !== (election.parlNo ?? '').trim();
      })
      .map((r) => r.code);
    if (unknown.length) {
      res.status(400).json({
        error: 'BadRequest',
        message: `${unknown.length} UNIQUE_CODE${unknown.length === 1 ? '' : 's'} not found in this constituency: ${[...new Set(unknown)].slice(0, 10).join(', ')}. Create the booth(s) in Master → Booths first.`,
      });
      return;
    }

    // Batched — replaces only these booths' results, leaving BoothVoter roll
    // mappings intact. A per-row loop here costs three round trips per booth.
    await prisma.$transaction(async (tx) => {
      await replaceBoothGrid(
        tx,
        electionId,
        rows.map((row) => ({
          pollingStationId: byCode.get(row.code)!.id,
          serial: row.serial,
          rejectedVotes: row.rejectedVotes,
          notaVotes: row.notaVotes,
          tenderedVotes: row.tenderedVotes,
          votes: Object.entries(row.votes)
            .map(([cid, v]) => ({ candidateId: Number(cid), votes: v }))
            .filter((e) => validCandIds.has(e.candidateId)),
        })),
      );
    });

    try {
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
