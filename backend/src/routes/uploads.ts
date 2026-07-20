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
import { validateVoter, type VoterClean } from '../services/voterValidation.js';
import { recomputePredictedLeaning, linkRollToBooths } from '../services/inference.js';
import { upsertPollingStation, upsertBooth, upsertBoothVoter } from '../services/booths.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xlsm|xlsb|xls|csv|tsv|ods|fods)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error('Allowed: .xlsx .xlsm .xlsb .xls .csv .tsv .ods .fods'));
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

    const normalized = normalizeVoterRows(parsed.rows);
    const annotated = normalized.map((r) => {
      const v = validateVoter(r);
      return { ...r, __errors: v.errors };
    });
    const errorCount = annotated.filter((r) => Object.keys(r.__errors).length > 0).length;
    res.json({
      kind: 'voter',
      fileName: req.file.originalname,
      size: req.file.size,
      headers: parsed.headers,
      rows: annotated,
      totalRows: annotated.length,
      validCount: annotated.length - errorCount,
      errorCount,
    });
  }),
);

// Split a validated (flat) voter row into the stable Voter columns vs the
// per-election BoothVoter roll fields.
function splitVoter(v: VoterClean) {
  const {
    pollingStationName,
    pollingStationAddress,
    boothName,
    partNumber,
    partName,
    partSerial,
    houseNumber,
    sectionNo,
    sectionName,
    ...voter
  } = v;
  return {
    voter, // stable identity + demographics
    station: { name: pollingStationName || null, address: pollingStationAddress, boothName: boothName || null },
    roll: { partNumber, partName, partSerial, houseNumber, sectionNo, sectionName },
  };
}

// POST /api/uploads/voters/commit  → persist preview rows.
// Everything comes from the sheet. Each row carries an `electionId` column
// (created in All-Master). Voters are upserted by stable EPIC (details refreshed
// on re-upload); their fixed geography is backfilled from the election; and each
// is placed on a Booth (by roll Part Number == booth serial) via a BoothVoter.
const voterCommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Excel · API'),
  rows: z.array(z.record(z.string(), z.any())),
});

/** Pull the single election id shared by all rows (from the sheet column). */
function resolveElectionIdFromRows(rows: Array<Record<string, unknown>>): number {
  const ids = new Set(
    rows.map((r) => Number(String(r.electionId ?? '').trim())).filter((n) => Number.isInteger(n) && n > 0),
  );
  if (ids.size === 0) {
    const e = new Error('Every row needs an Election ID column (create the election in Master Data first).');
    (e as Error & { status?: number }).status = 400;
    throw e;
  }
  if (ids.size > 1) {
    const e = new Error(`All rows must share one Election ID (found ${ids.size}). One file = one election.`);
    (e as Error & { status?: number }).status = 400;
    throw e;
  }
  return [...ids][0];
}

