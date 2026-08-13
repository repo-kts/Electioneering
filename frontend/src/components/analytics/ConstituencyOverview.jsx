// Constituency identity card + booth map — the same two-column template the
// booth page uses (StationOverview in BoothElectionDetail.jsx), one level up.
// Left: the constituency's details as a labelled list. Right: every polling
// station of this election plotted, with the same geocode action.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import BoothMap from './BoothMap.jsx';
import { partyColor, colorFor, benchmarkFor, num } from '../elections/helpers.js';

/**
 * @param election  the `election` object from GET /api/analytics/overview
 * @param electionId the election whose booths are mapped (latest year when the
 *                   page is on "All years")
 * @param votersTotal registered voters in scope, for the header tag
 */
export default function ConstituencyOverview({ election, electionId, votersTotal }) {
  const { show } = useToast();
  const qc = useQueryClient();

  const leaningQ = useQuery({
    queryKey: ['analytics', 'boothLeaning', electionId],
    queryFn: () => api.boothLeaning(electionId),
    enabled: !!electionId,
  });
  const items = leaningQ.data?.items ?? [];
  const placed = items.some((b) => b.latitude != null && b.longitude != null);

  // One Nominatim lookup per polling station, rate-limited server-side, so this
  // places every booth of the election in a single run.
  const geocode = useMutation({
    mutationFn: () => api.geocodeBooths(electionId, placed),
    onSuccess: (r) => {
      show(`Geocoded ${r.geocoded} of ${r.total} booths`, r.failed ? 'warn' : 'success');
      qc.invalidateQueries({ queryKey: ['analytics', 'boothLeaning', electionId] });
      qc.invalidateQueries({ queryKey: ['pollingStation'] });
      qc.invalidateQueries({ queryKey: ['constituencyBooths'] });
    },
    onError: (e) => show(e.message || 'Geocoding failed', 'error'),
  });

  if (!election) return null;

  const benchmark = benchmarkFor(election.leader?.share);
  const leaderLabel = election.leader?.party || election.leader?.name || null;
  const leaderDot = partyColor(election.leader?.party) ?? colorFor(election.leader?.name);

  const tag = [
    election.assemblyNo ? `${election.assemblyNo}-${election.assemblyName}` : election.assemblyName,
    election.electionYear ?? null,
  ].filter(Boolean).join(' · ');

  const rows = [
    ['Constituency name', election.assemblyName],
    ['Constituency number', election.assemblyNo],
    ['Legislative Assembly Seat Type', election.assemblySeatType],
    ['State', election.state],
    ['Election type', election.electionType],
    ['Election year', election.electionYear],
    ['General Election Name', election.parlName],
    ['General Election Number', election.parlNo],
    ['General Election Seat Type', election.parlSeatType],
    ['Polling stations', election.boothCount != null ? num(election.boothCount) : null],
    ['Candidates', election.candidates?.length ? num(election.candidates.length) : null],
    ['Total electors', election.totalElectors != null ? num(election.totalElectors) : null],
    ['Voters on roll', votersTotal != null ? num(votersTotal) : null],
    ['Valid votes', election.totalValid != null ? num(election.totalValid) : null],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <div className="flex flex-col border border-slate-300 bg-white">
        <div className="border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Constituency</div>
              <h2 className="text-[26px] font-semibold leading-tight text-slate-950">{election.assemblyName}</h2>
              {tag && <p className="mt-0.5 text-sm font-medium tabular-nums text-slate-500">{tag}</p>}
              {election.state && <p className="mt-0.5 text-xs text-slate-400">{election.state}</p>}
            </div>
            <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold ${benchmark.cls}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: benchmark.dot }} />
              {benchmark.label} <span className="font-normal opacity-70">· {benchmark.range}</span>
              {leaderLabel && (
                <span className="ml-1 inline-flex items-center gap-1 border-l border-current/20 pl-1.5 font-medium opacity-90">
                  <span className="h-2 w-2 rounded-full" style={{ background: leaderDot }} />
                  {leaderLabel}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Constituency details</div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
                <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
                <dd className="min-w-0 truncate text-right text-sm font-medium text-slate-800" title={value != null ? String(value) : ''}>
                  {value ?? '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border border-slate-300 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Location</div>
            <h3 className="text-sm font-semibold text-slate-950">Booths on the map</h3>
          </div>
          {electionId && (
            <button
              type="button"
              onClick={() => geocode.mutate()}
              disabled={geocode.isPending}
              title="Looks up coordinates for every polling station in this election via OpenStreetMap. Takes a minute or two."
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {geocode.isPending ? 'Geocoding…' : placed ? 'Re-geocode booths' : 'Geocode booths'}
            </button>
          )}
        </div>
        <div className="p-3">
          <BoothMap items={items} electionId={electionId} />
        </div>
      </div>
    </div>
  );
}
