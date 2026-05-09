import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  segmentSchema,
  buildVoterWhere,
  passesLeaningFilter,
  aggregate,
} from '../services/segmentation.js';

const router = Router();

const cohortSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  criteria: z.unknown(), // validated against segmentSchema on use
});

const EXPORT_HEADERS = [
  'firstName', 'lastName', 'relFirstName', 'relLastName',
  'age', 'gender', 'epic', 'mobile',
  'state', 'parlNo', 'parlName', 'assemblyNo', 'assemblyName',
  'pollingStationName', 'partNumber', 'partName', 'partSerial',
  'community', 'religion', 'occupation', 'language',
  'predictedLeader', 'predictedLeaderShare',
];

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

interface VoterRow {
  firstName: string; lastName: string; relFirstName: string; relLastName: string;
  age: number; gender: string; epic: string; mobile: string | null;
  state: string; parlNo: string; parlName: string;
  assemblyNo: string; assemblyName: string;
  pollingStationName: string; partNumber: string; partName: string | null;
  partSerial: string;
  community: string | null; religion: string | null;
  occupation: string | null; language: string | null;
  predictedLeaning?: unknown;
}

function rowToCsv(v: VoterRow): string {
  const lean = v.predictedLeaning as { leader?: string; leaderShare?: number } | null;
  const cells = [
    v.firstName, v.lastName, v.relFirstName, v.relLastName,
    String(v.age), v.gender, v.epic, v.mobile ?? '',
    v.state, v.parlNo, v.parlName, v.assemblyNo, v.assemblyName,
    v.pollingStationName, v.partNumber, v.partName ?? '', v.partSerial,
    v.community ?? '', v.religion ?? '', v.occupation ?? '', v.language ?? '',
    lean?.leader ?? '', lean?.leaderShare != null ? lean.leaderShare.toFixed(3) : '',
  ];
  return cells.map((c) => csvEscape(String(c))).join(',');
}

function sendCsv(res: Response, name: string, voters: VoterRow[]): void {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const v of voters) lines.push(rowToCsv(v));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(lines.join('\n'));
}

// GET /api/cohorts
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.cohort.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items });
  }),
);

// GET /api/cohorts/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const c = await prisma.cohort.findUnique({ where: { id } });
    if (!c) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json(c);
  }),
);

// POST /api/cohorts
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = cohortSchema.parse(req.body);
    // sanity-check criteria parses
    segmentSchema.parse(data.criteria ?? {});
    const cohort = await prisma.cohort.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        criteria: (data.criteria ?? {}) as object,
      },
    });
    res.status(201).json(cohort);
  }),
);

// PUT /api/cohorts/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = cohortSchema.partial().parse(req.body);
    if (data.criteria !== undefined) segmentSchema.parse(data.criteria ?? {});
    const cohort = await prisma.cohort.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        criteria: data.criteria as object | undefined,
      },
    });
    res.json(cohort);
  }),
);

// DELETE /api/cohorts/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.cohort.delete({ where: { id } });
    res.status(204).end();
  }),
);

// GET /api/cohorts/:id/voters
router.get(
  '/:id/voters',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const cohort = await prisma.cohort.findUnique({ where: { id } });
    if (!cohort) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    const c = segmentSchema.parse((cohort.criteria as object) ?? {});
    const where = buildVoterWhere(c);
    const candidate = await prisma.voter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: c.take + c.skip + 500,
    });
    const filtered = candidate.filter((v) => passesLeaningFilter(v, c));
    const items = filtered.slice(c.skip, c.skip + c.take);
    res.json({
      cohort,
      items,
      total: filtered.length,
      aggregates: aggregate(filtered),
    });
  }),
);

// GET /api/cohorts/:id/export?format=csv  (default csv)
router.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const cohort = await prisma.cohort.findUnique({ where: { id } });
    if (!cohort) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    const c = segmentSchema.parse((cohort.criteria as object) ?? {});
    const where = buildVoterWhere(c);
    const candidate = await prisma.voter.findMany({ where, take: 10000 });
    const filtered = candidate.filter((v) => passesLeaningFilter(v, c));
    const slug = cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
    sendCsv(res, slug || 'cohort', filtered);
  }),
);

// POST /api/cohorts/preview-export  → CSV from ad-hoc filter (no save)
router.post(
  '/preview-export',
  asyncHandler(async (req, res) => {
    const c = segmentSchema.parse(req.body ?? {});
    const where = buildVoterWhere(c);
    const candidate = await prisma.voter.findMany({ where, take: 10000 });
    const filtered = candidate.filter((v) => passesLeaningFilter(v, c));
    sendCsv(res, 'voters_export', filtered);
  }),
);

export default router;
