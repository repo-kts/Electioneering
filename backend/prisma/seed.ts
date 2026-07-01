import { PrismaClient, Gender, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { classifyName } from '../src/services/nameClassifier.js';

const prisma = new PrismaClient();

async function seedUsers() {
  const defaults = [
    { username: 'admin', password: process.env.SEED_ADMIN_PW || 'admin123', role: Role.admin },
    {
      username: 'operator',
      password: process.env.SEED_OPERATOR_PW || 'operator123',
      role: Role.data_operator,
    },
  ];
  for (const u of defaults) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { role: u.role, active: true },
      create: { username: u.username, passwordHash, role: u.role },
    });
    console.log(`[seed] user "${u.username}" → ${u.role}`);
  }
}

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
    occupation: pick(OCCUPATIONS, i + 2),
    language: pick(LANGUAGES, i + 1),
  };
}

// ─── Goa — Mandrem AC segment, Lok Sabha 2024 (real-shape sample) ──────
const GOA_CANDIDATES = [
  'Tukaram Bharat Parab',
  'Milan R Vaingankar',
  'Ramakant Khalap',
  'Shripad Yesso Naik',
  'Mr Sakharam Naik',
  'Thomas Augustine Fernandes',
  'Adv Nishal Naik',
  'Shakeel Jamal Shaikh',
];
// rows: 8 candidate votes…, rejected, nota
const GOA_FORM20 = [
  [1, 0, 90, 57, 0, 0, 1, 0, 0, 0],
  [54, 4, 172, 458, 2, 1, 4, 1, 0, 8],
  [42, 1, 120, 247, 2, 0, 0, 1, 0, 9],
  [43, 2, 135, 268, 3, 2, 1, 3, 0, 5],
  [23, 2, 208, 231, 3, 2, 1, 1, 0, 17],
  [38, 4, 244, 366, 0, 2, 1, 1, 0, 8],
];

// The 15 Tiracol voters from the real roll (PS-1, all Christian surnames).
const TIRACOL = [
  ['Sebastiao Xavier Fernandes', 'Male', 78, 'TRW0273011', '3'],
  ['Julie Sebastiao Fernandes', 'Female', 66, 'TRW0226530', '3'],
  ['Brayan Sebastiao Fernandes', 'Male', 41, 'CDM3600244', '3'],
  ['Jordan Fernandes', 'Male', 38, 'TRW0114348', '3'],
  ["Anaruzaria Andre D'souza", 'Female', 86, 'TRW0226506', '4'],
  ['Eugenia Desouza', 'Female', 58, 'TRW0343152', '4'],
  ["Fermino Andre D'Souza", 'Male', 53, 'TRW0226589', '4'],
  ["Wilma D'Souza", 'Female', 53, 'CDM5406228', '6'],
  ['Cicilie Santanjocky Mendes', 'Female', 90, 'TRW0227496', '8'],
  ["Santana Caridade De'Souza", 'Male', 68, 'TRW0226522', '8'],
  ['Jeronimo Mendes', 'Male', 62, 'CDM5406418', '8'],
  ['Girgol Santanjocky Mendes', 'Male', 58, 'CDM5406293', '8'],
  ['Simao Santanjocky Mendes', 'Male', 56, 'CDM5406236', '8'],
  ['Josephina Jeronimo Mendes', 'Female', 55, 'TRW0403287', '8'],
  ['Francis Santanjocky Mendes', 'Male', 54, 'CDM5409321', '8'],
] as const;

// Mixed Goan surnames for the other booths (Hindu / Christian / Muslim).
const GOA_GEN_NAMES = [
  'Mahesh Naik', 'Sunita Parab', 'Rajesh Shirodkar', 'Anil Kerkar',
  'Maria Fernandes', 'Joseph Dsouza', 'Imran Shaikh', 'Ayesha Shaikh',
  'Suresh Chodankar', 'Vaishali Sawant', 'Pravin Gawde', 'Deepa Naik',
  'Caetano Rodrigues', 'Filomena Pereira', 'Yusuf Khan', 'Sameer Mulla',
  'Ganesh Parsekar', 'Manoj Mandrekar', 'Savio Pinto', 'Agnelo Gomes',
];

function splitName(full: string): { first: string; last: string } {
  const p = full.trim().split(/\s+/);
  return { first: p.slice(0, -1).join(' ') || p[0], last: p[p.length - 1] };
}

