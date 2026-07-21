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
import { upsertPollingStation, upsertBooth } from '../services/booths.js';

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

// POST /api/uploads/voters/commit  → persist a BATCH of preview rows.
// Everything comes from the sheet. Each row carries an `electionId` column
// (created in All-Master). Large rolls (30k+) are sent from the client in
// batches; each call bulk-inserts one batch. Voters are CREATE-ONLY here (new
// EPICs added, existing left as-is — corrections use the Edit form); their fixed
// geography is backfilled from the election; and each is placed on a Booth (by
// roll Part Number == booth serial) via a BoothVoter. `finalize` (default true,
// set by the client only on the last batch) recomputes leaning + logs history.
const voterCommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Excel · API'),
  rows: z.array(z.record(z.string(), z.any())),
  finalize: z.boolean().optional(),
  totalRows: z.coerce.number().int().optional(), // grand total across batches (for history)
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
    const { fileName, source, rows, totalRows } = voterCommitSchema.parse(req.body);
    const finalize = req.body?.finalize ?? true;

    const electionId = resolveElectionIdFromRows(rows as Array<Record<string, unknown>>);
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) {
      res.status(404).json({ error: 'NotFound', message: `Election ${electionId} not found — create it in Master Data.` });
      return;
    }

    // Validate + split each row into stable voter data, station, and roll.
    const geo = {
      state: election.state,
      parlNo: election.parlNo,
      parlName: election.parlName,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
    };
    const voterData: Array<Record<string, unknown>> = [];
    const perRow: Array<{ epic: string; serial: number | null; station: { name: string | null; boothName: string | null; address: string | null }; roll: Record<string, string | null> }> = [];
    let rowErrors = 0;
    for (const r of rows) {
      const v = validateVoter(r as Record<string, unknown>);
      if (!v.ok || !v.value) { rowErrors++; continue; }
      const { voter, station, roll } = splitVoter(v.value);
      voterData.push({ ...voter, ...geo });
      const serial = Number(roll.partNumber);
      perRow.push({ epic: voter.epic, serial: Number.isInteger(serial) && serial >= 1 ? serial : null, station, roll });
    }

    // ── Resolve booths ONCE (cached by serial), creating only missing ones ──
    const serialToBooth = new Map<number, number>();
    for (const b of await prisma.booth.findMany({ where: { electionId }, select: { id: true, serial: true } })) {
      serialToBooth.set(b.serial, b.id);
    }
    const newSerials = new Map<number, typeof perRow[number]['station']>();
    for (const r of perRow) {
      if (r.serial == null || serialToBooth.has(r.serial) || newSerials.has(r.serial)) continue;
      newSerials.set(r.serial, r.station);
    }
    for (const [serial, station] of newSerials) {
      const pollingStationId = await upsertPollingStation(
        prisma,
        { assemblyNo: election.assemblyNo, assemblyName: election.assemblyName, name: station.name, address: station.address },
        serial,
      );
      const boothId = await upsertBooth(prisma, { electionId, pollingStationId, serial, name: station.boothName || station.name });
      serialToBooth.set(serial, boothId);
    }

    // ── Bulk create voters (new EPICs only), then resolve epic→id ──
    const created = await prisma.voter.createMany({ data: voterData as never, skipDuplicates: true });
    const epics = [...new Set(perRow.map((r) => r.epic))];
    const found = await prisma.voter.findMany({ where: { epic: { in: epics } }, select: { id: true, epic: true } });
    const epicToId = new Map(found.map((v) => [v.epic, v.id]));

    // ── Bulk create the per-election booth links ──
    const bvData = perRow
      .filter((r) => r.serial != null && serialToBooth.has(r.serial) && epicToId.has(r.epic))
      .map((r) => ({
        electionId,
        boothId: serialToBooth.get(r.serial as number) as number,
        voterId: epicToId.get(r.epic) as number,
        partNumber: r.roll.partNumber || null,
        partName: r.roll.partName || null,
        partSerial: r.roll.partSerial || null,
        houseNumber: r.roll.houseNumber || null,
        sectionNo: r.roll.sectionNo || null,
        sectionName: r.roll.sectionName || null,
      }));
    const linkedRes = bvData.length ? await prisma.boothVoter.createMany({ data: bvData, skipDuplicates: true }) : { count: 0 };

    let history = null;
    if (finalize) {
      history = await prisma.uploadHistory.create({
        data: {
          fileName,
          source,
          kind: 'voter',
          records: totalRows ?? created.count,
          constituency: `${election.assemblyNo}-${election.assemblyName}`,
          status: 'validated',
        },
      });
      try {
        await recomputePredictedLeaning(electionId);
      } catch (err) {
        console.error('[inference] recompute after voter upload failed', err);
      }
    }

    res.status(201).json({
      inserted: created.count,   // NEW voters in this batch
      linked: linkedRes.count,   // new booth links in this batch
      requested: rows.length,
      skipped: rowErrors,
      electionId,
      finalized: finalize,
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
  // Form 20 rows carry only serial (= booth number) + per-candidate votes +
  // tallies. Booth name / polling station come from the voter roll, matched by
  // this serial — they are NOT in the Form 20 sheet.
  rows: z.array(
    z.object({
      serial: z.coerce.number().int().min(1),
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
        // Match the booth by (election, serial). The voter roll owns the booth
        // name + building — so we NEVER overwrite them here; we only set the
        // vote tallies. If the booth doesn't exist yet (Form 20 uploaded before
        // the roll), create it with a serial-based placeholder building that the
        // voter upload later refines.
        const tallies = {
          rejectedVotes: row.rejectedVotes,
          notaVotes: row.notaVotes,
          tenderedVotes: row.tenderedVotes,
        };
        const existing = await tx.booth.findUnique({
          where: { electionId_serial: { electionId: election.id, serial: row.serial } },
          select: { id: true },
        });
        let boothId: number;
        if (existing) {
          await tx.booth.update({ where: { id: existing.id }, data: tallies });
          boothId = existing.id;
        } else {
          const pollingStationId = await upsertPollingStation(
            tx,
            { assemblyNo: election.assemblyNo, assemblyName: election.assemblyName, name: null },
            row.serial,
          );
          const created = await tx.booth.create({
            data: { electionId: election.id, pollingStationId, serial: row.serial, ...tallies },
          });
          boothId = created.id;
        }
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
