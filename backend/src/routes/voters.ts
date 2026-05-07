import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const MOBILE_RE = /^[6-9]\d{9}$/;
const EPIC_RE = /^[A-Z]{3}\d{7}$/;

const voterSchema = z.object({
  firstName: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  lastName: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  relFirstName: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  relLastName: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  age: z.coerce.number().int().min(18).max(120),
  gender: z.enum(['Male', 'Female', 'Other']),
  epic: z.string().trim().regex(EPIC_RE, 'EPIC must be 3 letters + 7 digits'),
  mobile: z
    .string()
    .trim()
    .regex(MOBILE_RE, 'Mobile must be 10 digits starting 6-9')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  state: z.string().trim().min(1),
  parlNo: z.string().trim().min(1),
  parlName: z.string().trim().min(1),
  assemblyNo: z.string().trim().min(1),
  assemblyName: z.string().trim().min(1),
  pollingStationName: z.string().trim().min(1),
  partNumber: z.string().trim().min(1),
  partName: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  partSerial: z.string().trim().min(1),
  pollingDate: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? new Date(v) : undefined)),
});

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
    const data = voterSchema.parse(req.body);
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
      data: voters,
      skipDuplicates: true,
    });
    res.status(201).json({ inserted: result.count, requested: voters.length });
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

// DELETE /api/voters/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.voter.delete({ where: { id } });
    res.status(204).end();
  }),
);

export default router;
