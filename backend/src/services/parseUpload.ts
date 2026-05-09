import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export type ParsedRow = Record<string, string | number | null>;

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
}

const CSV_EXT = /\.csv$/i;
const TSV_EXT = /\.tsv$/i;

export function parseFileBuffer(buffer: Buffer, filename: string): ParseResult {
  try {
    if (CSV_EXT.test(filename)) return parseDelimited(buffer, ',');
    if (TSV_EXT.test(filename)) return parseDelimited(buffer, '\t');
    return parseXlsx(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse file';
    const e = new Error(`Could not parse ${filename}: ${msg}`);
    (e as Error & { status?: number }).status = 400;
    throw e;
  }
}

function parseXlsx(buffer: Buffer): ParseResult {
  // xlsx supports xlsx/xlsm/xlsb/xls/ods/fods/csv/txt natively
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return { headers: [], rows: [], totalRows: 0 };
  const sheet = wb.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  });
  const headers = json.length ? Object.keys(json[0]) : [];
  return { headers, rows: json, totalRows: json.length };
}

function parseDelimited(buffer: Buffer, delimiter: string): ParseResult {
  const text = buffer.toString('utf8').replace(/^﻿/, ''); // strip BOM
  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    delimiter,
    transformHeader: (h) => h.trim(),
  });
  const rows = result.data.filter((r) =>
    Object.values(r).some((v) => String(v ?? '').trim() !== ''),
  );
  const headers = result.meta.fields ?? (rows.length ? Object.keys(rows[0]) : []);
  return { headers, rows, totalRows: rows.length };
}

// ─── Column key normalization (header → canonical voter field) ───────
const VOTER_HEADER_MAP: Record<string, string> = {
  // First Name
  firstname: 'firstName',
  'first name': 'firstName',
  'pratham naam': 'firstName',
  // Last Name
  lastname: 'lastName',
  'last name': 'lastName',
  surname: 'lastName',
  upnaam: 'lastName',
  // Relative
  relfirstname: 'relFirstName',
  "relative's first name": 'relFirstName',
  'relative first name': 'relFirstName',
  rellastname: 'relLastName',
  "relative's last name": 'relLastName',
  'relative last name': 'relLastName',
  // Demographics
  age: 'age',
  gender: 'gender',
  // EPIC + mobile
  epic: 'epic',
  'epic no': 'epic',
  'epic number': 'epic',
  mobile: 'mobile',
  'mobile number': 'mobile',
  'mobile no': 'mobile',
  phone: 'mobile',
  // Geography
  state: 'state',
  parlno: 'parlNo',
  'parl no': 'parlNo',
  'parliamentary constituency number': 'parlNo',
  parlname: 'parlName',
  'parl name': 'parlName',
  'parliamentary constituency name': 'parlName',
  assemblyno: 'assemblyNo',
  'asm no': 'assemblyNo',
  'assembly no': 'assemblyNo',
  'assembly constituency number': 'assemblyNo',
  assemblyname: 'assemblyName',
  'asm name': 'assemblyName',
  'assembly name': 'assemblyName',
  'assembly constituency name': 'assemblyName',
  pollingstation: 'pollingStationName',
  'polling station': 'pollingStationName',
  partnumber: 'partNumber',
  'part number': 'partNumber',
  'part no': 'partNumber',
  partname: 'partName',
  'part name': 'partName',
  partserial: 'partSerial',
  'part serial': 'partSerial',
  'part serial number': 'partSerial',
  pollingdate: 'pollingDate',
  'polling date': 'pollingDate',
};

export function normalizeVoterRows(rows: ParsedRow[]): ParsedRow[] {
  return rows.map((raw) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = VOTER_HEADER_MAP[k.toLowerCase().trim()] ?? k;
      out[key] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  });
}

// ─── Form 20 normalizer ──────────────────────────────────────────────
// Expected columns: serial / PS#, then candidate-name columns, then
// rejected, nota, total, tendered. Candidate names are dynamic.
const FORM20_RESERVED = new Set([
  'serial',
  'serial no',
  'serial no.',
  'sl',
  'sl no',
  'ps',
  'ps#',
  'ps no',
  'polling station',
  'polling station no',
  'polling station name',
  'valid votes',
  'total valid',
  'no of valid votes',
  'rejected',
  'rejected votes',
  'no of rejected',
  'no of rejected votes',
  'nota',
  'total',
  'total votes',
  'tendered',
  'tendered votes',
  'no of tendered votes',
]);

