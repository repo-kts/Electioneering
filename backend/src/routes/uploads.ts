import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  parseFileBuffer,
  normalizeVoterRows,
  normalizeForm20,
} from '../services/parseUpload.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error('Only .xlsx/.xls/.csv allowed'));
      return;
    }
    cb(null, true);
  },
});

// POST /api/uploads/preview?kind=voter|form20
// → returns parsed preview (no DB write). Frontend reviews before commit.
router.post(
  '/preview',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'BadRequest', message: 'file is required' });
      return;
    }
    const kind = (req.query.kind as string) || 'voter';
    const parsed = parseFileBuffer(req.file.buffer, req.file.originalname);

    if (kind === 'form20') {
      const preview = normalizeForm20(parsed);
      res.json({
        kind,
        fileName: req.file.originalname,
        size: req.file.size,
        ...preview,
        totalRows: preview.rows.length,
      });
      return;
    }

    const rows = normalizeVoterRows(parsed.rows);
    res.json({
      kind: 'voter',
      fileName: req.file.originalname,
      size: req.file.size,
      headers: parsed.headers,
      rows,
      totalRows: rows.length,
    });
  }),
);

// POST /api/uploads/voters/commit  → persist preview rows
const voterCommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Excel · API'),
  rows: z.array(z.record(z.string(), z.any())),
});

router.post(
  '/voters/commit',
  asyncHandler(async (req, res) => {
    const { fileName, source, rows } = voterCommitSchema.parse(req.body);

    const cleaned = rows
      .map((r) => ({
        firstName: String(r.firstName ?? '').trim().toUpperCase(),
        lastName: String(r.lastName ?? '').trim().toUpperCase(),
        relFirstName: String(r.relFirstName ?? '').trim().toUpperCase(),
        relLastName: String(r.relLastName ?? '').trim().toUpperCase(),
        age: Number(r.age),
        gender: (['Male', 'Female', 'Other'] as const).includes(r.gender)
          ? (r.gender as 'Male' | 'Female' | 'Other')
          : 'Other',
        epic: String(r.epic ?? '').trim().toUpperCase(),
        mobile: r.mobile ? String(r.mobile).trim() : null,
        state: String(r.state ?? '').trim(),
        parlNo: String(r.parlNo ?? '').trim(),
        parlName: String(r.parlName ?? '').trim(),
        assemblyNo: String(r.assemblyNo ?? '').trim(),
        assemblyName: String(r.assemblyName ?? '').trim(),
        pollingStationName: String(r.pollingStationName ?? '').trim(),
        partNumber: String(r.partNumber ?? '').trim(),
        partName: r.partName ? String(r.partName).trim() : null,
        partSerial: String(r.partSerial ?? '').trim(),
        pollingDate: r.pollingDate ? new Date(r.pollingDate) : null,
      }))
      .filter((r) => r.firstName && r.lastName && r.epic);

    const result = await prisma.voter.createMany({
      data: cleaned,
      skipDuplicates: true,
    });

    const history = await prisma.uploadHistory.create({
      data: {
        fileName,
        source,
        kind: 'voter',
        records: result.count,
        status: 'validated',
      },
    });

    res.status(201).json({ inserted: result.count, requested: rows.length, history });
  }),
);

// POST /api/uploads/form20/commit  → persist parsed Form 20 to a (new) election
const form20CommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Form 20 Excel · API'),
  // Election header
  state: z.string(),
  parlNo: z.string(),
  parlName: z.string(),
  assemblyNo: z.string(),
  assemblyName: z.string(),
  electionType: z.string().default('Assembly Election'),
  totalElectors: z.coerce.number().int().nonnegative().optional(),
  candidates: z.array(z.string().trim().min(1)).min(1),
  rows: z.array(
    z.object({
      serial: z.coerce.number().int().min(1),
      name: z.string().optional(),
      votes: z.record(z.string(), z.coerce.number().int().nonnegative()),
      rejectedVotes: z.coerce.number().int().nonnegative().default(0),
      notaVotes: z.coerce.number().int().nonnegative().default(0),
      tenderedVotes: z.coerce.number().int().nonnegative().default(0),
    }),
  ),
});

router.post(
  '/form20/commit',
  asyncHandler(async (req, res) => {
    const body = form20CommitSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // upsert election by (assemblyNo, assemblyName)
      const election = await tx.election.upsert({
        where: {
          assemblyNo_assemblyName: {
            assemblyNo: body.assemblyNo,
            assemblyName: body.assemblyName,
          },
        },
        update: {
          state: body.state,
          parlNo: body.parlNo,
          parlName: body.parlName,
          electionType: body.electionType,
          totalElectors: body.totalElectors,
        },
        create: {
          state: body.state,
          parlNo: body.parlNo,
          parlName: body.parlName,
          assemblyNo: body.assemblyNo,
          assemblyName: body.assemblyName,
          electionType: body.electionType,
          totalElectors: body.totalElectors,
        },
      });

      // wipe and recreate candidates + polling stations
      await tx.pollingStation.deleteMany({ where: { electionId: election.id } });
      await tx.candidate.deleteMany({ where: { electionId: election.id } });

      const createdCands: Record<string, number> = {};
      for (let i = 0; i < body.candidates.length; i++) {
        const c = await tx.candidate.create({
          data: { electionId: election.id, name: body.candidates[i], position: i },
        });
        createdCands[body.candidates[i]] = c.id;
      }

      for (const row of body.rows) {
        const ps = await tx.pollingStation.create({
          data: {
            electionId: election.id,
            serial: row.serial,
            name: row.name,
            rejectedVotes: row.rejectedVotes,
            notaVotes: row.notaVotes,
            tenderedVotes: row.tenderedVotes,
          },
        });
        const voteEntries = Object.entries(row.votes)
          .map(([candName, v]) => ({
            pollingStationId: ps.id,
            candidateId: createdCands[candName],
            votes: v,
          }))
          .filter((e) => e.candidateId);
        if (voteEntries.length) {
          await tx.voteResult.createMany({ data: voteEntries });
        }
      }

      return election;
    });

    const history = await prisma.uploadHistory.create({
      data: {
        fileName: body.fileName,
        source: body.source,
        kind: 'form20',
        records: body.rows.length,
        constituency: `${body.assemblyNo}-${body.assemblyName}`,
        status: 'validated',
      },
    });

    res.status(201).json({ electionId: result.id, polling: body.rows.length, history });
  }),
);

// GET /api/uploads/history
router.get(
  '/history',
  asyncHandler(async (_req, res) => {
    const items = await prisma.uploadHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items });
  }),
);

export default router;
