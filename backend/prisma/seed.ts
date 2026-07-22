import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedMasterDefaults } from '../src/services/master.js';

// Basic reference data only — NO elections / voters / booths / form20.
//
// The geography hierarchy (Country → State → Parliamentary → Assembly) is
// derived from Election rows (see services/master.ts `syncMasterFromData`), so
// with no elections the hierarchy is just the India country root; states and
// constituencies get added when election data is imported or added via the
// /all-master UI. The prior sample-data seed (Bihar/Goa elections, Form 20,
// generated voters) lives in git history if it's needed again.

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

async function main() {
    console.log('[seed] starting (basic data only)...');
    await seedUsers();

    // Country (India) + lookup lists (election type, party, alliance, religion,
    // community, language, occupation, category, gender, seat type, caste).
    await seedMasterDefaults();
    console.log('[seed] master defaults seeded → country (India) + lookup lists');

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
