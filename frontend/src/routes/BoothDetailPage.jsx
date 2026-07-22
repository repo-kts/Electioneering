import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import BoothElectionDetail from '../components/analytics/BoothElectionDetail.jsx';
import { api } from '../lib/api.js';
import { boothName } from '../components/elections/helpers.js';

export default function BoothDetailPage() {
  const { id, psId } = useParams();
  const electionId = Number(id);
  const q = useQuery({ queryKey: ['booth', psId], queryFn: () => api.boothDetail(psId) });
  const d = q.data;

  const electionName = d ? `${d.election.assemblyName} ${d.election.electionYear ?? ''}`.trim() : 'Election';

  return (
    <div>
      <Breadcrumbs
        items={[
          {
            label: d?.election?.electionType || 'Elections',
            to: d?.election?.electionType === 'Lok Sabha Election' ? '/elections/lok-sabha' : '/elections/assembly',
          },
          { label: electionName, to: `/elections/${electionId}` },
          { label: d ? boothName(d.ps) : 'Booth' },
        ]}
      />

      {q.isError && (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{q.error.message}</div>
      )}
      {q.isPending && <div className="h-40 animate-pulse bg-slate-200/70" />}

      {d && <BoothElectionDetail d={d} electionId={electionId} />}
    </div>
  );
}
