// Canonical per-row voter validator. Used by both the upload preview
// (to annotate rows with __errors) and the commit endpoint (to drop
// bad rows). Patterns match the frontend RecordForm so manual entry
// and file upload behave identically.

import { classifyName } from './nameClassifier.js';

export const EPIC_RE = /^[A-Z]{3}\d{7}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const GENDERS = ['Male', 'Female', 'Other'] as const;
export type Gender = (typeof GENDERS)[number];

// Reservation class — fixed set for the `community` field.
export const COMMUNITIES = ['Gen', 'OBC', 'SC', 'ST'] as const;
export type Community = (typeof COMMUNITIES)[number];

/** Normalise a free-typed community value to the canonical Gen/OBC/SC/ST, or null. */
export function normalizeCommunity(raw: string): Community | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (v === 'GEN' || v === 'GENERAL' || v === 'UR') return 'Gen';
  if (v === 'OBC' || v === 'BC') return 'OBC';
  if (v === 'SC') return 'SC';
  if (v === 'ST') return 'ST';
  return null;
}

export interface VoterClean {
  fullName: string | null;
  firstName: string;
  lastName: string;
  relationType: string | null;
  relativeName: string | null;
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
  pollingStationAddress: string | null;
  partNumber: string;
  partName: string | null;
  partSerial: string;
  // administrative hierarchy (optional)
  houseNumber: string | null;
  sectionNo: string | null;
  sectionName: string | null;
  mainTown: string | null;
  ward: string | null;
  postOffice: string | null;
  policeStation: string | null;
  panchayat: string | null;
  block: string | null;
  tehsil: string | null;
  mandal: string | null;
  revenueDivision: string | null;
  subdivision: string | null;
  district: string | null;
  pinCode: string | null;
  // segmentation (optional / inferred)
  caste: string | null;
  community: string | null; // Gen | OBC | SC | ST
  category: string | null;
  religion: string | null;
  communityConfidence: number | null;
  communitySource: string;
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
  // Relative name is optional on real rolls — default to '' (schema NOT NULL).
  const relFirstName = sUp('relFirstName');
  const relLastName = sUp('relLastName');
  const fullName = s('fullName') || null;
  const relationType = s('relationType') || null;
  const relativeName = s('relativeName') || null;

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

  // Geography — not present on raw electoral rolls (operator/file defaults
  // fill state/parl/assembly). Stored as '' rather than required to NOT block
  // bulk roll imports; schema columns are NOT NULL.
  const state = s('state');
  const parlNo = s('parlNo');
  const parlName = s('parlName');
  const assemblyNo = s('assemblyNo');
  const assemblyName = s('assemblyName');
  const pollingStationName = s('pollingStationName');
  const pollingStationAddress = s('pollingStationAddress') || null;
  const partNumber = s('partNumber');
  const partSerial = s('partSerial');
  const partName = s('partName') || null;

  // Extended administrative hierarchy — all optional.
  const houseNumber = s('houseNumber') || null;
  const sectionNo = s('sectionNo') || null;
  const sectionName = s('sectionName') || null;
  const mainTown = s('mainTown') || null;
  const ward = s('ward') || null;
  const postOffice = s('postOffice') || null;
  const policeStation = s('policeStation') || null;
  const panchayat = s('panchayat') || null;
  const block = s('block') || null;
  const tehsil = s('tehsil') || null;
  const mandal = s('mandal') || null;
  const revenueDivision = s('revenueDivision') || null;
  const subdivision = s('subdivision') || null;
  const district = s('district') || null;
  const pinCode = s('pinCode') || null;

  // Segmentation — caste/religion are inferred from the name when not supplied;
  // community (Gen/OBC/SC/ST) and category are manual-only. Inferred values
  // carry a confidence score. `community` accepts free spellings and is
  // normalised to the fixed set (invalid values are flagged).
  const manualCaste = s('caste') || null;
  const communityRaw = s('community');
  const community = communityRaw ? normalizeCommunity(communityRaw) : null;
  if (communityRaw && !community) errors.community = 'must be Gen/OBC/SC/ST';
  const manualCategory = s('category') || null;
  const manualReligion = s('religion') || null;

  let caste = manualCaste;
  let religion = manualReligion;
  let communityConfidence: number | null = null;
  let communitySource = 'inferred';
  if (manualCaste || manualReligion || community || manualCategory) {
    communitySource = 'manual';
    communityConfidence = 1;
  }
  // Fill caste + religion from the name when either is missing.
  if (!caste || !religion) {
    const c = classifyName(firstName, lastName);
    if (!religion) religion = c.religion;
    if (!caste) {
      caste = c.community;
      if (!manualCaste && !community && !manualCategory && !manualReligion) {
        communityConfidence = c.confidence;
        communitySource = c.source;
      }
    }
  }

  const occupation = s('occupation') || null;
  const language = s('language') || null;

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          fullName,
          firstName,
          lastName,
          relationType,
          relativeName,
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
          pollingStationAddress,
          partNumber,
          partName,
          partSerial,
          houseNumber,
          sectionNo,
          sectionName,
          mainTown,
          ward,
          postOffice,
          policeStation,
          panchayat,
          block,
          tehsil,
          mandal,
          revenueDivision,
          subdivision,
          district,
          pinCode,
          caste,
          community,
          category: manualCategory,
          religion,
          communityConfidence,
          communitySource,
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
