import { Router, Response } from 'express';
import * as XLSX from 'xlsx';

const router = Router();

const VOTER_HEADERS = [
  'firstName',
  'lastName',
  'relFirstName',
  'relLastName',
  'age',
  'gender',
  'epic',
  'mobile',
  'state',
  'parlNo',
  'parlName',
  'assemblyNo',
  'assemblyName',
  'pollingStationName',
  'partNumber',
  'partName',
  'partSerial',
  'community',
  'religion',
  'occupation',
  'language',
];

const VOTER_SAMPLE: Record<string, string | number> = {
  firstName: 'SAHIL',
  lastName: 'SAXENA',
  relFirstName: 'SANJAY',
  relLastName: 'KUMAR',
  age: 23,
  gender: 'Male',
  epic: 'TGK3378866',
  mobile: '9876543210',
  state: 'Bihar',
  parlNo: '29',
  parlName: 'Nalanda',
  assemblyNo: '172',
  assemblyName: 'Biharsharif',
  pollingStationName: 'Madarasa Ajijiya',
  partNumber: '381',
  partName: 'Madarasa Ajijaya Dakshini Bhag',
  partSerial: '283',
  community: 'Kayastha',
  religion: 'Hindu',
  occupation: 'Student',
  language: 'Hindi',
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

// GET /api/templates/voter[?sample=1][&format=csv]
router.get('/voter', (req, res) => {
  const sample = req.query.sample === '1';
  const format = String(req.query.format ?? '').toLowerCase();
  const rows = sample ? [VOTER_SAMPLE] : [];
  sendSheet(
    res,
    VOTER_HEADERS,
    rows,
    sample ? 'voters_sample' : 'voters_template',
    format,
    'Voters',
  );
});

// GET /api/templates/form20[?candidates=A,B,C][&sample=1][&format=csv]
router.get('/form20', (req, res) => {
  const candidates = String(req.query.candidates ?? 'Candidate 1,Candidate 2,Candidate 3')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const format = String(req.query.format ?? '').toLowerCase();
  const sample = req.query.sample === '1';
  const headers = [
    'serial',
    'pollingStation',
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
      serial: 1,
      pollingStation: 'PS-1',
      ...Object.fromEntries(candidates.map((c) => [c, 100])),
      rejected: 0,
      nota: 5,
      total: validSum + 5,
      tendered: 0,
    });
  }
  sendSheet(res, headers, rows, sample ? 'form20_sample' : 'form20_template', format, 'Form20');
});

export default router;
