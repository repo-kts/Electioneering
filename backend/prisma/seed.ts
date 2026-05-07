import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

const DUMMY_VOTERS = [
  {
    firstName: 'SAHIL', lastName: 'SAXENA', relFirstName: 'SANJAY', relLastName: 'KUMAR',
    age: 23, gender: Gender.Male, epic: 'TGK3378866', mobile: '9876543210',
    state: 'Bihar', parlNo: '29', parlName: 'Nalanda', assemblyNo: '172', assemblyName: 'Biharsharif',
    pollingStationName: 'Madarasa Ajijiya', partNumber: '381',
    partName: 'Madarasa Ajijaya Dakshini Bhag Se Sate Uttari Bhag', partSerial: '283',
  },
  {
    firstName: 'PRIYA', lastName: 'SHARMA', relFirstName: 'RAJESH', relLastName: 'SHARMA',
    age: 28, gender: Gender.Female, epic: 'DEL5827493', mobile: '9123456780',
    state: 'Delhi', parlNo: '5', parlName: 'North East Delhi', assemblyNo: '64', assemblyName: 'Karawal Nagar',
    pollingStationName: 'Government School Block A', partNumber: '142',
    partName: 'Karawal Nagar Block A', partSerial: '47',
  },
  {
    firstName: 'ARJUN', lastName: 'PATEL', relFirstName: 'KIRAN', relLastName: 'PATEL',
    age: 35, gender: Gender.Male, epic: 'GUJ1029384', mobile: '9988776655',
    state: 'Gujarat', parlNo: '7', parlName: 'Gandhinagar', assemblyNo: '33', assemblyName: 'Sabarmati',
    pollingStationName: 'Municipal Primary School', partNumber: '98',
    partName: 'Sabarmati North Ward', partSerial: '215',
  },
];

const FORM20_CANDIDATES = [
  'Omair Khan', 'Manoj Kumar', 'Valaram Das', 'Dr. Sunil Kumar', 'Dinesh Kumar',
  'Shiv Kumar Yadav', 'Manoj Kumar Tanti', 'Mohit Kumar (Kundan)', 'Rakesh Paswan', 'Sarswati Kumari',
];

const FORM20_RAW = [
  [22, 2, 4, 369, 20, 7, 58, 10, 0, 3, 0, 13, 0],
  [14, 2, 2, 272, 31, 7, 34, 14, 1, 1, 0, 5, 0],
  [170, 4, 1, 264, 14, 3, 3, 7, 3, 4, 0, 13, 0],
  [91, 1, 3, 197, 11, 2, 6, 6, 1, 0, 0, 5, 0],
  [18, 3, 2, 237, 41, 3, 12, 15, 1, 1, 0, 1, 0],
];

async function main() {
  console.log('[seed] starting...');

  // Voters
  for (const v of DUMMY_VOTERS) {
    await prisma.voter.upsert({
      where: { epic: v.epic },
      update: {},
      create: v,
    });
  }
  console.log(`[seed] inserted ${DUMMY_VOTERS.length} voters`);

  // Election + Form 20
  const election = await prisma.election.upsert({
    where: { assemblyNo_assemblyName: { assemblyNo: '172', assemblyName: 'Biharsharif' } },
    update: { totalElectors: 389706 },
    create: {
      state: 'Bihar',
      parlNo: '29',
      parlName: 'Nalanda',
      assemblyNo: '172',
      assemblyName: 'Biharsharif',
      electionType: 'Assembly Election',
      totalElectors: 389706,
    },
  });

  await prisma.pollingStation.deleteMany({ where: { electionId: election.id } });
  await prisma.candidate.deleteMany({ where: { electionId: election.id } });

  const candIds: number[] = [];
  for (let i = 0; i < FORM20_CANDIDATES.length; i++) {
    const c = await prisma.candidate.create({
      data: { electionId: election.id, name: FORM20_CANDIDATES[i], position: i },
    });
    candIds.push(c.id);
  }

  for (let i = 0; i < FORM20_RAW.length; i++) {
    const row = FORM20_RAW[i];
    const ps = await prisma.pollingStation.create({
      data: {
        electionId: election.id,
        serial: i + 1,
        rejectedVotes: row[10],
        notaVotes: row[11],
        tenderedVotes: row[12],
      },
    });
    await prisma.voteResult.createMany({
      data: candIds.map((cid, j) => ({
        pollingStationId: ps.id,
        candidateId: cid,
        votes: row[j],
      })),
    });
  }

  console.log(`[seed] inserted election + ${FORM20_RAW.length} polling stations`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
