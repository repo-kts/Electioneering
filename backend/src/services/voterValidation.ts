// Canonical per-row voter validator. Used by both the upload preview
// (to annotate rows with __errors) and the commit endpoint (to drop
// bad rows). Patterns match the frontend RecordForm so manual entry
// and file upload behave identically.

export const EPIC_RE = /^[A-Z]{3}\d{7}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const GENDERS = ['Male', 'Female', 'Other'] as const;
export type Gender = (typeof GENDERS)[number];

export interface VoterClean {
  firstName: string;
  lastName: string;
  relFirstName: string;
  relLastName: string;
  age: number;
  gender: Gender;
  epic: string;
  mobile: string | null;
  state: string;
  parlNo: string;
  parlName: string;
  assemblyNo: string;
  assemblyName: string;
  pollingStationName: string;
  partNumber: string;
  partName: string | null;
  partSerial: string;
  // segmentation (optional)
  community: string | null;
  occupation: string | null;
  language: string | null;
}

export interface VoterValidation {
  ok: boolean;
  errors: Record<string, string>;
  value: VoterClean | null;
}

export function validateVoter(raw: Record<string, unknown>): VoterValidation {
  const errors: Record<string, string> = {};
  const s = (k: string) => String(raw[k] ?? '').trim();
  const sUp = (k: string) => s(k).toUpperCase();
  const required = (k: string, val: string) => {
    if (!val) errors[k] = 'required';
  };

  const firstName = sUp('firstName');
  required('firstName', firstName);
  const lastName = sUp('lastName');
  required('lastName', lastName);
  const relFirstName = sUp('relFirstName');
  required('relFirstName', relFirstName);
  const relLastName = sUp('relLastName');
  required('relLastName', relLastName);

  const ageRaw = s('age');
  let age = NaN;
  if (!ageRaw) {
    errors.age = 'required';
  } else {
    const n = Number(ageRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) errors.age = 'must be integer';
    else if (n < 18 || n > 120) errors.age = 'must be 18..120';
    else age = n;
  }

  const genderRaw = s('gender');
  let gender: Gender = 'Other';
  if (!genderRaw) {
    errors.gender = 'required';
  } else {
    const m = GENDERS.find((g) => g.toLowerCase() === genderRaw.toLowerCase());
    if (m) gender = m;
    else errors.gender = 'must be Male/Female/Other';
  }

  const epic = sUp('epic');
  if (!epic) errors.epic = 'required';
  else if (!EPIC_RE.test(epic)) errors.epic = 'format AAA9999999 (3 letters + 7 digits)';

  const mobileRaw = s('mobile');
  let mobile: string | null = null;
  if (mobileRaw) {
    if (MOBILE_RE.test(mobileRaw)) mobile = mobileRaw;
    else errors.mobile = '10 digits starting 6-9';
  }

  const state = s('state');
  required('state', state);
  const parlNo = s('parlNo');
  required('parlNo', parlNo);
  const parlName = s('parlName');
  required('parlName', parlName);
  const assemblyNo = s('assemblyNo');
  required('assemblyNo', assemblyNo);
  const assemblyName = s('assemblyName');
  required('assemblyName', assemblyName);
  const pollingStationName = s('pollingStationName');
  required('pollingStationName', pollingStationName);
  const partNumber = s('partNumber');
  required('partNumber', partNumber);
  const partSerial = s('partSerial');
  required('partSerial', partSerial);
  const partName = s('partName') || null;

  // Segmentation — all optional, free-text
  const community = s('community') || null;
  const occupation = s('occupation') || null;
  const language = s('language') || null;

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          firstName,
          lastName,
          relFirstName,
          relLastName,
          age,
          gender,
          epic,
          mobile,
          state,
          parlNo,
          parlName,
          assemblyNo,
          assemblyName,
          pollingStationName,
          partNumber,
          partName,
          partSerial,
          community,
          occupation,
          language,
        }
      : null,
  };
}

// ─── Form 20 cell validation ────────────────────────────────────────
const NONNEG_INT_RE = /^\d+$/;

export function isNonnegInt(v: unknown): boolean {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return true; // blank = treat as 0
  return NONNEG_INT_RE.test(s);
}

export function isPosInt(v: unknown): boolean {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return false;
  if (!NONNEG_INT_RE.test(s)) return false;
  return Number(s) >= 1;
}
