// Master-data seeding + sync. Populates the referential lookup tables that the
// /all-master UI manages: the geography hierarchy (Country → State →
// Parliamentary → Assembly) and the generic MasterCategory/MasterOption lists.
//
// Design: non-breaking. Election/Voter keep their string fields; master merely
// feeds the dropdowns. `syncMasterFromData` derives master rows from whatever
// distinct values already exist, so importing new data never silently drops a
// value the UI can't offer.

import { prisma } from '../lib/prisma.js';

export const DEFAULT_COUNTRY = { code: 'IN', name: 'India' };

// Seed categories + their baseline options. Keys are stable slugs used in code;
// labels are the human display. `system: true` categories can't be deleted.
export const DEFAULT_CATEGORIES: Array<{
  key: string;
  label: string;
  options: string[];
}> = [
  { key: 'election_type', label: 'Election Type', options: ['Assembly Election', 'Lok Sabha Election', 'By-Election', 'Panchayat Election', 'Municipal Election'] },
  { key: 'seat_type', label: 'Seat Type (Reservation)', options: ['GEN', 'SC', 'ST'] },
  { key: 'party', label: 'Political Party', options: ['BJP', 'INC', 'AAP', 'IND', 'BSP', 'SP', 'RJD', 'JDU', 'TMC', 'NCP', 'SHS', 'CPI', 'CPM'] },
  { key: 'alliance', label: 'Alliance', options: ['NDA', 'INDIA', 'Others', 'Independent'] },
  { key: 'community', label: 'Community (Reservation Class)', options: ['Gen', 'OBC', 'SC', 'ST'] },
  { key: 'religion', label: 'Religion', options: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'] },
  { key: 'language', label: 'Language', options: ['Hindi', 'English', 'Bhojpuri', 'Magahi', 'Urdu', 'Marathi', 'Konkani', 'Gujarati', 'Bengali', 'Tamil', 'Telugu'] },
  { key: 'occupation', label: 'Occupation', options: ['Farmer', 'Shopkeeper', 'Teacher', 'Daily Wage', 'Student', 'Government Employee', 'Business', 'Homemaker', 'Driver', 'Unemployed'] },
  { key: 'category', label: 'Category', options: ['General', 'Backward', 'Minority', 'Reserved'] },
  { key: 'gender', label: 'Gender', options: ['Male', 'Female', 'Other'] },
  { key: 'caste', label: 'Caste', options: [] },
];

/** Upsert a category by key and (idempotently) its options, appending any new
 *  labels without disturbing existing rows / their sort order. */
async function upsertCategory(key: string, label: string, options: string[], sortOrder: number): Promise<void> {
  const cat = await prisma.masterCategory.upsert({
    where: { key },
    create: { key, label, system: true, sortOrder },
    update: { label },
    select: { id: true },
  });
  const existing = await prisma.masterOption.findMany({
    where: { categoryId: cat.id },
    select: { label: true, sortOrder: true },
  });
  const have = new Set(existing.map((o) => o.label.toLowerCase()));
  let next = existing.reduce((m, o) => Math.max(m, o.sortOrder + 1), 0);
  for (const opt of options) {
    const clean = opt.trim();
    if (!clean || have.has(clean.toLowerCase())) continue;
    await prisma.masterOption.create({
      data: { categoryId: cat.id, label: clean, sortOrder: next++ },
    });
    have.add(clean.toLowerCase());
  }
}

/** Idempotently create the default country + all default categories/options. */
export async function seedMasterDefaults(): Promise<void> {
  await prisma.country.upsert({
    where: { code: DEFAULT_COUNTRY.code },
    create: DEFAULT_COUNTRY,
    update: {},
  });
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i];
    await upsertCategory(c.key, c.label, c.options, i);
  }
}

function clean(v: string | null | undefined): string {
  return (v ?? '').trim();
}

/**
 * Derive master rows from data already in the DB:
 *  - geography hierarchy from Election (state / parl / assembly)
 *  - list options from distinct Voter + Candidate values
 * Safe to run repeatedly. Returns a small summary of what was added.
 */
