import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Surface, StatCard, Button, Loading, ErrorBox } from '../components/ui/kit.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';

const num = (n) => (n ?? 0).toLocaleString();

export default function HouseholdsPage() {
  const { show } = useToast();
  const qc = useQueryClient();
  const [assemblyNo, setAssemblyNo] = useState('');
  const [openId, setOpenId] = useState(null);

  const electionsQ = useQuery({ queryKey: ['elections'], queryFn: () => api.listElections() });
  const elections = electionsQ.data?.items ?? [];

  const listQ = useQuery({
    queryKey: ['households', assemblyNo],
    queryFn: () => api.listHouseholds(assemblyNo ? { assemblyNo, take: 300 } : { take: 300 }),
  });
  const items = listQ.data?.items ?? [];

  const rebuild = useMutation({
    mutationFn: () => api.rebuildHouseholds(assemblyNo || undefined),
    onSuccess: (r) => {
      show(`Rebuilt ${r.households} households from ${r.voters} voters`, 'success');
      qc.invalidateQueries({ queryKey: ['households'] });
    },
    onError: (e) => show(e.message || 'Rebuild failed', 'error'),
  });

  const detailQ = useQuery({
    queryKey: ['household', openId],
    queryFn: () => api.getHousehold(openId),
    enabled: !!openId,
  });

  const stats = useMemo(() => {
    const total = listQ.data?.total ?? 0;
    const members = items.reduce((s, h) => s + (h._count?.voters ?? h.size ?? 0), 0);
    const avg = items.length ? (members / items.length).toFixed(1) : '0';
    const biggest = items.reduce((m, h) => Math.max(m, h._count?.voters ?? h.size ?? 0), 0);
    return { total, avg, biggest };
  }, [items, listQ.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Households"
        subtitle="Voters sharing a house are grouped as a family unit for booth-level field planning."
        actions={
          <Button variant="primary" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
            {rebuild.isPending ? 'Rebuilding…' : 'Rebuild households'}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">Constituency</span>
          <select value={assemblyNo} onChange={(e) => setAssemblyNo(e.target.value)} className="w-56">
            <option value="">All constituencies</option>
            {[...new Map(elections.map((e) => [e.assemblyNo, e])).values()].map((e) => (
              <option key={e.assemblyNo} value={e.assemblyNo}>
                {e.assemblyNo}-{e.assemblyName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 border border-slate-300 bg-white sm:grid-cols-4">
        <StatCard label="Households" value={num(stats.total)} />
        <StatCard label="Avg. size" value={stats.avg} sub="voters per house" />
        <StatCard label="Largest bloc" value={num(stats.biggest)} sub="voters in one house" />
        <StatCard label="Shown" value={num(items.length)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Surface title="Households" subtitle="Ranked by size — biggest family blocs first." bodyClass="p-0">
          {listQ.isError && <div className="p-5"><ErrorBox message={listQ.error.message} /></div>}
          {listQ.isPending ? (
            <div className="p-5"><Loading className="h-64" /></div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              No households yet — pick a constituency and click “Rebuild households”.
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#fbfaf7] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">House</th>
                    <th className="px-3 py-2.5 font-semibold">Constituency · Part</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => setOpenId(h.id)}
                      className={`cursor-pointer border-t border-slate-200 transition hover:bg-[#fbfaf7] ${openId === h.id ? 'bg-accent-50' : ''}`}
                    >
                      <td className="px-5 py-2.5 font-semibold text-slate-800">#{h.houseNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{h.assemblyNo ?? '—'} · {h.partNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex min-w-7 justify-center border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {h._count?.voters ?? h.size}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface title={openId ? `House #${detailQ.data?.houseNumber ?? ''}` : 'Members'}>
          {!openId && <p className="text-sm text-slate-400">Select a household to see its members.</p>}
          {openId && detailQ.isPending && <Loading className="h-40" />}
          {detailQ.data && (
            <ul className="space-y-3">
              {detailQ.data.voters.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 text-sm last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-slate-800">
                      {v.fullName ?? `${v.firstName} ${v.lastName}`}
                      {v.id === detailQ.data.headVoterId && (
                        <span className="ml-2 border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Head</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{v.age}y · {v.gender}{v.religion ? ` · ${v.religion}` : ''}</div>
                  </div>
                  <span className="font-mono text-xs text-slate-400">{v.epic}</span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}
