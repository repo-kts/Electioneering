// Master-data CRUD — powers the /all-master admin page and feeds every
// dropdown in the app. Reads are open to both roles (data entry needs the
// option lists); writes are admin-only (requireAdmin per mutating route).

import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { syncMasterFromData, seedMasterDefaults } from '../services/master.js';
import { parseFileBuffer, normalizeBoothRows } from '../services/parseUpload.js';
import { upsertMasterBooth } from '../services/booths.js';

const router = Router();

const boothUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xlsm|xlsb|xls|csv|tsv|ods|fods)$/i.test(file.originalname);
    if (!ok) { cb(new Error('Allowed: .xlsx .xlsm .xls .csv .tsv .ods')); return; }
    cb(null, true);
  },
});

/** Resolve a PC (+ optional AC) into the denormalized geo an master booth stores. */
async function resolveBoothGeo(parlId: number, asmId?: number | null) {
  const pc = await prisma.parliamentaryConstituency.findUnique({
    where: { id: parlId },
    include: { state: true },
  });
  if (!pc) {
    const e = new Error('Parliamentary constituency not found — pick one in Master → Geography.');
    (e as Error & { status?: number }).status = 400;
    throw e;
  }
  let ac = null;
  if (asmId) {
    ac = await prisma.assemblyConstituency.findUnique({ where: { id: asmId } });
    if (!ac || ac.parlId !== pc.id) {
      const e = new Error('Assembly constituency does not belong to the chosen parliamentary constituency.');
      (e as Error & { status?: number }).status = 400;
      throw e;
    }
  }
  return {
    parliamentaryConstituencyId: pc.id,
    assemblyConstituencyId: ac?.id ?? null,
    state: pc.state?.name ?? null,
    parlNo: pc.number,
    parlName: pc.name,
    assemblyNo: ac?.number ?? null,
    assemblyName: ac?.name ?? null,
  };
}

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

// ─── Master booths (one stable row per physical booth, keyed by UNIQUE_CODE) ─
// The single source of truth for booths. Created here (single-add or bulk Excel);
// importers only ever look them up by `code`. `code` is immutable once set.
const boothCreateSchema = z.object({
  code: z.string().trim().min(1),
  parliamentaryConstituencyId: z.coerce.number().int(),
  assemblyConstituencyId: z.coerce.number().int().optional().nullable(),
  partNumber: z.string().trim().optional().nullable(),
  boothName: z.string().trim().optional().nullable(),
  pollingStationName: z.string().trim().optional().nullable(),
  mainTown: z.string().trim().optional().nullable(),
  postOffice: z.string().trim().optional().nullable(),
  policeStation: z.string().trim().optional().nullable(),
  block: z.string().trim().optional().nullable(),
  subdivision: z.string().trim().optional().nullable(),
  district: z.string().trim().optional().nullable(),
  pinCode: z.string().trim().optional().nullable(),
  // Free-form location extras (edited from the booth form).
  address: z.string().trim().optional().nullable(),
  cityVillage: z.string().trim().optional().nullable(),
  ward: z.string().trim().optional().nullable(),
  tolaMohalla: z.string().trim().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

// List booths, filtered by PC/AC (preferred) or the legacy assemblyNo/name.
router.get(
  '/polling-stations',
  asyncHandler(async (req, res) => {
    const parlId = req.query.parlId ? Number(req.query.parlId) : undefined;
    const asmId = req.query.asmId ? Number(req.query.asmId) : undefined;
    const assemblyNo = (req.query.assemblyNo as string) || undefined;
    const assemblyName = (req.query.assemblyName as string) || undefined;
    const where: {
      parliamentaryConstituencyId?: number;
      assemblyConstituencyId?: number;
      assemblyNo?: string;
      assemblyName?: string;
    } = {};
    if (parlId) where.parliamentaryConstituencyId = parlId;
    if (asmId) where.assemblyConstituencyId = asmId;
    if (assemblyNo) where.assemblyNo = assemblyNo;
    if (assemblyName) where.assemblyName = assemblyName;
    const rows = await prisma.pollingStation.findMany({
      where,
      orderBy: [{ partNumber: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { booths: true } } },
    });
    const items = rows.map((p) => {
      const { _count, ...rest } = p;
      return { ...rest, electionsCount: _count.booths };
    });
    res.json({ items });
  }),
);

router.post(
  '/polling-stations',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = boothCreateSchema.parse(req.body);
    const existing = await prisma.pollingStation.findUnique({ where: { code: data.code } });
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: `UNIQUE_CODE "${data.code}" already exists.` });
      return;
    }
    const geo = await resolveBoothGeo(data.parliamentaryConstituencyId, data.assemblyConstituencyId);
    const created = await prisma.pollingStation.create({
      data: {
        code: data.code,
        ...geo,
        partNumber: data.partNumber ?? undefined,
        boothName: data.boothName ?? undefined,
        pollingStationName: data.pollingStationName ?? undefined,
        name: data.boothName || data.pollingStationName || undefined,
        mainTown: data.mainTown ?? undefined,
        postOffice: data.postOffice ?? undefined,
        policeStation: data.policeStation ?? undefined,
        block: data.block ?? undefined,
        subdivision: data.subdivision ?? undefined,
        district: data.district ?? undefined,
        pinCode: data.pinCode ?? undefined,
        address: data.address ?? undefined,
        cityVillage: data.cityVillage ?? undefined,
        ward: data.ward ?? undefined,
        tolaMohalla: data.tolaMohalla ?? undefined,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
      },
    });
    res.status(201).json(created);
  }),
);

