import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { rebuildHouseholds } from '../services/household.js';

const router = Router();

// POST /api/households/rebuild[?assemblyNo=]  → (re)cluster voters into households
router.post(
  '/rebuild',
  asyncHandler(async (req, res) => {
    const assemblyNo = (req.query.assemblyNo as string) || undefined;
    const result = await rebuildHouseholds(assemblyNo);
    res.json(result);
  }),
);

// GET /api/households[?assemblyNo=&take=&skip=]  → households with member counts
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const assemblyNo = (req.query.assemblyNo as string) || undefined;
    const take = Math.min(Number(req.query.take) || 100, 500);
    const skip = Number(req.query.skip) || 0;
    const where = assemblyNo ? { assemblyNo } : {};
    const [items, total] = await Promise.all([
      prisma.household.findMany({
        where,
        orderBy: { size: 'desc' },
        take,
        skip,
        include: { _count: { select: { voters: true } } },
      }),
      prisma.household.count({ where }),
    ]);
    res.json({ items, total });
  }),
);

// GET /api/households/:id  → household with its voters
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const household = await prisma.household.findUnique({
      where: { id },
      include: { voters: true },
    });
    if (!household) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json(household);
  }),
);

export default router;
