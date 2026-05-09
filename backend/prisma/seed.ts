import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Form 20 (Biharsharif 172, year 2025) ──────────────────────────
const FORM20_CANDIDATES = [
  'Omair Khan',
  'Manoj Kumar',
  'Valaram Das',
  'Dr. Sunil Kumar',
  'Dinesh Kumar',
  'Shiv Kumar Yadav',
  'Manoj Kumar Tanti',
  'Mohit Kumar (Kundan)',
  'Rakesh Paswan',
  'Sarswati Kumari',
];

// 5 polling stations (subset of real form 20)
const FORM20_RAW = [
  // [c0..c9, rejected, nota, tendered]
  [22, 2, 4, 369, 20, 7, 58, 10, 0, 3, 0, 13, 0],
  [14, 2, 2, 272, 31, 7, 34, 14, 1, 1, 0, 5, 0],
  [170, 4, 1, 264, 14, 3, 3, 7, 3, 4, 0, 13, 0],
  [91, 1, 3, 197, 11, 2, 6, 6, 1, 0, 0, 5, 0],
  [18, 3, 2, 237, 41, 3, 12, 15, 1, 1, 0, 1, 0],
];

// 2020 (older election) — slightly different vote distribution
const FORM20_2020_RAW = [
  [40, 5, 8, 280, 30, 12, 80, 18, 2, 5, 1, 15, 0],
  [25, 3, 4, 220, 35, 10, 60, 20, 2, 2, 0, 8, 0],
  [180, 6, 3, 180, 18, 5, 8, 10, 5, 6, 1, 12, 0],
  [100, 2, 5, 160, 14, 4, 12, 8, 2, 1, 0, 6, 0],
  [30, 4, 4, 200, 50, 5, 25, 20, 2, 3, 0, 4, 0],
];

