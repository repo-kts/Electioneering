// One-off: dump the seeded Mandrem (assemblyNo=1) Form 20 + voter list to CSV
// so the data is easy to eyeball. Run: npx tsx scripts/export-mandrem.ts
import { prisma } from '../src/lib/prisma.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), '../sample-data');

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  return lines.join('\n');
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const election = await prisma.election.findFirst({
    where: { assemblyNo: '1', assemblyName: 'Mandrem' },
    include: {
      candidates: { orderBy: { position: 'asc' } },
      booths: {
        orderBy: { serial: 'asc' },
        include: { voteResults: { include: { candidate: true } }, pollingStation: true },
      },
    },
  });
  if (!election) throw new Error('Mandrem election not found — run npm run db:seed');

  // ── Form 20 sheet ──────────────────────────────────────────────
  const candNames = election.candidates.map((c) => c.name);
  const f20Headers = [
    'S.No', 'Polling Station', 'Latitude', 'Longitude',
    ...candNames,
    'Total Valid Votes', 'Rejected Votes', 'NOTA', 'Total Votes',
  ];
  const f20Rows = election.booths.map((b) => {
    const byCand: Record<string, number> = {};
    let valid = 0;
    for (const vr of b.voteResults) {
      byCand[vr.candidate.name] = vr.votes;
      valid += vr.votes;
    }
    const row: Record<string, unknown> = {
      'S.No': b.serial,
      'Polling Station': b.name ?? b.pollingStation?.name ?? '',
      Latitude: b.pollingStation?.latitude ?? '',
      Longitude: b.pollingStation?.longitude ?? '',
      'Total Valid Votes': valid,
      'Rejected Votes': b.rejectedVotes,
      NOTA: b.notaVotes,
      'Total Votes': valid + b.rejectedVotes + b.notaVotes,
    };
    for (const name of candNames) row[name] = byCand[name] ?? 0;
    return row;
  });
  writeFileSync(resolve(OUT, 'mandrem_form20.csv'), toCsv(f20Headers, f20Rows));

  // ── Voter list sheet (this election's roll = BoothVoter rows) ──────
  const roll = await prisma.boothVoter.findMany({
    where: { electionId: election.id },
    orderBy: [{ partNumber: 'asc' }, { houseNumber: 'asc' }],
    include: { voter: true, booth: { include: { pollingStation: true } } },
  });
  const vHeaders = [
    'sr', 'fullName', 'firstName', 'lastName', 'relationType', 'relativeName',
    'age', 'gender', 'epic', 'houseNumber', 'pollingStationName', 'partNumber', 'partSerial',
    'mainTown', 'ward', 'panchayat', 'tehsil', 'district', 'pinCode', 'state',
    'religion', 'community', 'communityConfidence', 'communitySource', 'predictedLeader', 'predictedShare',
  ];
  const vRows = roll.map((bv, i) => {
    const v = bv.voter;
    const lean = (bv.predictedLeaning ?? {}) as { leader?: string; leaderShare?: number };
    return {
      sr: i + 1,
      fullName: v.fullName,
      firstName: v.firstName,
      lastName: v.lastName,
      relationType: v.relationType,
      relativeName: v.relativeName,
      age: v.age,
      gender: v.gender,
      epic: v.epic,
      houseNumber: bv.houseNumber,
      pollingStationName: bv.booth?.pollingStation?.name ?? bv.booth?.name ?? '',
      partNumber: bv.partNumber,
      partSerial: bv.partSerial,
      mainTown: v.mainTown,
      ward: v.ward,
      panchayat: v.panchayat,
      tehsil: v.tehsil,
      district: v.district,
      pinCode: v.pinCode,
      state: v.state,
      religion: v.religion,
      community: v.community,
      communityConfidence: v.communityConfidence,
      communitySource: v.communitySource,
      predictedLeader: lean.leader ?? '',
      predictedShare: lean.leaderShare != null ? (lean.leaderShare * 100).toFixed(1) + '%' : '',
    };
  });
  writeFileSync(resolve(OUT, 'mandrem_voters.csv'), toCsv(vHeaders, vRows));

  console.log(`[export] ${OUT}/mandrem_form20.csv  (${f20Rows.length} booths, ${candNames.length} candidates)`);
  console.log(`[export] ${OUT}/mandrem_voters.csv  (${vRows.length} voters)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