router.put(
  '/polling-stations/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Editable attributes only — `code` is immutable so the booth's identity
    // (and every result/roll mapped to it) stays stable across years.
    const data = boothCreateSchema.partial().parse(req.body);
    const geo = data.parliamentaryConstituencyId
      ? await resolveBoothGeo(data.parliamentaryConstituencyId, data.assemblyConstituencyId)
      : {};
    const updated = await prisma.pollingStation.update({
      where: { id: Number(req.params.id) },
      data: {
        ...geo,
        partNumber: data.partNumber ?? undefined,
        boothName: data.boothName ?? undefined,
        pollingStationName: data.pollingStationName ?? undefined,
        name: data.boothName || data.pollingStationName || undefined,
        mainTown: data.mainTown ?? undefined,
        postOffice: data.postOffice ?? undefined,
        policeStation: data.policeStation ?? undefined,
        block: data.block ?? undefined,
        subdivision: data.subdivision ?? undefined,
        district: data.district ?? undefined,
        pinCode: data.pinCode ?? undefined,
        address: data.address ?? undefined,
        cityVillage: data.cityVillage ?? undefined,
        ward: data.ward ?? undefined,
        tolaMohalla: data.tolaMohalla ?? undefined,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
      },
    });
    res.json(updated);
  }),
);

router.delete(
  '/polling-stations/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const inUse = await prisma.booth.count({ where: { pollingStationId: id } });
    if (inUse > 0) {
      res.status(409).json({
        error: 'Conflict',
        message: `This booth is used in ${inUse} election${inUse === 1 ? '' : 's'} — remove it from those results first.`,
      });
      return;
    }
    await prisma.pollingStation.delete({ where: { id } });
    res.status(204).end();
  }),
);

// ── Bulk booth creation (Excel, two-phase preview → commit) ──
// POST /master/booths/preview  (multipart file) → normalized rows + per-row flags
router.post(
  '/booths/preview',
  requireAdmin,
  boothUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'BadRequest', message: 'file is required' });
      return;
    }
    const parsed = parseFileBuffer(req.file.buffer, req.file.originalname);
    const rows = normalizeBoothRows(parsed.rows);

    // Existing codes (any constituency) → the row will UPDATE, not create.
    const known = new Set(
      (await prisma.pollingStation.findMany({
        where: { code: { in: [...new Set(rows.map((r) => r.code).filter(Boolean))] } },
        select: { code: true },
      })).map((p) => p.code),
    );

    // First occurrence index per code — later duplicates are flagged.
    const firstSeen = new Map<string, number>();
    rows.forEach((r, i) => { if (r.code && !firstSeen.has(r.code)) firstSeen.set(r.code, i); });

    const out = rows.map((r, i) => {
      const errors: Record<string, string> = {};
      if (!r.code) errors.code = 'UNIQUE_CODE is required';
      else if (firstSeen.get(r.code) !== i) errors.code = `duplicate UNIQUE_CODE in file (first at row ${(firstSeen.get(r.code) ?? 0) + 1})`;
      return { ...r, __exists: r.code ? known.has(r.code) : false, __errors: errors };
    });

    const errorCount = out.filter((r) => Object.keys(r.__errors).length > 0).length;
    const updateCount = out.filter((r) => r.__exists && Object.keys(r.__errors).length === 0).length;
    res.json({
      fileName: req.file.originalname,
      rows: out,
      totalRows: out.length,
      errorCount,
      createCount: out.length - errorCount - updateCount,
      updateCount,
    });
  }),
);

// POST /master/booths/commit  { parlId, asmId?, rows[] } → upsert by UNIQUE_CODE
const boothCommitSchema = z.object({
  parlId: z.coerce.number().int(),
  asmId: z.coerce.number().int().optional().nullable(),
  rows: z.array(
    z.object({
      code: z.string().trim().min(1),
      partNumber: z.string().trim().optional().nullable(),
      boothName: z.string().trim().optional().nullable(),
      pollingStationName: z.string().trim().optional().nullable(),
      mainTown: z.string().trim().optional().nullable(),
      postOffice: z.string().trim().optional().nullable(),
      policeStation: z.string().trim().optional().nullable(),
      block: z.string().trim().optional().nullable(),
      subdivision: z.string().trim().optional().nullable(),
      district: z.string().trim().optional().nullable(),
      pinCode: z.string().trim().optional().nullable(),
    }),
  ),
});