router.post(
  '/voters/commit',
  asyncHandler(async (req, res) => {
    const { fileName, source, rows } = voterCommitSchema.parse(req.body);

    const electionId = resolveElectionIdFromRows(rows as Array<Record<string, unknown>>);
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) {
      res.status(404).json({ error: 'NotFound', message: `Election ${electionId} not found — create it in Master Data.` });
      return;
    }

    const cleaned: VoterClean[] = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];

    rows.forEach((r, i) => {
      const v = validateVoter(r as Record<string, unknown>);
      if (v.ok && v.value) {
        cleaned.push(v.value);
      } else {
        for (const [field, msg] of Object.entries(v.errors)) {
          errors.push({ row: i + 1, field, message: msg });
        }
      }
    });

    // Fixed-for-the-file geography comes from the election, not per-row columns.
    const geo = {
      state: election.state,
      parlNo: election.parlNo,
      parlName: election.parlName,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
    };

    let inserted = 0;
    let linked = 0;
    for (const c of cleaned) {
      const { voter, station, roll } = splitVoter(c);
      const voterData = { ...voter, ...geo };
      const saved = await prisma.voter.upsert({
        where: { epic: voter.epic },
        create: voterData,
        update: voterData,
        select: { id: true },
      });
      inserted++;

      const serial = Number(roll.partNumber);
      if (Number.isInteger(serial) && serial >= 1) {
        const pollingStationId = await upsertPollingStation(
          prisma,
          {
            assemblyNo: election.assemblyNo,
            assemblyName: election.assemblyName,
            name: station.name,
            address: station.address,
          },
          serial,
        );
        const boothId = await upsertBooth(prisma, { electionId, pollingStationId, serial, name: station.boothName || station.name });
        await upsertBoothVoter(prisma, { electionId, boothId, voterId: saved.id, roll });
        linked++;
      }
    }

    const history = await prisma.uploadHistory.create({
      data: {
        fileName,
        source,
        kind: 'voter',
        records: inserted,
        constituency: `${election.assemblyNo}-${election.assemblyName}`,
        status: errors.length === 0 ? 'validated' : 'failed',
        errorMsg: errors.length ? `${errors.length} field error(s) across ${rows.length - cleaned.length} row(s)` : null,
      },
    });

    // Recompute predicted leaning if Form 20 already exists for this election.
    try {
      await recomputePredictedLeaning(electionId);
    } catch (err) {
      console.error('[inference] recompute after voter upload failed', err);
    }

    res.status(201).json({
      inserted,
      requested: rows.length,
      skipped: rows.length - cleaned.length,
      linked,
      electionId,
      errors,
      history,
    });
  }),
);

// POST /api/uploads/form20/commit  → persist parsed Form 20 to an EXISTING
// election (created in All-Master). The sheet carries the Election ID; no
// election header fields are collected in the UI. Candidates are created from
// the sheet's candidate columns (party/alliance are mapped later in Master).
const form20CommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Form 20 Excel · API'),
  electionId: z.coerce.number().int(),
  candidates: z.array(z.string().trim().min(1)).min(1),
  rows: z.array(
    z.object({
      serial: z.coerce.number().int().min(1),
      name: z.string().optional(),      // polling station (building) name
      boothName: z.string().optional(), // booth's own name
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

    const election = await prisma.election.findUnique({ where: { id: body.electionId } });
    if (!election) {
      res.status(404).json({ error: 'NotFound', message: `Election ${body.electionId} not found — create it in Master Data.` });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Wipe candidates (cascades to their VoteResults) and recreate them.
      // Booths are UPSERTED, never deleted — deleting them would cascade-remove
      // the BoothVoter roll mappings created by the voter upload.
      await tx.candidate.deleteMany({ where: { electionId: election.id } });

      const createdCands: Record<string, number> = {};
      for (let i = 0; i < body.candidates.length; i++) {
        const c = await tx.candidate.create({
          data: { electionId: election.id, name: body.candidates[i], position: i },
        });
        createdCands[body.candidates[i]] = c.id;
      }

      for (const row of body.rows) {
        // Building = polling station name; booth = booth name (falls back to it).
        const pollingStationId = await upsertPollingStation(
          tx,
          { assemblyNo: election.assemblyNo, assemblyName: election.assemblyName, name: row.name },
          row.serial,
        );
        const boothId = await upsertBooth(tx, {
          electionId: election.id,
          pollingStationId,
          serial: row.serial,
          name: row.boothName || row.name,
          rejectedVotes: row.rejectedVotes,
          notaVotes: row.notaVotes,
          tenderedVotes: row.tenderedVotes,
        });
        const voteEntries = Object.entries(row.votes)
          .map(([candName, v]) => ({
            boothId,
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
        constituency: `${election.assemblyNo}-${election.assemblyName}`,
        status: 'validated',
      },
    });

    // Link any roll entries to their booths (by serial/name) then recompute leaning
    let inference = { linked: 0, booths: 0, votersUpdated: 0 };
    try {
      const linked = await linkRollToBooths(result.id);
      const r = await recomputePredictedLeaning(result.id);
      inference = { linked, ...r };
    } catch (err) {
      console.error('[inference] recompute failed', err);
    }

    res.status(201).json({
      electionId: result.id,
      polling: body.rows.length,
      history,
      inference,
    });
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
