// Master-data CRUD — powers the /all-master admin page and feeds every
// dropdown in the app. Reads are open to both roles (data entry needs the
// option lists); writes are admin-only (requireAdmin per mutating route).

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { syncMasterFromData, seedMasterDefaults } from '../services/master.js';

const router = Router();

// ─── Geography: read ──────────────────────────────────────────────────
router.get(
  '/geography/tree',
  asyncHandler(async (_req, res) => {
    const countries = await prisma.country.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        states: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            parliamentaryConstituencies: {
              orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }],
              include: {
                assemblies: { orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }] },
              },
            },
          },
        },
      },
    });
    res.json({ countries });
  }),
);

router.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const items = await prisma.country.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    res.json({ items });
  }),
);
router.get(
  '/states',
  asyncHandler(async (req, res) => {
    const countryId = req.query.countryId ? Number(req.query.countryId) : undefined;
    const items = await prisma.state.findMany({
      where: countryId ? { countryId } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ items });
  }),
);
router.get(
  '/parliamentary',
  asyncHandler(async (req, res) => {
    const stateId = req.query.stateId ? Number(req.query.stateId) : undefined;
    const items = await prisma.parliamentaryConstituency.findMany({
      where: stateId ? { stateId } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }],
    });
    res.json({ items });
  }),
);
router.get(
  '/assembly',
  asyncHandler(async (req, res) => {
    const parlId = req.query.parlId ? Number(req.query.parlId) : undefined;
    const items = await prisma.assemblyConstituency.findMany({
      where: parlId ? { parlId } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }],
    });
    res.json({ items });
  }),
);

// ─── Geography: write (admin) ─────────────────────────────────────────
const countrySchema = z.object({
  code: z.string().trim().min(1).max(8),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});
const stateSchema = z.object({
  countryId: z.coerce.number().int(),
  code: z.string().trim().optional(),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});
const parlSchema = z.object({
  stateId: z.coerce.number().int(),
  number: z.string().trim().min(1),
  name: z.string().trim().min(1),
  seatType: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});
const assemblySchema = z.object({
  parlId: z.coerce.number().int(),
  number: z.string().trim().min(1),
  name: z.string().trim().min(1),
  seatType: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

router.post('/countries', requireAdmin, asyncHandler(async (req, res) => {
  const data = countrySchema.parse(req.body);
  res.status(201).json(await prisma.country.create({ data }));
}));
router.put('/countries/:id', requireAdmin, asyncHandler(async (req, res) => {
  const data = countrySchema.partial().parse(req.body);
  res.json(await prisma.country.update({ where: { id: Number(req.params.id) }, data }));
}));
router.delete('/countries/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.country.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

router.post('/states', requireAdmin, asyncHandler(async (req, res) => {
  const data = stateSchema.parse(req.body);
  res.status(201).json(await prisma.state.create({ data }));
}));
router.put('/states/:id', requireAdmin, asyncHandler(async (req, res) => {
  const data = stateSchema.partial().parse(req.body);
  res.json(await prisma.state.update({ where: { id: Number(req.params.id) }, data }));
}));
router.delete('/states/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.state.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

router.post('/parliamentary', requireAdmin, asyncHandler(async (req, res) => {
  const data = parlSchema.parse(req.body);
  res.status(201).json(await prisma.parliamentaryConstituency.create({ data }));
}));
router.put('/parliamentary/:id', requireAdmin, asyncHandler(async (req, res) => {
  const data = parlSchema.partial().parse(req.body);
  res.json(await prisma.parliamentaryConstituency.update({ where: { id: Number(req.params.id) }, data }));
}));
router.delete('/parliamentary/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.parliamentaryConstituency.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

router.post('/assembly', requireAdmin, asyncHandler(async (req, res) => {
  const data = assemblySchema.parse(req.body);
  res.status(201).json(await prisma.assemblyConstituency.create({ data }));
}));
router.put('/assembly/:id', requireAdmin, asyncHandler(async (req, res) => {
  const data = assemblySchema.partial().parse(req.body);
  res.json(await prisma.assemblyConstituency.update({ where: { id: Number(req.params.id) }, data }));
}));
router.delete('/assembly/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.assemblyConstituency.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

// ─── Lookup lists: read ───────────────────────────────────────────────
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const items = await prisma.masterCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { options: true } } },
    });
    res.json({ items });
  }),
);
router.get(
  '/categories/:key',
  asyncHandler(async (req, res) => {
    const cat = await prisma.masterCategory.findUnique({
      where: { key: req.params.key },
      include: { options: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
    });
    if (!cat) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json(cat);
  }),
);
// Active options only — the shape dropdowns consume.
router.get(
  '/options/:key',
  asyncHandler(async (req, res) => {
    const cat = await prisma.masterCategory.findUnique({
      where: { key: req.params.key },
      include: {
        options: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] },
      },
    });
    res.json({ key: req.params.key, options: cat?.options ?? [] });
  }),
);

// ─── Lookup lists: write (admin) ──────────────────────────────────────
const categorySchema = z.object({
  key: z.string().trim().min(1).regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, underscore'),
  label: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().optional(),
});
const optionSchema = z.object({
  label: z.string().trim().min(1),
  code: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
  meta: z.unknown().optional(),
});

router.post('/categories', requireAdmin, asyncHandler(async (req, res) => {
  const data = categorySchema.parse(req.body);
  res.status(201).json(await prisma.masterCategory.create({ data: { ...data, system: false } }));
}));
router.put('/categories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.masterCategory.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'NotFound' }); return; }
  // System categories: allow relabel/reorder, but not key changes.
  const data = categorySchema.partial().parse(req.body);
  if (existing.system) delete (data as { key?: string }).key;
  res.json(await prisma.masterCategory.update({ where: { id }, data }));
}));
router.delete('/categories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.masterCategory.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'NotFound' }); return; }
  if (existing.system) {
    res.status(400).json({ error: 'BadRequest', message: 'System categories cannot be deleted' });
    return;
  }
  await prisma.masterCategory.delete({ where: { id } });
  res.status(204).end();
}));

router.post('/categories/:key/options', requireAdmin, asyncHandler(async (req, res) => {
  const cat = await prisma.masterCategory.findUnique({ where: { key: req.params.key }, select: { id: true } });
  if (!cat) { res.status(404).json({ error: 'NotFound' }); return; }
  const data = optionSchema.parse(req.body);
  const created = await prisma.masterOption.create({
    data: {
      categoryId: cat.id,
      label: data.label,
      code: data.code ?? null,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
      meta: (data.meta as object | undefined) ?? undefined,
    },
  });
  res.status(201).json(created);
}));
router.put('/options/:id', requireAdmin, asyncHandler(async (req, res) => {
  const data = optionSchema.partial().parse(req.body);
  const updated = await prisma.masterOption.update({
    where: { id: Number(req.params.id) },
    data: {
      label: data.label,
      code: data.code ?? undefined,
      sortOrder: data.sortOrder,
      active: data.active,
      meta: (data.meta as object | undefined) ?? undefined,
    },
  });
  res.json(updated);
}));
router.delete('/options/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.masterOption.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

// ─── Utility: seed defaults + derive from existing data ───────────────
router.post('/sync', requireAdmin, asyncHandler(async (_req, res) => {
  const summary = await syncMasterFromData();
  res.json({ ok: true, summary });
}));
router.post('/seed-defaults', requireAdmin, asyncHandler(async (_req, res) => {
  await seedMasterDefaults();
  res.json({ ok: true });
}));

export default router;