// ─── Voter generator (50 voters across 5 polling stations) ─────────
const COMMUNITIES = [
  'Yadav',
  'Kurmi',
  'Pasmanda Muslim',
  'Ashraf Muslim',
  'Brahmin',
  'Bhumihar',
  'Rajput',
  'Mahadalit',
  'Paswan',
  'Ravidas',
  'Vaishya',
];
const RELIGIONS = ['Hindu', 'Hindu', 'Hindu', 'Muslim'];
const LANGUAGES = ['Hindi', 'Bhojpuri', 'Magahi', 'Urdu'];
const OCCUPATIONS = [
  'Farmer',
  'Shopkeeper',
  'Teacher',
  'Daily Wage',
  'Student',
  'Government Employee',
  'Business',
  'Homemaker',
  'Driver',
];
const FIRST_NAMES_M = [
  'SAHIL', 'ARJUN', 'RAVI', 'AMIT', 'RAHUL', 'VIKRAM', 'SUNIL', 'ASHOK',
  'MOHIT', 'KARAN', 'NITESH', 'PANKAJ', 'IMRAN', 'ASIF', 'JAVED',
];
const FIRST_NAMES_F = [
  'PRIYA', 'ANITA', 'MEERA', 'KAVYA', 'POOJA', 'NEHA', 'SUNITA', 'SHALINI',
  'RUKHSAR', 'SHABANA', 'AYESHA', 'REKHA', 'SARITA',
];
const LAST_NAMES = [
  'KUMAR', 'SINGH', 'YADAV', 'PASWAN', 'KHAN', 'SAXENA', 'PATEL', 'SHARMA',
  'PRASAD', 'CHAUDHARY', 'MISHRA',
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function deterministic(seed: number, max: number): number {
  // simple PRNG-like for reproducible seed
  return Math.abs(Math.sin(seed * 9301.3 + 49297) * 233280) % max | 0;
}

function makeVoter(i: number) {
  const isMale = i % 2 === 0;
  const fn = isMale ? pick(FIRST_NAMES_M, i) : pick(FIRST_NAMES_F, i);
  const ln = pick(LAST_NAMES, i + 3);
  const relFn = pick(FIRST_NAMES_M, i + 5);
  const relLn = ln;
  const psSerial = (i % 5) + 1;
  const epicCode = `BHS${(3000000 + i * 137).toString().padStart(7, '0').slice(-7)}`;
  return {
    firstName: fn,
    lastName: ln,
    relFirstName: relFn,
    relLastName: relLn,
    age: 19 + deterministic(i, 55),
    gender: isMale ? Gender.Male : Gender.Female,
    epic: epicCode,
    mobile: `9${(800000000 + i * 1234567).toString().slice(-9)}`,
    state: 'Bihar',
    parlNo: '29',
    parlName: 'Nalanda',
    assemblyNo: '172',
    assemblyName: 'Biharsharif',
    pollingStationName: `PS-${psSerial}`,
    partNumber: `${380 + psSerial}`,
    partName: `Part of PS-${psSerial}`,
    partSerial: `${i + 1}`,
    community: pick(COMMUNITIES, i),
    religion: pick(RELIGIONS, i),
    occupation: pick(OCCUPATIONS, i + 2),
    language: pick(LANGUAGES, i + 1),
  };
}

async function main() {
  console.log('[seed] starting...');

  // ─── Election (2025) ──────────────────────────────────────────
  const e2025 =
    (await prisma.election.findFirst({
      where: { assemblyNo: '172', assemblyName: 'Biharsharif', electionYear: 2025 },
    })) ??
    (await prisma.election.create({
      data: {
        state: 'Bihar',
        parlNo: '29',
        parlName: 'Nalanda',
        assemblyNo: '172',
        assemblyName: 'Biharsharif',
        electionType: 'Assembly Election',
        electionYear: 2025,
        totalElectors: 389706,
      },
    }));
  console.log('[seed] election 2025 id =', e2025.id);

  await prisma.pollingStation.deleteMany({ where: { electionId: e2025.id } });
  await prisma.candidate.deleteMany({ where: { electionId: e2025.id } });

  const candIds2025: number[] = [];
  for (let i = 0; i < FORM20_CANDIDATES.length; i++) {
    const c = await prisma.candidate.create({
      data: { electionId: e2025.id, name: FORM20_CANDIDATES[i], position: i, party: '—' },
    });
    candIds2025.push(c.id);
  }
  const ps2025: number[] = [];
  for (let i = 0; i < FORM20_RAW.length; i++) {
    const row = FORM20_RAW[i];
    const ps = await prisma.pollingStation.create({
      data: {
        electionId: e2025.id,
        serial: i + 1,
        name: `PS-${i + 1}`,
        rejectedVotes: row[10],
        notaVotes: row[11],
        tenderedVotes: row[12],
      },
    });
    ps2025.push(ps.id);
    await prisma.voteResult.createMany({
      data: candIds2025.map((cid, j) => ({
        pollingStationId: ps.id,
        candidateId: cid,
        votes: row[j],
      })),
    });
  }
  console.log('[seed] form20 2025 →', FORM20_RAW.length, 'polling stations');

  // ─── Election (2020) ──────────────────────────────────────────
  const e2020 =
    (await prisma.election.findFirst({
      where: { assemblyNo: '172', assemblyName: 'Biharsharif', electionYear: 2020 },
    })) ??
    (await prisma.election.create({
      data: {
        state: 'Bihar',
        parlNo: '29',
        parlName: 'Nalanda',
        assemblyNo: '172',
        assemblyName: 'Biharsharif',
        electionType: 'Assembly Election',
        electionYear: 2020,
        totalElectors: 374120,
      },
    }));
  console.log('[seed] election 2020 id =', e2020.id);

  await prisma.pollingStation.deleteMany({ where: { electionId: e2020.id } });
  await prisma.candidate.deleteMany({ where: { electionId: e2020.id } });
  const candIds2020: number[] = [];
  for (let i = 0; i < FORM20_CANDIDATES.length; i++) {
    const c = await prisma.candidate.create({
      data: { electionId: e2020.id, name: FORM20_CANDIDATES[i], position: i, party: '—' },
    });
    candIds2020.push(c.id);
  }
  for (let i = 0; i < FORM20_2020_RAW.length; i++) {
    const row = FORM20_2020_RAW[i];
    const ps = await prisma.pollingStation.create({
      data: {
        electionId: e2020.id,
        serial: i + 1,
        name: `PS-${i + 1}`,
        rejectedVotes: row[10],
        notaVotes: row[11],
        tenderedVotes: row[12],
      },
    });
    await prisma.voteResult.createMany({
      data: candIds2020.map((cid, j) => ({
        pollingStationId: ps.id,
        candidateId: cid,
        votes: row[j],
      })),
    });
  }
  console.log('[seed] form20 2020 →', FORM20_2020_RAW.length, 'polling stations');

  // ─── Voters (50 in Biharsharif) ──────────────────────────────
  // Wipe existing seeded voters by EPIC prefix to keep idempotent.
  await prisma.voter.deleteMany({ where: { epic: { startsWith: 'BHS' } } });

  const voters: Array<{ id: number; psSerial: number }> = [];
  for (let i = 0; i < 50; i++) {
    const v = makeVoter(i);
    const psSerial = (i % 5) + 1;
    const created = await prisma.voter.create({
      data: { ...v, pollingStationId: ps2025[psSerial - 1] },
    });
    voters.push({ id: created.id, psSerial });
  }
  console.log('[seed] voters created =', voters.length);

  // Plus the original demo voters (non-Biharsharif)
  const DEMO_OUTSIDE = [
    {
      firstName: 'PRIYA', lastName: 'SHARMA', relFirstName: 'RAJESH', relLastName: 'SHARMA',
      age: 28, gender: Gender.Female, epic: 'DEL5827493', mobile: '9123456780',
      state: 'Delhi', parlNo: '5', parlName: 'North East Delhi',
      assemblyNo: '64', assemblyName: 'Karawal Nagar',
      pollingStationName: 'Government School Block A', partNumber: '142',
      partName: 'Karawal Nagar Block A', partSerial: '47',
      community: 'Brahmin', religion: 'Hindu', occupation: 'Teacher', language: 'Hindi',
    },
    {
      firstName: 'ARJUN', lastName: 'PATEL', relFirstName: 'KIRAN', relLastName: 'PATEL',
      age: 35, gender: Gender.Male, epic: 'GUJ1029384', mobile: '9988776655',
      state: 'Gujarat', parlNo: '7', parlName: 'Gandhinagar',
      assemblyNo: '33', assemblyName: 'Sabarmati',
      pollingStationName: 'Municipal Primary School', partNumber: '98',
      partName: 'Sabarmati North Ward', partSerial: '215',
      community: 'Patel', religion: 'Hindu', occupation: 'Business', language: 'Gujarati',
    },
  ];
  for (const v of DEMO_OUTSIDE) {
    await prisma.voter.upsert({ where: { epic: v.epic }, update: {}, create: v });
  }
  console.log('[seed] demo outside voters added');

  // ─── VoterTurnout — ~70% in 2020, ~55% in 2025 ───────────────
  await prisma.voterTurnout.deleteMany({
    where: { voter: { epic: { startsWith: 'BHS' } } },
  });
  let turn2020 = 0;
  let turn2025 = 0;
  for (const { id } of voters) {
    const did2020 = deterministic(id * 7, 100) < 70;
    const did2025 = deterministic(id * 11, 100) < 55;
    if (did2020) {
      await prisma.voterTurnout.create({
        data: {
          voterId: id,
          electionId: e2020.id,
          voted: true,
          polledAt: new Date('2020-11-07T11:00:00Z'),
        },
      });
      turn2020++;
    }
    if (did2025) {
      await prisma.voterTurnout.create({
        data: {
          voterId: id,
          electionId: e2025.id,
          voted: true,
          polledAt: new Date('2025-11-05T10:00:00Z'),
        },
      });
      turn2025++;
    }
  }
  console.log(`[seed] turnouts → 2020: ${turn2020}, 2025: ${turn2025}`);

  // ─── Sample cohort ────────────────────────────────────────────
  await prisma.cohort.deleteMany({});
  await prisma.cohort.create({
    data: {
      name: 'Young Yadav voters in Biharsharif',
      description: 'Yadav community, age 18-30, Biharsharif assembly',
      criteria: {
        assemblyNo: '172',
        assemblyName: 'Biharsharif',
        community: 'Yadav',
        ageMin: 18,
        ageMax: 30,
      },
    },
  });
  await prisma.cohort.create({
    data: {
      name: 'Pasmanda Muslim women — first-time voters 2025',
      description: 'Pasmanda Muslim, female, voted in 2025 not in 2020',
      criteria: {
        assemblyNo: '172',
        assemblyName: 'Biharsharif',
        community: 'Pasmanda Muslim',
        gender: 'Female',
        votedIn: [2025],
        notVotedIn: [2020],
      },
    },
  });
  console.log('[seed] sample cohorts created');

  console.log('[seed] done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
