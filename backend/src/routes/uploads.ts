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
import { recomputePredictedLeaning } from '../services/inference.js';
import { resolveBoothsByCode, upsertBooth, type ResolvedBooth } from '../services/booths.js';
import { loadSurnameRules, applySurnameRule } from '../services/surnameRules.js';

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

/** True when a master booth belongs to the same constituency as an election.
 *  Matched on assembly number when both have one (UTs with no AC fall back to
 *  the parliamentary number). Identity is UNIQUE_CODE; this only guards against
 *  pasting a code from the wrong constituency into a roll/Form 20. */
function boothMatchesElection(
  b: Pick<ResolvedBooth, 'assemblyNo' | 'parlNo'>,
  e: { assemblyNo: string | null; parlNo: string | null },
): boolean {
  const ba = (b.assemblyNo ?? '').trim();
  const ea = (e.assemblyNo ?? '').trim();
  if (ba && ea) return ba === ea;
  const bp = (b.parlNo ?? '').trim();
  const ep = (e.parlNo ?? '').trim();
  return !!bp && bp === ep;
}

/** Pull the single election id shared by rows (from the sheet column), or null. */
function electionIdFromRows(rows: Array<Record<string, unknown>>): number | null {
  const ids = new Set(
    rows.map((r) => Number(String(r.electionId ?? '').trim())).filter((n) => Number.isInteger(n) && n > 0),
  );
  return ids.size === 1 ? [...ids][0] : null;
}

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
      // Flag unknown / wrong-constituency UNIQUE_CODEs against the sheet's election.
      if (preview.electionId) {
        const election = await prisma.election.findUnique({ where: { id: preview.electionId } });
        const byCode = await resolveBoothsByCode(prisma, preview.rows.map((r) => r.code));
        for (const row of preview.rows) {
          if (!row.code) continue;
          const booth = byCode.get(row.code);
          if (!booth) row.__errors.code = `unknown UNIQUE_CODE "${row.code}" — create the booth in Master → Booths first`;
          else if (election && !boothMatchesElection(booth, election)) {
            row.__errors.code = `UNIQUE_CODE "${row.code}" belongs to a different constituency`;
          }
        }
        preview.errorCount = preview.rows.filter((r) => Object.keys(r.__errors).length > 0).length;
        preview.validCount = preview.rows.length - preview.errorCount;
      }
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
    // Seed blank caste/category/religion from admin surname rules (by last name),
    // then validate WITHOUT the generic name classifier (rules are the source).
    const surnameRules = await loadSurnameRules(prisma);
    const annotated = normalized.map((r) => {
      applySurnameRule(r as Record<string, unknown>, surnameRules);
      const v = validateVoter(r, { classify: false });
      return { ...r, __errors: v.errors };
    });

    // Resolve booth codes against the sheet's election and flag unknown ones.
    const electionId = electionIdFromRows(normalized as Array<Record<string, unknown>>);
    if (electionId) {
      const election = await prisma.election.findUnique({ where: { id: electionId } });
      const codes = annotated.map((r) => String((r as Record<string, unknown>).uniqueCode ?? '').trim());
      const byCode = await resolveBoothsByCode(prisma, codes);
      for (const r of annotated) {
        const code = String((r as Record<string, unknown>).uniqueCode ?? '').trim();
        if (!code) continue; // missing-code already flagged by the validator
        const booth = byCode.get(code);
        if (!booth) r.__errors.uniqueCode = `unknown UNIQUE_CODE "${code}" — create the booth in Master → Booths first`;
        else if (election && !boothMatchesElection(booth, election)) {
          r.__errors.uniqueCode = `UNIQUE_CODE "${code}" belongs to a different constituency`;
        }
      }
    }

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

// Split a validated (flat) voter row into the stable Voter columns, the booth
// UNIQUE_CODE, and the per-election BoothVoter roll fields.
function splitVoter(v: VoterClean) {
  const {
    uniqueCode,
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
    code: uniqueCode,
    roll: { partNumber, partName, partSerial, houseNumber, sectionNo, sectionName },
  };
}

