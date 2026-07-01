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
      pollingStations: {
        orderBy: { serial: 'asc' },
        include: { voteResults: { include: { candidate: true } } },
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
  const f20Rows = election.pollingStations.map((ps) => {
    const byCand: Record<string, number> = {};
    let valid = 0;
    for (const vr of ps.voteResults) {
      byCand[vr.candidate.name] = vr.votes;
      valid += vr.votes;
    }
    const row: Record<string, unknown> = {
      'S.No': ps.serial,
      'Polling Station': ps.name,
      Latitude: ps.latitude ?? '',
      Longitude: ps.longitude ?? '',
      'Total Valid Votes': valid,
      'Rejected Votes': ps.rejectedVotes,
      NOTA: ps.notaVotes,
      'Total Votes': valid + ps.rejectedVotes + ps.notaVotes,
    };
    for (const name of candNames) row[name] = byCand[name] ?? 0;
    return row;
  });
  writeFileSync(resolve(OUT, 'mandrem_form20.csv'), toCsv(f20Headers, f20Rows));

  // ── Voter list sheet ───────────────────────────────────────────
  const voters = await prisma.voter.findMany({
    where: { assemblyNo: '1', assemblyName: 'Mandrem' },
    orderBy: [{ partNumber: 'asc' }, { houseNumber: 'asc' }, { age: 'desc' }],
  });
  const vHeaders = [
    'sr', 'fullName', 'firstName', 'lastName', 'relationType', 'relativeName',
    'age', 'gender', 'epic', 'houseNumber', 'pollingStationName', 'partNumber', 'partSerial',
    'mainTown', 'ward', 'panchayat', 'tehsil', 'district', 'pinCode', 'state',
    'religion', 'community', 'communityConfidence', 'communitySource', 'predictedLeader', 'predictedShare',
  ];
  const vRows = voters.map((v, i) => {
    const lean = (v.predictedLeaning ?? {}) as { leader?: string; leaderShare?: number };
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
      houseNumber: v.houseNumber,
      pollingStationName: v.pollingStationName,
      partNumber: v.partNumber,
      partSerial: v.partSerial,
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