router.post(
  '/booths/commit',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = boothCommitSchema.parse(req.body);
    const geo = await resolveBoothGeo(body.parlId, body.asmId);

    // Reject blank / in-file-duplicate codes so nothing silently collides.
    const seen = new Set<string>();
    for (const r of body.rows) {
      if (!r.code) { res.status(400).json({ error: 'BadRequest', message: 'Every row needs a UNIQUE_CODE.' }); return; }
      if (seen.has(r.code)) { res.status(400).json({ error: 'BadRequest', message: `Duplicate UNIQUE_CODE in file: ${r.code}` }); return; }
      seen.add(r.code);
    }

    let created = 0;
    let updated = 0;
    for (const r of body.rows) {
      const { created: isNew } = await upsertMasterBooth(prisma, { ...r, ...geo });
      if (isNew) created++; else updated++;
    }
    res.status(201).json({ created, updated, total: body.rows.length });
  }),
);

// GET /master/booths/export?parlId=&asmId=[&format=csv] → Excel of booths
const BOOTH_EXPORT_HEADERS = [
  'part_number', 'Booth_Name', 'Polling_Station_Name', 'Main_Town', 'Post_Office',
  'Police_Station', 'Block', 'Subdivision', 'District', 'Pin_Code', 'UNIQUE_CODE',
];
router.get(
  '/booths/export',
  asyncHandler(async (req, res) => {
    const parlId = req.query.parlId ? Number(req.query.parlId) : undefined;
    const asmId = req.query.asmId ? Number(req.query.asmId) : undefined;
    const where: { parliamentaryConstituencyId?: number; assemblyConstituencyId?: number } = {};
    if (parlId) where.parliamentaryConstituencyId = parlId;
    if (asmId) where.assemblyConstituencyId = asmId;
    const booths = await prisma.pollingStation.findMany({
      where,
      orderBy: [{ partNumber: 'asc' }, { name: 'asc' }],
    });
    const rows = booths.map((b) => ({
      part_number: b.partNumber ?? '',
      Booth_Name: b.boothName ?? b.name ?? '',
      Polling_Station_Name: b.pollingStationName ?? '',
      Main_Town: b.mainTown ?? '',
      Post_Office: b.postOffice ?? '',
      Police_Station: b.policeStation ?? '',
      Block: b.block ?? '',
      Subdivision: b.subdivision ?? '',
      District: b.district ?? '',
      Pin_Code: b.pinCode ?? '',
      UNIQUE_CODE: b.code,
    }));
    const ws = rows.length
      ? XLSX.utils.json_to_sheet(rows, { header: BOOTH_EXPORT_HEADERS })
      : XLSX.utils.aoa_to_sheet([BOOTH_EXPORT_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Booths');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="booths_export.xlsx"');
    res.send(buf);
  }),
);

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

// ─── Surname → caste/category/religion rules ──────────────────────────
const surnameRuleSchema = z.object({
  surname: z.string().trim().min(1),
  caste: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  religion: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});

router.get(
  '/surname-rules',
  asyncHandler(async (_req, res) => {
    const items = await prisma.surnameRule.findMany({ orderBy: [{ surname: 'asc' }] });
    res.json({ items });
  }),
);

router.post(
  '/surname-rules',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = surnameRuleSchema.parse(req.body);
    const surname = data.surname.toUpperCase();
    const existing = await prisma.surnameRule.findUnique({ where: { surname } });
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: `A rule for "${surname}" already exists.` });
      return;
    }
    const created = await prisma.surnameRule.create({
      data: {
        surname,
        caste: data.caste ?? null,
        category: data.category ?? null,
        religion: data.religion ?? null,
        active: data.active ?? true,
      },
    });
    res.status(201).json(created);
  }),
);

router.put(
  '/surname-rules/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = surnameRuleSchema.partial().parse(req.body);
    const updated = await prisma.surnameRule.update({
      where: { id: Number(req.params.id) },
      data: {
        surname: data.surname ? data.surname.toUpperCase() : undefined,
        caste: data.caste === undefined ? undefined : data.caste,
        category: data.category === undefined ? undefined : data.category,
        religion: data.religion === undefined ? undefined : data.religion,
        active: data.active,
      },
    });
    res.json(updated);
  }),
);

router.delete(
  '/surname-rules/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.surnameRule.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  }),
);

// Bulk upsert by surname (for pasting a whole surname → group table).
const surnameBulkSchema = z.object({
  rules: z.array(surnameRuleSchema).min(1),
});
router.post(
  '/surname-rules/bulk',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rules } = surnameBulkSchema.parse(req.body);
    let created = 0;
    let updated = 0;
    const seen = new Set<string>();
    for (const r of rules) {
      const surname = r.surname.toUpperCase();
      if (!surname || seen.has(surname)) continue;
      seen.add(surname);
      const existing = await prisma.surnameRule.findUnique({ where: { surname }, select: { id: true } });
      await prisma.surnameRule.upsert({
        where: { surname },
        create: { surname, caste: r.caste ?? null, category: r.category ?? null, religion: r.religion ?? null, active: r.active ?? true },
        update: { caste: r.caste ?? null, category: r.category ?? null, religion: r.religion ?? null },
      });
      if (existing) updated++; else created++;
    }
    res.status(201).json({ created, updated, total: seen.size });
  }),
);

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