export interface Form20Preview {
  candidates: string[];
  rows: Array<{
    serial: number;
    name?: string;
    votes: Record<string, number>;
    rejectedVotes: number;
    notaVotes: number;
    tenderedVotes: number;
    total: number;
    __errors: Record<string, string>;
  }>;
  errorCount: number;
  validCount: number;
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export function normalizeForm20(parsed: ParseResult): Form20Preview {
  const lowerHeaders = parsed.headers.map((h) => h.toLowerCase().trim());
  // Detect candidate columns = headers not in reserved set
  const candidateCols = parsed.headers.filter(
    (h) => !FORM20_RESERVED.has(h.toLowerCase().trim()),
  );

  // Try to identify reserved-purpose headers in original casing
  const findHeader = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const idx = lowerHeaders.indexOf(k);
      if (idx >= 0) return parsed.headers[idx];
    }
    return undefined;
  };
  const serialKey = findHeader('serial', 'serial no', 'sl', 'sl no', 'ps', 'ps#', 'ps no');
  const psNameKey = findHeader('polling station', 'polling station name');
  const rejectedKey = findHeader('rejected', 'rejected votes', 'no of rejected votes');
  const notaKey = findHeader('nota');
  const totalKey = findHeader('total', 'total votes');
  const tenderedKey = findHeader('tendered', 'tendered votes', 'no of tendered votes');
  // Remove reserved keys from candidate cols
  const reserved = new Set([serialKey, psNameKey, rejectedKey, notaKey, totalKey, tenderedKey].filter(Boolean) as string[]);
  // Also remove "valid votes" if present
  const validKey = findHeader('valid votes', 'total valid', 'no of valid votes');
  if (validKey) reserved.add(validKey);
  const cleanedCandidates = candidateCols.filter((c) => !reserved.has(c));

  const NONNEG_INT = /^\d+$/;
  const checkNonneg = (raw: unknown): string | null => {
    const s = String(raw ?? '').replace(/,/g, '').trim();
    if (s === '') return null; // blank treated as 0
    return NONNEG_INT.test(s) ? null : `must be nonneg integer (got "${s}")`;
  };
  const checkPos = (raw: unknown): string | null => {
    const s = String(raw ?? '').replace(/,/g, '').trim();
    if (s === '') return 'required';
    if (!NONNEG_INT.test(s)) return `must be positive integer (got "${s}")`;
    if (Number(s) < 1) return 'must be ≥ 1';
    return null;
  };

  const rows = parsed.rows.map((r, i) => {
    const errs: Record<string, string> = {};
    const serialRaw = serialKey ? r[serialKey] : r.serial;
    const serialErr = checkPos(serialRaw);
    if (serialErr) errs.serial = serialErr;
    const serial = num(serialRaw) || i + 1;

    const votes: Record<string, number> = {};
    for (const c of cleanedCandidates) {
      const e = checkNonneg(r[c]);
      if (e) errs[c] = e;
      votes[c] = num(r[c]);
    }
    const validSum = Object.values(votes).reduce((a, b) => a + b, 0);
    const rejectedRaw = rejectedKey ? r[rejectedKey] : 0;
    const notaRaw = notaKey ? r[notaKey] : 0;
    const tenderedRaw = tenderedKey ? r[tenderedKey] : 0;
    const totalRaw = totalKey ? r[totalKey] : null;
    const re = checkNonneg(rejectedRaw);
    if (re) errs.rejectedVotes = re;
    const ne = checkNonneg(notaRaw);
    if (ne) errs.notaVotes = ne;
    const te = checkNonneg(tenderedRaw);
    if (te) errs.tenderedVotes = te;
    if (totalKey) {
      const tte = checkNonneg(totalRaw);
      if (tte) errs.total = tte;
    }

    const rejectedVotes = num(rejectedRaw);
    const notaVotes = num(notaRaw);
    const tenderedVotes = num(tenderedRaw);
    const total = totalKey ? num(totalRaw) : validSum + rejectedVotes + notaVotes;

    return {
      serial,
      name: psNameKey ? String(r[psNameKey] ?? '').trim() || undefined : undefined,
      votes,
      rejectedVotes,
      notaVotes,
      tenderedVotes,
      total,
      __errors: errs,
    };
  });

  const errorCount = rows.filter((r) => Object.keys(r.__errors).length > 0).length;

  return {
    candidates: cleanedCandidates,
    rows,
    errorCount,
    validCount: rows.length - errorCount,
  };
}