export async function syncMasterFromData(): Promise<Record<string, number>> {
  await seedMasterDefaults();
  const country = await prisma.country.upsert({
    where: { code: DEFAULT_COUNTRY.code },
    create: DEFAULT_COUNTRY,
    update: {},
    select: { id: true },
  });

  const summary: Record<string, number> = { states: 0, parliamentary: 0, assembly: 0, options: 0 };

  // ── Geography from Election rows ──────────────────────────────────────
  const elections = await prisma.election.findMany({
    select: {
      state: true, parlNo: true, parlName: true,
      assemblyNo: true, assemblyName: true,
      parlSeatType: true, assemblySeatType: true,
    },
  });

  const stateId = new Map<string, number>();
  const parlId = new Map<string, number>();
  for (const e of elections) {
    const st = clean(e.state);
    if (st && !stateId.has(st.toLowerCase())) {
      const row = await prisma.state.upsert({
        where: { countryId_name: { countryId: country.id, name: st } },
        create: { countryId: country.id, name: st },
        update: {},
        select: { id: true },
      });
      if (!stateId.has(st.toLowerCase())) summary.states++;
      stateId.set(st.toLowerCase(), row.id);
    }
    const sId = stateId.get(st.toLowerCase());
    const pNo = clean(e.parlNo);
    const pKey = `${sId}|${pNo}`;
    if (sId && pNo && !parlId.has(pKey)) {
      const row = await prisma.parliamentaryConstituency.upsert({
        where: { stateId_number: { stateId: sId, number: pNo } },
        create: { stateId: sId, number: pNo, name: clean(e.parlName) || pNo, seatType: clean(e.parlSeatType) || null },
        update: { name: clean(e.parlName) || pNo },
        select: { id: true },
      });
      summary.parliamentary++;
      parlId.set(pKey, row.id);
    }
    const pId = parlId.get(pKey);
    const aNo = clean(e.assemblyNo);
    if (pId && aNo) {
      await prisma.assemblyConstituency.upsert({
        where: { parlId_number: { parlId: pId, number: aNo } },
        create: { parlId: pId, number: aNo, name: clean(e.assemblyName) || aNo, seatType: clean(e.assemblySeatType) || null },
        update: { name: clean(e.assemblyName) || aNo },
      });
      summary.assembly++;
    }
  }

  // ── List options from distinct Voter / Candidate values ───────────────
  const before = await prisma.masterOption.count();
  const [religions, communities, languages, occupations, categories, castes, parties, alliances, types] = await Promise.all([
    prisma.voter.findMany({ where: { religion: { not: null } }, distinct: ['religion'], select: { religion: true } }),
    prisma.voter.findMany({ where: { community: { not: null } }, distinct: ['community'], select: { community: true } }),
    prisma.voter.findMany({ where: { language: { not: null } }, distinct: ['language'], select: { language: true } }),
    prisma.voter.findMany({ where: { occupation: { not: null } }, distinct: ['occupation'], select: { occupation: true } }),
    prisma.voter.findMany({ where: { category: { not: null } }, distinct: ['category'], select: { category: true } }),
    prisma.voter.findMany({ where: { caste: { not: null } }, distinct: ['caste'], select: { caste: true } }),
    prisma.candidate.findMany({ where: { party: { not: null } }, distinct: ['party'], select: { party: true } }),
    prisma.candidate.findMany({ where: { alliance: { not: null } }, distinct: ['alliance'], select: { alliance: true } }),
    prisma.election.findMany({ distinct: ['electionType'], select: { electionType: true } }),
  ]);
  await upsertCategory('religion', 'Religion', religions.map((r) => r.religion!), 0);
  await upsertCategory('community', 'Community (Reservation Class)', communities.map((r) => r.community!), 0);
  await upsertCategory('language', 'Language', languages.map((r) => r.language!), 0);
  await upsertCategory('occupation', 'Occupation', occupations.map((r) => r.occupation!), 0);
  await upsertCategory('category', 'Category', categories.map((r) => r.category!), 0);
  await upsertCategory('caste', 'Caste', castes.map((r) => r.caste!), 0);
  await upsertCategory('party', 'Political Party', parties.map((r) => r.party!).filter((p) => p !== '—'), 0);
  await upsertCategory('alliance', 'Alliance', alliances.map((r) => r.alliance!), 0);
  await upsertCategory('election_type', 'Election Type', types.map((r) => r.electionType), 0);
  summary.options = (await prisma.masterOption.count()) - before;

  return summary;
}
