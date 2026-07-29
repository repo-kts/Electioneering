import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import BoothElectionDetail from '../components/analytics/BoothElectionDetail.jsx';
import { api } from '../lib/api.js';
import { boothName } from '../components/elections/helpers.js';

const typeAbbr = (t) => (t === 'Lok Sabha Election' ? 'GE' : 'AE');

export default function BoothDetailPage() {
  const { id, psId } = useParams();
  const electionId = Number(id);
  const q = useQuery({ queryKey: ['booth', psId], queryFn: () => api.boothDetail(psId) });
  const d = q.data;

  // Every election this physical booth took part in — powers the year filter.
  const stationId = d?.ps?.pollingStationId;
  const histQ = useQuery({
    enabled: stationId != null,
    queryKey: ['pollingStation', String(stationId)],
    queryFn: () => api.pollingStation(stationId),
  });
  const elections = histQ.data?.elections ?? []; // newest first, each a full booth read

  // Which election year to show; defaults to the one we arrived on.
  const [selectedId, setSelectedId] = useState(electionId);
  const yearOptions = useMemo(
    () =>
      [...elections]
        .sort((a, b) => (b.election.electionYear ?? 0) - (a.election.electionYear ?? 0))
        .map((e) => ({
          id: e.election.id,
          label: `${e.election.electionYear ?? '—'} · ${typeAbbr(e.election.electionType)}`,
        })),
    [elections],
  );

  // Data for the selected year: from history when available, else the booth we loaded.
  const current = elections.find((e) => e.election.id === selectedId) ?? d;
  const view = current ?? d;
  const viewId = current ? current.election.id : electionId;

  const electionName = view ? `${view.election.assemblyName} ${view.election.electionYear ?? ''}`.trim() : 'Election';

  return (
    <div>
      <Breadcrumbs
        items={[
          {
            label: view?.election?.electionType || 'Elections',
            to: view?.election?.electionType === 'Lok Sabha Election' ? '/elections/lok-sabha' : '/elections/assembly',
          },
          { label: electionName, to: `/elections/${viewId}` },
          { label: view ? boothName(view.ps) : 'Booth' },
        ]}
      />

      {q.isError && (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{q.error.message}</div>
      )}
      {q.isPending && <div className="h-40 animate-pulse bg-slate-200/70" />}

      {/* Year filter — switch which election of this booth is shown. */}
      {view && yearOptions.length > 1 && (
        <div className="mb-4 flex items-center justify-end">
          <label className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="border-0 bg-transparent p-0 pr-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-0"
            >
              {yearOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {view && <BoothElectionDetail d={view} electionId={viewId} />}
    </div>
  );
}