async function seedGoa() {
  const election =
    (await prisma.election.findFirst({
      where: { assemblyNo: '1', assemblyName: 'Mandrem', electionYear: 2024 },
    })) ??
    (await prisma.election.create({
      data: {
        state: 'Goa', parlNo: '1', parlName: 'North Goa',
        assemblyNo: '1', assemblyName: 'Mandrem',
        electionType: 'Lok Sabha Election', electionYear: 2024, totalElectors: 26000,
      },
    }));
  await prisma.pollingStation.deleteMany({ where: { electionId: election.id } });
  await prisma.candidate.deleteMany({ where: { electionId: election.id } });

  const candIds: number[] = [];
  for (let i = 0; i < GOA_CANDIDATES.length; i++) {
    const party = GOA_CANDIDATES[i].includes('Shripad') ? 'BJP'
      : GOA_CANDIDATES[i].includes('Ramakant') ? 'INC' : 'IND';
    const c = await prisma.candidate.create({
      data: { electionId: election.id, name: GOA_CANDIDATES[i], position: i, party },
    });
    candIds.push(c.id);
  }
  const psIds: number[] = [];
  for (let i = 0; i < GOA_FORM20.length; i++) {
    const row = GOA_FORM20[i];
    const ps = await prisma.pollingStation.create({
      data: {
        electionId: election.id, serial: i + 1,
        name: `${i + 1} - Government Primary School, Tiracol`,
        rejectedVotes: row[8], notaVotes: row[9],
      },
    });
    psIds.push(ps.id);
    await prisma.voteResult.createMany({
      data: candIds.map((cid, j) => ({ pollingStationId: ps.id, candidateId: cid, votes: row[j] })),
    });
  }
  console.log('[seed] Goa Mandrem form20 →', GOA_FORM20.length, 'PS');

  // Wipe prior Goa voters (TRW/CDM EPIC prefixes + generated GOA prefix).
  await prisma.voter.deleteMany({
    where: { OR: [{ epic: { startsWith: 'TRW' } }, { epic: { startsWith: 'CDM' } }, { epic: { startsWith: 'GOA' } }] },
  });

  const geo = {
    state: 'Goa', parlNo: '1', parlName: 'North Goa', assemblyNo: '1', assemblyName: 'Mandrem',
    ward: 'ARAMBOL', panchayat: 'MANDREM', tehsil: 'PERNEM', district: 'NORTH GOA', pinCode: '403524',
  };

  let made = 0;
  // Tiracol roll → PS-1
  for (let i = 0; i < TIRACOL.length; i++) {
    const [full, sex, age, epic, makan] = TIRACOL[i];
    const { first, last } = splitName(full);
    const c = classifyName(first.toUpperCase(), last.toUpperCase());
    await prisma.voter.create({
      data: {
        ...geo,
        fullName: full, firstName: first.toUpperCase(), lastName: last.toUpperCase(),
        relationType: sex === 'Female' ? 'Husband' : 'Father', relativeName: null,
        relFirstName: '', relLastName: '',
        age: age as number, gender: sex as Gender, epic: epic as string,
        pollingStationName: '1 - Government Primary School, Tiracol',
        pollingStationId: psIds[0], partNumber: '1', partSerial: `${i + 1}`,
        houseNumber: makan as string,
        religion: c.religion, community: c.community, communityConfidence: c.confidence,
        communitySource: 'inferred',
      },
    });
    made++;
  }
  // Generated voters spread across PS-2..6
  for (let i = 0; i < GOA_GEN_NAMES.length; i++) {
    const { first, last } = splitName(GOA_GEN_NAMES[i]);
    const c = classifyName(first.toUpperCase(), last.toUpperCase());
    const psIdx = 1 + (i % (psIds.length - 1)); // 1..5
    const isF = /a$|i$/.test(first.toLowerCase());
    await prisma.voter.create({
      data: {
        ...geo,
        fullName: GOA_GEN_NAMES[i], firstName: first.toUpperCase(), lastName: last.toUpperCase(),
        relationType: isF ? 'Husband' : 'Father', relFirstName: '', relLastName: '',
        age: 22 + ((i * 7) % 55), gender: isF ? Gender.Female : Gender.Male,
        epic: `GOA${(4000000 + i * 311).toString().slice(-7)}`,
        pollingStationName: `${psIdx + 1} - Government Primary School, Tiracol`,
        pollingStationId: psIds[psIdx], partNumber: `${psIdx + 1}`, partSerial: `${i + 1}`,
        houseNumber: `${10 + (i % 6)}`,
        religion: c.religion, community: c.community, communityConfidence: c.confidence,
        communitySource: 'inferred',
      },
    });
    made++;
  }
  console.log('[seed] Goa voters created =', made);
}

async function main() {
  console.log('[seed] starting...');
  await seedUsers();
  await seedGoa();

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
      community: 'Brahmin', occupation: 'Teacher', language: 'Hindi',
    },
    {
      firstName: 'ARJUN', lastName: 'PATEL', relFirstName: 'KIRAN', relLastName: 'PATEL',
      age: 35, gender: Gender.Male, epic: 'GUJ1029384', mobile: '9988776655',
      state: 'Gujarat', parlNo: '7', parlName: 'Gandhinagar',
      assemblyNo: '33', assemblyName: 'Sabarmati',
      pollingStationName: 'Municipal Primary School', partNumber: '98',
      partName: 'Sabarmati North Ward', partSerial: '215',
      community: 'Patel', occupation: 'Business', language: 'Gujarati',
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
