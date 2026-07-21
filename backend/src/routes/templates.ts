import { Router, Response } from 'express';
import * as XLSX from 'xlsx';

const router = Router();

// Standard per-row voter roll columns. Election identity (state / parliamentary
// / assembly / year / type) is NOT here — it is chosen in the upload screen and
// applied to the whole file. Headers use operator-friendly labels that the
// importer recognizes (see services/parseUpload.ts VOTER_HEADER_MAP).
const VOTER_HEADERS = [
  'Election ID',
  'Name',
  'Relation',
  'Father Name',
  'EPIC Number',
  'age',
  'gender',
  'mobile',
  'House Number',
  'Section No',
  'Section Name',
  'Part Number',
  'Booth Name',
  'Polling Station Name',
  'Main Town',
  'Ward',
  'Post Office',
  'Police Station',
  'Panchayat',
  'Block',
  'Tehsil',
  'Mandal',
  'Revenue Division',
  'Subdivision',
  'District',
  'Pin Code',
  'Caste',
  'Community',
  'Category',
  'Religion',
  'Occupation',
  'Language',
];

const VOTER_SAMPLE: Record<string, string | number> = {
  'Election ID': 1,
  Name: 'Sebastiao Xavier Fernandes',
  Relation: 'Father',
  'Father Name': 'Xavier Fernandes',
  'EPIC Number': 'TRW0273011',
  age: 78,
  gender: 'Male',
  mobile: '9876543210',
  'House Number': '3',
  'Section No': '1',
  'Section Name': 'Near Church, Tiracol',
  'Part Number': '1',
  'Booth Name': 'Booth 1 — Room A',
  'Polling Station Name': 'Government Primary School, Tiracol',
  'Main Town': 'TIRACOL',
  Ward: '',
  'Post Office': 'ARAMBOL',
  'Police Station': 'MANDREM',
  Panchayat: '',
  Block: 'PERNEM',
  Tehsil: '',
  Mandal: '',
  'Revenue Division': '',
  Subdivision: 'PERNEM',
  District: 'NORTH GOA',
  'Pin Code': '403524',
  Caste: '',
  Community: 'Gen',
  Category: '',
  Religion: 'Christian',
  Occupation: 'Fisherman',
  Language: 'Konkani',
};

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function sendSheet(
  res: Response,
  headers: string[],
  rows: Record<string, string | number>[],
  name: string,
  format: string,
  sheetName: string,
): void {
  if (format === 'csv') {
    const lines = [headers.map((h) => csvEscape(h)).join(',')];
    for (const r of rows) {
      lines.push(headers.map((h) => csvEscape(String(r[h] ?? ''))).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    res.send(lines.join('\n'));
    return;
  }

  const ws = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header: headers })
    : XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  res.send(buf);
}

// GET /api/templates/voter[?sample=1][&format=csv][&electionType=Assembly Election]
// `electionType` is accepted so the download can be tailored per the UI's
// selection. The per-row roll columns are the same across current election
// types; the hook is here for future type-specific variations.
router.get('/voter', (req, res) => {
  const sample = req.query.sample === '1';
  const format = String(req.query.format ?? '').toLowerCase();
  const electionType = String(req.query.electionType ?? '').trim();
  const electionId = Number(req.query.electionId);
  const hasElectionId = Number.isFinite(electionId) && electionId > 0;
  // Blank template with only the Election ID pre-filled in row 2 (unless a full
  // sample was explicitly requested).
  const rows = sample
    ? [hasElectionId ? { ...VOTER_SAMPLE, 'Election ID': electionId } : VOTER_SAMPLE]
    : hasElectionId
      ? [{ 'Election ID': electionId }]
      : [];
  const slug = electionType ? electionType.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : '';
  const base = sample ? 'voters_sample' : 'voters_template';
  sendSheet(res, VOTER_HEADERS, rows, slug ? `${base}_${slug}` : base, format, 'Voters');
});

// GET /api/templates/form20[?candidates=A,B,C][&sample=1][&format=csv]
router.get('/form20', (req, res) => {
  const candidates = String(req.query.candidates ?? 'Candidate 1,Candidate 2,Candidate 3')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const format = String(req.query.format ?? '').toLowerCase();
  const sample = req.query.sample === '1';
  const electionIdParam = Number(req.query.electionId);
  const hasElectionId = Number.isFinite(electionIdParam) && electionIdParam > 0;
  const electionId = hasElectionId ? electionIdParam : 1;
  const headers = [
    'electionId',
    'serial',
    ...candidates,
    'rejected',
    'nota',
    'total',
    'tendered',
  ];
  const rows: Record<string, string | number>[] = [];
  if (sample) {
    const validSum = 100 * candidates.length;
    rows.push({
      electionId,
      serial: 1,
      ...Object.fromEntries(candidates.map((c) => [c, 100])),
      rejected: 0,
      nota: 5,
      total: validSum + 5,
      tendered: 0,
    });
  } else if (hasElectionId) {
    // Blank template with only the Election ID pre-filled in row 2.
    rows.push({ electionId });
  }
  sendSheet(res, headers, rows, sample ? 'form20_sample' : 'form20_template', format, 'Form20');
});

export default router;
