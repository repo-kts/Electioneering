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
 * Strip a leading polling-station serial prefix (e.g. "2 - ", "12. ", "5 – ")
 * from a booth/station name. The serial can be renumbered election to election,
 * so it must NOT be part of a booth's stable identity — but any distinguishing
 * suffix like "(East Wing)" MUST be kept, since two booths can share a building.
 */
export function stableStationName(name: string | null | undefined): string {
  return String(name ?? '')
    .replace(/^\s*\d+\s*[-–—.)]\s*/, '') // drop a leading "<serial><sep>"
    .trim();
}

/**
 * Deterministic booth identity code. The same physical booth (building + wing)
 * resolves to the same code across elections even as its serial changes, while
 * two booths in one building ("East Wing" / "West Wing") get distinct codes.
 * Falls back to a serial-based code when no name is available.
 */
export function pollingStationCode(
  assemblyNo: string | null | undefined,
  name: string | null | undefined,
  fallbackSerial?: number,
): string {
  const asm = slug(String(assemblyNo ?? '')) || 'na';
  const nm = slug(stableStationName(name));
  if (nm) return `PS-${asm}-${nm}`;
  return `PS-${asm}-s${fallbackSerial ?? 0}`;
}
