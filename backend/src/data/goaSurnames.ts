// Goa surname / given-name → religion+community dictionary used by the
// name classifier. Keys are NORMALIZED (uppercase, apostrophes + spaces
// stripped) so "D'Souza", "De'Souza", "Desouza" all collapse to "DESOUZA".
//
// This is an ESTIMATE source. Indian electoral analytics leans heavily on
// name → community signal, but it is probabilistic, never ground truth.
// State-pluggable: add more states' dictionaries and select by Voter.state.

export type Religion = 'Hindu' | 'Christian' | 'Muslim' | 'Other';

export interface CommunityTag {
  religion: Religion;
  community: string | null; // coarse community label, null when not inferable
}

export function normalizeNameKey(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (Sebastião → SEBASTIAO)
    .replace(/[^A-Z]/g, ''); // drop apostrophes, spaces, dots, hyphens
}

const CHRISTIAN: CommunityTag = { religion: 'Christian', community: 'Christian (Catholic)' };
const MUSLIM: CommunityTag = { religion: 'Muslim', community: 'Muslim' };
const HINDU: CommunityTag = { religion: 'Hindu', community: null };

// ─── Surname dictionary (strongest signal) ──────────────────────────
const SURNAMES: Record<string, CommunityTag> = {};
const add = (tag: CommunityTag, ...names: string[]) => {
  for (const n of names) SURNAMES[normalizeNameKey(n)] = tag;
};

// Goan Catholic Christian surnames (Portuguese-derived). Apostrophes are
// stripped by normalizeNameKey, so DSOUZA covers D'Souza/De'Souza/Desouza.
add(
  CHRISTIAN,
  'Fernandes', 'Dsouza', 'Desouza', 'Mendes',
  'Rodrigues', 'Pereira', 'Gomes', 'Pinto', 'Dias', 'Coutinho', 'Cardozo',
  'Carvalho', 'Dcosta', 'Almeida', 'Lobo', 'Sequeira', 'Vaz',
  'Fonseca', 'Rebello', 'Colaco', 'Barreto', 'Souza', 'Noronha', 'Quadros',
  'Dmello', 'Furtado', 'Monteiro', 'Braganza', 'Afonso',
  'Mascarenhas', 'Andrade', 'Teixeira', 'Texeira', 'Correia', 'Costa',
  'Gracias', 'Menezes', 'Pacheco', 'Saldanha', 'Viegas', 'Xavier',
  'Dourado', 'Cabral', 'Dantas', 'Lourenco', 'Martins', 'Nunes',
);

// Muslim surnames
add(
  MUSLIM,
  'Shaikh', 'Sheikh', 'Khan', 'Sayyed', 'Syed', 'Mulla', 'Bepari',
  'Mohammed', 'Mohammad', 'Ali', 'Pathan', 'Qureshi', 'Ansari', 'Mujawar',
  'Sutar', 'Tamboli', 'Nadaf', 'Bagwan', 'Mukadam',
);

// Goan Hindu surnames (Konkani / Marathi)
add(
  HINDU,
  'Naik', 'Parab', 'Khalap', 'Vaingankar', 'Shirodkar', 'Gawde', 'Gaude',
  'Kerkar', 'Chodankar', 'Parsekar', 'Mandrekar', 'Sawant', 'Desai',
  'Prabhu', 'Kamat', 'Shet', 'Shetye', 'Bhandari', 'Harmalkar', 'Dhumaskar',
  'Pednekar', 'Korgaonkar', 'Gaonkar', 'Velip', 'Phadte', 'Volvoikar',
  'Raikar', 'Salgaonkar', 'Dessai', 'Bandekar', 'Halankar', 'Govekar',
  'Redkar', 'Naik', 'Kambli', 'Morajkar', 'Tari', 'Gad', 'Verekar',
  'Palyekar', 'Chari', 'Naik', 'Dalvi', 'Bhonsle', 'More', 'Pawar',
);

// ─── Given-name fallback (weaker signal) ─────────────────────────────
const GIVEN: Record<string, Religion> = {};
const addGiven = (rel: Religion, ...names: string[]) => {
  for (const n of names) GIVEN[normalizeNameKey(n)] = rel;
};
addGiven(
  'Christian',
  'Sebastiao', 'Julie', 'Brayan', 'Jordan', 'Eugenia', 'Fermino', 'Wilma',
  'Cicilie', 'Santana', 'Jeronimo', 'Simao', 'Josephina', 'Francis', 'Maria',
  'Joseph', 'John', 'Peter', 'Anthony', 'Rosa', 'Caetano', 'Custodio',
  'Filomena', 'Agnelo', 'Savio', 'Menino', 'Pedro', 'Paulo', 'Antonio',
  'Felicidade', 'Conceicao', 'Anaruzaria', 'Girgol', 'Andre', 'Mathew',
);
addGiven(
  'Muslim',
  'Shakeel', 'Jamal', 'Mohammed', 'Mohammad', 'Abdul', 'Ayesha', 'Fatima',
  'Imran', 'Salim', 'Yusuf', 'Rashid', 'Nasreen', 'Sameer', 'Farhan',
  'Asif', 'Javed', 'Rukhsar', 'Shabana', 'Ibrahim', 'Ismail', 'Noor',
);

export interface NameMatch {
  religion: Religion;
  community: string | null;
  confidence: number; // 0..1
}

const SURNAME_CONF = 0.9;
const GIVEN_CONF = 0.6;
const DEFAULT_CONF = 0.3;

function tag(rel: Religion): CommunityTag {
  if (rel === 'Christian') return CHRISTIAN;
  if (rel === 'Muslim') return MUSLIM;
  return HINDU;
}

/** Look up a single token against the surname dictionary. */
export function lookupSurname(token: string): CommunityTag | null {
  return SURNAMES[normalizeNameKey(token)] ?? null;
}

/** Look up a single token against the given-name dictionary. */
export function lookupGiven(token: string): Religion | null {
  return GIVEN[normalizeNameKey(token)] ?? null;
}

export const NAME_CONFIDENCE = { SURNAME_CONF, GIVEN_CONF, DEFAULT_CONF };
export { tag as religionTag };
