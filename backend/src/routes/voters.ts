import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  segmentSchema,
  buildVoterWhere,
  passesLeaningFilter,
  aggregate,
} from '../services/segmentation.js';
import { classifyName } from '../services/nameClassifier.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const MOBILE_RE = /^[6-9]\d{9}$/;
const EPIC_RE = /^[A-Z]{3}\d{7}$/;

const optStr = z
  .string()
  .trim()
  .optional()
  .or(z.literal('').transform(() => undefined));

const voterSchema = z.object({
  fullName: optStr,
  firstName: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  lastName: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  relationType: optStr,
  relativeName: optStr,
  relFirstName: z.string().trim().transform((s) => s.toUpperCase()).optional().default(''),
  relLastName: z.string().trim().transform((s) => s.toUpperCase()).optional().default(''),
  age: z.coerce.number().int().min(18).max(120),
  gender: z.enum(['Male', 'Female', 'Other']),
  epic: z.string().trim().regex(EPIC_RE, 'EPIC must be 3 letters + 7 digits'),
  mobile: z
    .string()
    .trim()
    .regex(MOBILE_RE, 'Mobile must be 10 digits starting 6-9')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Geography — only first/last name + epic are strictly required; the roll
  // rarely carries the higher admin levels, so keep them optional.
  state: z.string().trim().optional().default(''),
  parlNo: z.string().trim().optional().default(''),
  parlName: z.string().trim().optional().default(''),
  assemblyNo: z.string().trim().optional().default(''),
  assemblyName: z.string().trim().optional().default(''),
  pollingStationName: z.string().trim().optional().default(''),
  pollingStationAddress: optStr,
  partNumber: z.string().trim().optional().default(''),
  partName: optStr,
  partSerial: z.string().trim().optional().default(''),
  houseNumber: optStr,
  sectionNo: optStr,
  sectionName: optStr,
  mainTown: optStr,
  ward: optStr,
  postOffice: optStr,
  policeStation: optStr,
  panchayat: optStr,
  block: optStr,
  tehsil: optStr,
  mandal: optStr,
  revenueDivision: optStr,
  subdivision: optStr,
  district: optStr,
  pinCode: optStr,
  community: optStr,
  religion: optStr,
  occupation: optStr,
  language: optStr,
});

type VoterInput = z.infer<typeof voterSchema>;

/** Fill religion/community from the name when not supplied manually. */
function enrichVoter(v: VoterInput) {
  if (v.community || v.religion) {
    return { ...v, communitySource: 'manual', communityConfidence: 1 };
  }
  const c = classifyName(v.firstName, v.lastName);
  return {
    ...v,
    religion: c.religion,
    community: c.community ?? undefined,
    communitySource: c.source,
    communityConfidence: c.confidence,
  };
}

const bulkSchema = z.object({
  voters: z.array(voterSchema).min(1),
});

// GET /api/voters
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { state, assemblyNo, search, take = '100', skip = '0' } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (state) where.state = state;
    if (assemblyNo) where.assemblyNo = assemblyNo;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { epic: { contains: search.toUpperCase() } },
        { mobile: { contains: search } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.voter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(take) || 100, 500),
        skip: Number(skip) || 0,
      }),
      prisma.voter.count({ where }),
    ]);
    res.json({ items, total });
  }),
);

// POST /api/voters/segment  → flexible filter + aggregates (admin only)
router.post(
  '/segment',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const c = segmentSchema.parse(req.body ?? {});
    const where = buildVoterWhere(c);
    // Pull a generous slice; predicted-leaning filter applied in JS.
    // For huge datasets, push down via raw SQL later.
    const candidate = await prisma.voter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: c.take + c.skip + 500, // headroom for leaning filter
      skip: 0,
    });
    const filtered = candidate.filter((v) => passesLeaningFilter(v, c));
    const total = filtered.length;
    const items = filtered.slice(c.skip, c.skip + c.take);
    const aggregates = aggregate(filtered);
    res.json({ items, total, aggregates, criteria: c });
  }),
);

// GET /api/voters/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const voter = await prisma.voter.findUnique({ where: { id } });
    if (!voter) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json(voter);
  }),
);

// POST /api/voters  (single)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = enrichVoter(voterSchema.parse(req.body));
    const voter = await prisma.voter.create({ data });
    res.status(201).json(voter);
  }),
);

// POST /api/voters/bulk
router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const { voters } = bulkSchema.parse(req.body);
    const result = await prisma.voter.createMany({
      data: voters.map(enrichVoter),
      skipDuplicates: true,
    });
    res.status(201).json({ inserted: result.count, requested: voters.length });
  }),
);

// POST /api/voters/classify[?assemblyNo=&force=1] (admin only)
// Backfill religion/community from names for voters missing it (or all, force=1).
router.post(
  '/classify',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const assemblyNo = (req.query.assemblyNo as string) || undefined;
    const force = req.query.force === '1';
    const where: Record<string, unknown> = {};
    if (assemblyNo) where.assemblyNo = assemblyNo;
    if (!force) where.OR = [{ religion: null }, { communitySource: 'inferred', religion: null }];
    const voters = await prisma.voter.findMany({
      where: force ? (assemblyNo ? { assemblyNo } : {}) : where,
      select: { id: true, firstName: true, lastName: true, communitySource: true },
    });
    let updated = 0;
    for (const v of voters) {
      if (!force && v.communitySource === 'manual') continue;
      const c = classifyName(v.firstName, v.lastName);
      await prisma.voter.update({
        where: { id: v.id },
        data: {
          religion: c.religion,
          community: c.community,
          communityConfidence: c.confidence,
          communitySource: 'inferred',
        },
      });
      updated += 1;
    }
    res.json({ scanned: voters.length, updated });
  }),
);

// PUT /api/voters/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = voterSchema.partial().parse(req.body);
    const voter = await prisma.voter.update({ where: { id }, data });
    res.json(voter);
  }),
);

// DELETE /api/voters/:id (admin only)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.voter.delete({ where: { id } });
    res.status(204).end();
  }),
);

export default router;
