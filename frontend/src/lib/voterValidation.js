// Frontend voter validator. Mirrors backend services/voterValidation.ts so
// the upload preview can re-validate live on every cell edit without a
// round-trip. Keep these patterns in sync with the backend.

export const EPIC_RE = /^[A-Z]{3}\d{7}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const GENDERS = ['Male', 'Female', 'Other'];

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'relFirstName',
  'relLastName',
  'state',
  'parlNo',
  'parlName',
  'assemblyNo',
  'assemblyName',
  'pollingStationName',
  'partNumber',
  'partSerial',
];

export function validateVoterRow(row) {
  const errors = {};
  const s = (k) => String(row[k] ?? '').trim();

  for (const k of REQUIRED_FIELDS) {
    if (!s(k)) errors[k] = 'required';
  }

  const ageRaw = s('age');
  if (!ageRaw) {
    errors.age = 'required';
  } else {
    const n = Number(ageRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) errors.age = 'must be integer';
    else if (n < 18 || n > 120) errors.age = 'must be 18..120';
  }

  const gen = s('gender');
  if (!gen) {
    errors.gender = 'required';
  } else if (!GENDERS.find((g) => g.toLowerCase() === gen.toLowerCase())) {
    errors.gender = 'must be Male / Female / Other';
  }

  const epic = s('epic').toUpperCase();
  if (!epic) errors.epic = 'required';
  else if (!EPIC_RE.test(epic)) errors.epic = 'AAA9999999 (3 letters + 7 digits)';

  const mobile = s('mobile');
  if (mobile && !MOBILE_RE.test(mobile)) {
    errors.mobile = '10 digits starting 6-9';
  }

  const pd = s('pollingDate');
  if (pd) {
    const d = new Date(pd);
    if (!Number.isFinite(d.getTime())) errors.pollingDate = 'invalid date';
  }

  return errors;
}

// ─── Form 20 cell validators ───────────────────────────────────────
const NONNEG_INT_RE = /^\d+$/;

export function form20CellError(field, raw) {
  const v = String(raw ?? '').replace(/,/g, '').trim();
  if (field === 'serial') {
    if (!v) return 'required';
    if (!NONNEG_INT_RE.test(v)) return 'must be positive integer';
    if (Number(v) < 1) return 'must be ≥ 1';
    return null;
  }
  if (field === 'name') return null;
  if (v === '') return null;
  if (!NONNEG_INT_RE.test(v)) return 'must be nonneg integer';
  return null;
}

export function validateForm20Row(row, candidates) {
  const errs = {};
  const sErr = form20CellError('serial', row.serial);
  if (sErr) errs.serial = sErr;
  for (const c of candidates) {
    const e = form20CellError('vote', row.votes?.[c]);
    if (e) errs[c] = e;
  }
  for (const k of ['rejectedVotes', 'notaVotes', 'tenderedVotes']) {
    const e = form20CellError('num', row[k]);
    if (e) errs[k] = e;
  }
  return errs;
}
