import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../ui/Loader.jsx';
import EditVoterForm from './EditVoterForm.jsx';
import { api } from '../../lib/api.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';

const PAGE_SIZE = 50;

// Stable voter columns only — per-election booth/roll fields live on BoothVoter
// and are viewed per-election on the booth pages.
const COLS = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'epic', label: 'EPIC' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'caste', label: 'Caste' },
  { key: 'community', label: 'Community' },
  { key: 'category', label: 'Category' },
  { key: 'religion', label: 'Religion' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'language', label: 'Lang' },
  { key: 'state', label: 'State' },
  { key: 'assemblyName', label: 'Assembly' },
  { key: 'district', label: 'District' },
];

export default function VoterList({ onError, canDelete = true }) {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [assemblyNo, setAssemblyNo] = useState('');
  const [filters, setFilters] = useState({}); // active server-side filters
  const [page, setPage] = useState(0); // 0-indexed
  const [editVoter, setEditVoter] = useState(null);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const list = useQuery({
    // Server-side pagination — one page at a time, never the whole table.
    queryKey: ['voters', 'list', filters, page],
    queryFn: () => api.listVoters({ take: String(PAGE_SIZE), skip: String(page * PAGE_SIZE), ...filters }),
    placeholderData: (prev) => prev,
  });

  const del = useMutation({
    mutationFn: (id) => api.deleteVoter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voters', 'list'] }),
    onError: (e) => onError?.(e.message || 'Delete failed'),
  });

  function apply() {
    const next = {};
    if (search.trim()) next.search = search.trim();
    if (state.trim()) next.state = state.trim();
    if (assemblyNo.trim()) next.assemblyNo = assemblyNo.trim();
    setPage(0);
    setFilters(next);
  }
  function clear() {
    setSearch('');
    setState('');
    setAssemblyNo('');
    setPage(0);
    setFilters({});
  }
  async function handleDelete(id) {
    if (!(await confirm({ title: 'Delete voter?', message: 'This voter record will be permanently removed.', confirmText: 'Delete' }))) return;
    del.mutate(id);
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <Card>
      <Card.Head
        title="Voters"
        subtitle={`${total.toLocaleString()} voters in the database — paged ${PAGE_SIZE} at a time.`}
      />
      <Card.Body>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search name / EPIC / mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            className="min-w-[220px] flex-1"
          />
          <input type="text" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className="w-36" />
          <input type="text" placeholder="Assembly No" value={assemblyNo} onChange={(e) => setAssemblyNo(e.target.value)} className="w-32" />
          <Button onClick={apply} disabled={list.isFetching}>{list.isFetching ? 'Loading…' : 'Apply'}</Button>
          <Button onClick={clear}>Clear</Button>
          {list.isFetching && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><Spinner size={12} /> refreshing…</span>
          )}
        </div>

        {list.isPending && <SkeletonRows rows={6} cols={6} rowHeight={26} />}
        {list.isError && (
          <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load voters" />
        )}

        {list.data && (
          <>
            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-sm">
                <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">#</th>
                    {COLS.map((c) => (
                      <th key={c.key} className="px-2 py-2 font-medium whitespace-nowrap">{c.label}</th>
                    ))}
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((v, i) => (
                    <tr key={v.id} className="border-t border-slate-200 hover:bg-[#fbfaf7]">
                      <td className="px-2 py-1.5 text-slate-400">{from + i}</td>
                      {COLS.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 whitespace-nowrap text-slate-700">{v[c.key] ?? ''}</td>
                      ))}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Edit voter"
                            onClick={() => setEditVoter(v)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-900"
                          >
                            Edit
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              title="Delete voter"
                              onClick={() => handleDelete(v.id)}
                              disabled={del.isPending}
                              className="text-slate-400 hover:text-rose-600 disabled:opacity-50"
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={COLS.length + 2} className="px-2 py-8 text-center text-slate-400">
                        No voters match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span>{total === 0 ? 'No results' : `Showing ${from}–${to} of ${total.toLocaleString()}`}</span>
              <div className="flex items-center gap-2">
                <Button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || list.isFetching}>Prev</Button>
                <span className="tabular-nums">Page {page + 1} / {pageCount}</span>
                <Button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1 || list.isFetching}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card.Body>

      {editVoter && <EditVoterForm voter={editVoter} onClose={() => setEditVoter(null)} />}
    </Card>
  );
}
