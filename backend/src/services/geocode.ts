// Polling-station geocoding via OpenStreetMap Nominatim (free, no key).
// Nominatim usage policy: <= 1 request/second + a descriptive User-Agent.
// For large rolls (thousands of booths) switch to a self-hosted Nominatim or
// a paid geocoder; this is fine for a constituency-sized batch.

import { prisma } from '../lib/prisma.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'Electioneering/1.0 (voter-analytics; admin tool)';
const DELAY_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip the leading "12 - " serial prefix some PS names carry. */
function cleanName(name: string | null): string {
  if (!name) return '';
  return name.replace(/^\s*\d+\s*[-–]\s*/, '').trim();
}

async function geocodeQuery(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

/** Try queries from most to least specific; return the first hit. */
async function geocodeTiered(queries: string[]): Promise<{ lat: number; lon: number } | null> {
  for (const q of queries) {
    if (!q) continue;
    const hit = await geocodeQuery(q);
    if (hit) return hit;
    await sleep(DELAY_MS); // rate-limit between attempts
  }
  return null;
}

/** Small deterministic offset so booths resolved to the same town don't stack. */
function jitter(serial: number): { dLat: number; dLon: number } {
  const a = (serial * 2.399963) % (Math.PI * 2);
  const rad = 0.0012 * (1 + (serial % 4) * 0.4);
  return { dLat: Math.sin(a) * rad, dLon: Math.cos(a) * rad };
}

export interface GeocodeResult {
  electionId: number;
  total: number;
  geocoded: number;
  failed: number;
  skipped: number;
}

/**
 * Geocode every polling station in an election that lacks coordinates
 * (or all of them when `force`). Builds the query from the station name plus
 * a representative voter's town/district/state/pin for accuracy.
 */
export async function geocodeElectionBooths(
  electionId: number,
  force = false,
): Promise<GeocodeResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    const e = new Error('Election not found');
    (e as Error & { status?: number }).status = 404;
    throw e;
  }
  // Booths in this election, each carrying its physical building. Geocoding
  // targets the building (PollingStation); dedupe so a shared building is
  // resolved only once per run.
  const booths = await prisma.booth.findMany({
    where: { electionId },
    orderBy: { serial: 'asc' },
    include: { pollingStation: true },
  });

  let geocoded = 0;
  let failed = 0;
  let skipped = 0;
  const done = new Set<number>();

  for (const booth of booths) {
    const ps = booth.pollingStation;
    if (done.has(ps.id)) continue;
    done.add(ps.id);
    if (!force && ps.latitude != null && ps.longitude != null) {
      skipped += 1;
      continue;
    }
    // Enrich with one voter placed on this booth.
    const bv = await prisma.boothVoter.findFirst({
      where: { boothId: booth.id },
      select: { voter: { select: { mainTown: true, district: true, state: true } } },
    });
    const town = bv?.voter.mainTown?.trim();
    const district = bv?.voter.district?.trim() || election.assemblyName;
    const state = bv?.voter.state?.trim() || election.state;
    const school = cleanName(ps.name);
    // Most specific → town level. Building names rarely sit in OSM; town does.
    const queries = [
      [school, town, district, state, 'India'].filter(Boolean).join(', '),
      [town, district, state, 'India'].filter(Boolean).join(', '),
      [town, state, 'India'].filter(Boolean).join(', '),
      [district, state, 'India'].filter(Boolean).join(', '),
    ];

    try {
      const hit = await geocodeTiered(queries);
      if (hit) {
        const j = jitter(booth.serial);
        await prisma.pollingStation.update({
          where: { id: ps.id },
          data: { latitude: hit.lat + j.dLat, longitude: hit.lon + j.dLon, geocodedAt: new Date() },
        });
        geocoded += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
    await sleep(DELAY_MS); // respect Nominatim rate limit
  }

  return { electionId, total: done.size, geocoded, failed, skipped };
}
