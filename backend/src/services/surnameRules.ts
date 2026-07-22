// Surname → caste/category/religion seeding for voter imports.
//
// Admin-managed rules (model SurnameRule, `/all-master` → Surname Rules) map a
// voter's surname (last name) to a caste, category and/or religion. On import,
// a BLANK caste/category/religion cell is filled from the matching rule; a
// filled cell is kept, and a surname with no rule is left blank.

import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface SurnameSeed {
  caste: string | null;
  category: string | null;
  religion: string | null;
}

/** Normalise a surname for matching (trim + uppercase). */
export function normalizeSurname(s: unknown): string {
  return String(s ?? '').trim().toUpperCase();
}

/** Load active surname rules into a Map keyed by normalized surname. */
export async function loadSurnameRules(db: Db): Promise<Map<string, SurnameSeed>> {
  const rows = await db.surnameRule.findMany({
    where: { active: true },
    select: { surname: true, caste: true, category: true, religion: true },
  });
  return new Map(rows.map((r) => [normalizeSurname(r.surname), { caste: r.caste, category: r.category, religion: r.religion }]));
}

/**
 * Fill blank caste/category/religion cells on a normalized voter row from the
 * surname rule matching its `lastName`. Mutates the row in place. No-op when the
 * surname has no rule or the cells are already filled.
 */
export function applySurnameRule(row: Record<string, unknown>, rules: Map<string, SurnameSeed>): void {
  const rule = rules.get(normalizeSurname(row.lastName));
  if (!rule) return;
  const blank = (k: string) => !String(row[k] ?? '').trim();
  if (rule.caste && blank('caste')) row.caste = rule.caste;
  if (rule.category && blank('category')) row.category = rule.category;
  if (rule.religion && blank('religion')) row.religion = rule.religion;
}
