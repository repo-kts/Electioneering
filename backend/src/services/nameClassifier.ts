// Name → religion/community classifier. ESTIMATE only — surname-first,
// given-name fallback, else a low-confidence Hindu default (the modal group
// in most Indian constituencies). Always carries a confidence score so the
// UI can label it as inferred, never asserted as fact.

import {
  lookupSurname,
  lookupGiven,
  religionTag,
  NAME_CONFIDENCE,
  type Religion,
} from '../data/goaSurnames.js';

export interface NameClassification {
  religion: Religion;
  community: string | null;
  confidence: number; // 0..1
  source: 'inferred';
}

function tokens(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/**
 * Classify from first + last name. The last token of the full name is the
 * strongest signal; we also try every token against the surname dict (Goan
 * names sometimes carry the community marker mid-name), then given names.
 */
export function classifyName(firstName: string, lastName: string): NameClassification {
  const all = [...tokens(firstName), ...tokens(lastName)];

  // 1. Surname dictionary — prefer the last token, then any token.
  const ordered = lastName.trim() ? [lastName.trim(), ...all] : all;
  for (const t of ordered) {
    const hit = lookupSurname(t);
    if (hit) {
      return {
        religion: hit.religion,
        community: hit.community,
        confidence: NAME_CONFIDENCE.SURNAME_CONF,
        source: 'inferred',
      };
    }
  }

  // 2. Given-name fallback.
  for (const t of all) {
    const rel = lookupGiven(t);
    if (rel) {
      const tg = religionTag(rel);
      return {
        religion: rel,
        community: tg.community,
        confidence: NAME_CONFIDENCE.GIVEN_CONF,
        source: 'inferred',
      };
    }
  }

  // 3. Default — low-confidence Hindu.
  return {
    religion: 'Hindu',
    community: null,
    confidence: NAME_CONFIDENCE.DEFAULT_CONF,
    source: 'inferred',
  };
}
