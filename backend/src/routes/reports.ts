import { Router } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { asyncHandler } from '../lib/asyncHandler.js';
import { assembleReportCard } from '../services/reportCard.js';

const router = Router();

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// GET /api/reports/candidate?electionId=X[&candidate=Name][&format=xlsx|json]
// Candidate scorecard — Excel workbook by default, JSON with ?format=json.
router.get(
  '/candidate',
  asyncHandler(async (req, res) => {
    const { electionId } = z.object({ electionId: z.coerce.number().int() }).parse({
      electionId: req.query.electionId,
    });
    const candidate = (req.query.candidate as string) || undefined;
    const card = await assembleReportCard(electionId, candidate);

    if (req.query.format === 'json') {
      res.json(card);
      return;
    }

    const wb = XLSX.utils.book_new();

    // ── Summary sheet ──────────────────────────────────────────────
    const k = card.kpis;
    const summaryRows = [
      { Field: 'Candidate', Value: card.candidate },
      { Field: 'Constituency', Value: `${card.election.assemblyNo}-${card.election.assemblyName}` },
      { Field: 'Election', Value: `${card.election.electionType} ${card.election.electionYear ?? ''}`.trim() },
      { Field: 'Result', Value: k.result },
      { Field: 'Our votes', Value: k.ourVotes },
      { Field: 'Vote share', Value: pct(k.ourShare) },
      { Field: 'Rank', Value: `${k.rank} of ${k.candidatesCount}` },
      { Field: 'Winner', Value: k.leader ?? '—' },
      { Field: 'Winner votes', Value: k.leaderVotes },
      { Field: 'Margin vs winner', Value: k.margin },
      { Field: '', Value: '' },
      { Field: 'Booth: Safe-win', Value: card.boothSummary['Safe-win'] ?? 0 },
      { Field: 'Booth: Marginal-win', Value: card.boothSummary['Marginal-win'] ?? 0 },
      { Field: 'Booth: Swing', Value: card.boothSummary['Swing'] ?? 0 },
      { Field: 'Booth: Marginal-loss', Value: card.boothSummary['Marginal-loss'] ?? 0 },
      { Field: 'Booth: Safe-loss', Value: card.boothSummary['Safe-loss'] ?? 0 },
      { Field: '', Value: '' },
      ...card.recommendations.map((r, i) => ({ Field: `Recommendation ${i + 1}`, Value: r })),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(summaryRows, { header: ['Field', 'Value'] }),
      'Summary',
    );

    // ── Booth targets sheet ────────────────────────────────────────
    const boothRow = (b: (typeof card.strongBooths)[number]) => ({
      Serial: b.serial,
      Booth: b.name ?? '',
      Class: b.classification,
      'Our share': pct(b.ourShare),
      'Top opponent': b.topOpponent ?? '',
      'Opp share': pct(b.topOpponentShare),
      Margin: pct(b.margin),
      Turnout: pct(b.turnoutPct),
      Registered: b.registeredVoters,
      'Valid votes': b.totalValid,
    });
    const boothHeader = [
      'Serial', 'Booth', 'Class', 'Our share', 'Top opponent', 'Opp share',
      'Margin', 'Turnout', 'Registered', 'Valid votes',
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([...card.strongBooths].map(boothRow), { header: boothHeader }),
      'Strong booths',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([...card.weakBooths].map(boothRow), { header: boothHeader }),
      'Weak booths',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        card.gotv.map((b) => ({ ...boothRow(b), 'GOTV score': Math.round(b.gotvScore) })),
        { header: [...boothHeader, 'GOTV score'] },
      ),
      'GOTV',
    );

    // ── Community leaning sheet ─────────────────────────────────────
    const commRows = card.communityLeaning.map((g) => ({
      Community: g.group,
      Voters: g.voters,
      'Leans to (est)': g.leader ?? '',
      'Est share': pct(g.leaderShare),
      Note: 'Statistical estimate (ecological)',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(commRows.length ? commRows : [{ Community: 'No data', Voters: 0 }]),
      'Community leaning',
    );

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fname = `report_${card.election.assemblyName}_${card.candidate}`.replace(/[^A-Za-z0-9_-]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
    res.send(buf);
  }),
);

export default router;