// POST /api/uploads/voters/commit  → persist a BATCH of preview rows.
// Each row carries an `electionId` column (created in All-Master) and a
// `UNIQUE_CODE` naming its master booth. Voters are CREATE-ONLY here (new EPICs
// added, existing left as-is); each is placed on the master booth resolved by
// UNIQUE_CODE via a per-election Booth + BoothVoter. Rows whose code is unknown
// or from the wrong constituency are REJECTED (never create a booth). `finalize`
// (last batch) recomputes leaning + logs history.
const voterCommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Excel · API'),
  rows: z.array(z.record(z.string(), z.any())),
  finalize: z.boolean().optional(),
  totalRows: z.coerce.number().int().optional(), // grand total across batches (for history)
});

router.post(
  '/voters/commit',
  asyncHandler(async (req, res) => {
    const { fileName, source, rows, totalRows } = voterCommitSchema.parse(req.body);
    const finalize = req.body?.finalize ?? true;

    const electionId = electionIdFromRows(rows as Array<Record<string, unknown>>);
    if (!electionId) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'All rows must share one Election ID column (create the election in Master Data first).',
      });
      return;
    }
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) {
      res.status(404).json({ error: 'NotFound', message: `Election ${electionId} not found — create it in Master Data.` });
      return;
    }

    const geo = {
      state: election.state,
      parlNo: election.parlNo,
      parlName: election.parlName,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
    };

    // ── Resolve every referenced UNIQUE_CODE up front (importers never create). ──
    const codesInBatch = rows.map((r) => String((r as Record<string, unknown>).uniqueCode ?? '').trim());
    const byCode = await resolveBoothsByCode(prisma, codesInBatch);
    // Surname → caste/category/religion rules, applied to blank cells at import.
    const surnameRules = await loadSurnameRules(prisma);

    // Validate + split each row; drop bad rows (validation) and unknown/foreign codes.
    const voterData: Array<Record<string, unknown>> = [];
    const perRow: Array<{ epic: string; pollingStationId: number; serial: number; partNumber: string | null; roll: Record<string, string | null> }> = [];
    let rowErrors = 0;
    const unknownCodes = new Set<string>();
    for (const r of rows) {
      applySurnameRule(r as Record<string, unknown>, surnameRules);
      const v = validateVoter(r as Record<string, unknown>, { classify: false });
      if (!v.ok || !v.value) { rowErrors++; continue; }
      const { voter, code, roll } = splitVoter(v.value);
      const booth = byCode.get(code);
      if (!booth || !boothMatchesElection(booth, election)) {
        if (code) unknownCodes.add(code);
        rowErrors++;
        continue;
      }
      // Voter geography is INHERITED from the master booth (the roll no longer
      // carries it) — plus state/parl/assembly from the election.
      const boothGeo = {
        mainTown: booth.mainTown,
        ward: booth.ward,
        postOffice: booth.postOffice,
        policeStation: booth.policeStation,
        block: booth.block,
        subdivision: booth.subdivision,
        district: booth.district,
        pinCode: booth.pinCode,
      };
      voterData.push({ ...voter, ...geo, ...boothGeo });
      const serial = Number(booth.partNumber);
      perRow.push({
        epic: voter.epic,
        pollingStationId: booth.id,
        serial: Number.isInteger(serial) && serial >= 1 ? serial : 0,
        partNumber: booth.partNumber,
        roll,
      });
    }

    // ── Upsert the per-election Booth join for each referenced master booth. ──
    const psToBooth = new Map<number, number>();
    const serialByPs = new Map<number, number>();
    for (const r of perRow) {
      if (!serialByPs.has(r.pollingStationId) && r.serial > 0) serialByPs.set(r.pollingStationId, r.serial);
    }
    for (const psId of new Set(perRow.map((r) => r.pollingStationId))) {
      const boothId = await upsertBooth(prisma, {
        electionId,
        pollingStationId: psId,
        serial: serialByPs.get(psId) ?? 0,
      });
      psToBooth.set(psId, boothId);
    }

    // ── Bulk create voters (new EPICs only), then resolve epic→id ──
    const created = await prisma.voter.createMany({ data: voterData as never, skipDuplicates: true });
    const epics = [...new Set(perRow.map((r) => r.epic))];
    const found = epics.length
      ? await prisma.voter.findMany({ where: { epic: { in: epics } }, select: { id: true, epic: true } })
      : [];
    const epicToId = new Map(found.map((v) => [v.epic, v.id]));

    // ── Bulk create the per-election booth links ──
    const bvData = perRow
      .filter((r) => psToBooth.has(r.pollingStationId) && epicToId.has(r.epic))
      .map((r) => ({
        electionId,
        boothId: psToBooth.get(r.pollingStationId) as number,
        voterId: epicToId.get(r.epic) as number,
        partNumber: r.roll.partNumber || r.partNumber || null,
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
      unknownCodes: [...unknownCodes],
      electionId,
      finalized: finalize,
      history,
    });
  }),
);

