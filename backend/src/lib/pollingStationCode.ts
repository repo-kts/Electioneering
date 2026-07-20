// In-house, deterministic code for a physical PollingStation (building).
//
// The same building recurs across elections under slightly different casing /
// spacing. We derive a stable `code` from the assembly + normalized station
// name so buildings dedup on upsert instead of multiplying per election.

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-') // collapse punctuation / whitespace to a single dash
    .replace(/^-+|-+$/g, '');
}

/**
 * Deterministic building code. Two rolls that name the same station in the
 * same assembly resolve to the same code → one PollingStation row.
 * Falls back to a serial-based code when no name is available.
 */
export function pollingStationCode(
  assemblyNo: string | null | undefined,
  name: string | null | undefined,
  fallbackSerial?: number,
): string {
  const asm = slug(String(assemblyNo ?? '')) || 'na';
  const nm = slug(String(name ?? ''));
  if (nm) return `PS-${asm}-${nm}`;
  return `PS-${asm}-s${fallbackSerial ?? 0}`;
}
