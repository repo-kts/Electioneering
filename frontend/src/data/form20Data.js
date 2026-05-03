/**
 * Form 20 — Detailed Result Sheet (per polling station)
 * Source: ECI standard format. Columns are the candidates contesting
 * the assembly election, plus rejected / NOTA / total / tendered.
 */

export const FORM20_HEADER = {
  totalElectors: '389706',
  assemblyName: '172-BIHARSHARIF',
  electionType: 'Assembly Election',
};

export const FORM20_CANDIDATES = [
  { key: 'omair', label: 'Omair Khan' },
  { key: 'manoj', label: 'Manoj Kumar' },
  { key: 'valaram', label: 'Valaram Das' },
  { key: 'sunil', label: 'Dr. Sunil Kumar' },
  { key: 'dinesh', label: 'Dinesh Kumar' },
  { key: 'shiv', label: 'Shiv Kumar Yadav' },
  { key: 'manojTanti', label: 'Manoj Kumar Tanti' },
  { key: 'mohit', label: 'Mohit Kumar (Kundan)' },
  { key: 'rakesh', label: 'Rakesh Paswan' },
  { key: 'sarswati', label: 'Sarswati Kumari' },
];

// Each row matches one polling station from the source Form 20 sheet.
// columns: [omair, manoj, valaram, sunil, dinesh, shiv, manojTanti, mohit, rakesh, sarswati,
//           validVotes, rejected, nota, total, tendered]
const RAW = [
  [22, 2, 4, 369, 20, 7, 58, 10, 0, 3, 495, 0, 13, 508, 0],
  [14, 2, 2, 272, 31, 7, 34, 14, 1, 1, 378, 0, 5, 383, 0],
  [170, 4, 1, 264, 14, 3, 3, 7, 3, 4, 473, 0, 13, 486, 0],
  [91, 1, 3, 197, 11, 2, 6, 6, 1, 0, 318, 0, 5, 323, 0],
  [18, 3, 2, 237, 41, 3, 12, 15, 1, 1, 333, 0, 1, 334, 0],
  [25, 3, 10, 336, 32, 5, 9, 7, 3, 1, 431, 0, 3, 434, 0],
  [33, 6, 7, 334, 8, 8, 9, 20, 4, 4, 433, 0, 12, 445, 0],
  [250, 2, 4, 361, 23, 11, 14, 11, 8, 8, 692, 0, 11, 703, 0],
  [82, 1, 7, 310, 13, 0, 3, 4, 1, 0, 421, 0, 8, 429, 0],
  [58, 4, 25, 246, 17, 12, 9, 11, 3, 4, 389, 0, 15, 404, 0],
  [66, 8, 2, 450, 35, 8, 10, 12, 0, 1, 592, 0, 10, 602, 0],
  [79, 3, 2, 389, 31, 11, 26, 4, 5, 0, 550, 0, 8, 558, 0],
  [163, 3, 9, 297, 39, 14, 26, 24, 8, 6, 589, 0, 19, 608, 0],
  [299, 0, 0, 133, 8, 4, 11, 9, 0, 5, 469, 0, 19, 488, 0],
  [141, 2, 4, 185, 10, 9, 10, 18, 2, 1, 382, 0, 18, 400, 0],
  [62, 2, 1, 500, 41, 3, 12, 11, 2, 3, 637, 0, 18, 655, 0],
  [53, 4, 2, 429, 29, 6, 18, 16, 1, 2, 560, 0, 5, 565, 0],
  [110, 1, 7, 375, 33, 6, 12, 6, 2, 3, 555, 0, 9, 564, 0],
  [164, 2, 5, 247, 29, 6, 18, 13, 4, 3, 491, 0, 20, 511, 0],
  [26, 0, 4, 253, 13, 5, 91, 2, 1, 1, 396, 0, 10, 406, 0],
  [131, 6, 6, 299, 38, 24, 227, 20, 4, 5, 760, 0, 12, 772, 0],
  [172, 3, 4, 387, 12, 9, 6, 15, 3, 7, 618, 0, 29, 647, 0],
];

const COL_KEYS = [
  ...FORM20_CANDIDATES.map((c) => c.key),
  'validVotes',
  'rejected',
  'nota',
  'total',
  'tendered',
];

export const FORM20_INITIAL_ROWS = RAW.map((vals, i) => {
  const row = { id: i + 1, serial: i + 1 };
  COL_KEYS.forEach((k, idx) => {
    row[k] = String(vals[idx]);
  });
  return row;
});