// POST /api/uploads/form20/commit  → persist parsed Form 20 to an EXISTING
// election. Each row names its master booth by UNIQUE_CODE (resolved, never
// created); unknown / wrong-constituency codes are rejected.
const form20CommitSchema = z.object({
  fileName: z.string(),
  source: z.string().default('Form 20 Excel · API'),
  electionId: z.coerce.number().int(),
  candidates: z.array(z.string().trim().min(1)).min(1),
  rows: z.array(
    z.object({
      code: z.string().trim().min(1),
      serial: z.coerce.number().int().min(0).default(0),
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

    // Resolve all codes; reject the whole upload if any are unknown/foreign so the
    // operator fixes the sheet rather than silently dropping stations.
    const byCode = await resolveBoothsByCode(prisma, body.rows.map((r) => r.code));
    const unknown: string[] = [];
    for (const row of body.rows) {
      const booth = byCode.get(row.code);
      if (!booth || !boothMatchesElection(booth, election)) unknown.push(row.code);
    }
    if (unknown.length) {
      res.status(400).json({
        error: 'BadRequest',
        message: `${unknown.length} UNIQUE_CODE${unknown.length === 1 ? '' : 's'} not found in this constituency: ${[...new Set(unknown)].slice(0, 10).join(', ')}. Create the booth(s) in Master → Booths first.`,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Wipe candidates (cascades to their VoteResults) and recreate them.
      // Booths (the per-election join) are UPSERTED, never deleted — deleting
      // them would cascade-remove the BoothVoter roll mappings.
      await tx.candidate.deleteMany({ where: { electionId: election.id } });

      const createdCands: Record<string, number> = {};
      for (let i = 0; i < body.candidates.length; i++) {
        const c = await tx.candidate.create({
          data: { electionId: election.id, name: body.candidates[i], position: i },
        });
        createdCands[body.candidates[i]] = c.id;
      }

      for (const row of body.rows) {
        const booth = byCode.get(row.code)!;
        const boothId = await upsertBooth(tx, {
          electionId: election.id,
          pollingStationId: booth.id,
          serial: row.serial,
          rejectedVotes: row.rejectedVotes,
          notaVotes: row.notaVotes,
          tenderedVotes: row.tenderedVotes,
        });
        // Replace this booth's vote results.
        await tx.voteResult.deleteMany({ where: { boothId } });
        const voteEntries = Object.entries(row.votes)
          .map(([candName, v]) => ({ boothId, candidateId: createdCands[candName], votes: v }))
          .filter((e) => e.candidateId);
        if (voteEntries.length) {
          await tx.voteResult.createMany({ data: voteEntries });
        }
      }
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

    let inference = { linked: 0, booths: 0, votersUpdated: 0 };
    try {
      const r = await recomputePredictedLeaning(election.id);
      inference = { linked: 0, ...r };
    } catch (err) {
      console.error('[inference] recompute failed', err);
    }

    res.status(201).json({
      electionId: election.id,
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
