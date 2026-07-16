import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../ui/Loader.jsx';
import ColumnFilter from '../ui/ColumnFilter.jsx';
import { api } from '../../lib/api.js';

const COLS = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'age', label: 'Age', short: true, numeric: true },
  { key: 'gender', label: 'Gender', short: true },
  { key: 'epic', label: 'EPIC' },
  { key: 'mobile', label: 'Mobile' },  { key: 'caste', label: 'Caste' },  { key: 'community', label: 'Community' },  { key: 'category', label: 'Category' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'language', label: 'Lang', short: true },
  { key: 'state', label: 'State' },
  { key: 'assemblyNo', label: 'Asm No', short: true, numeric: true },
  { key: 'assemblyName', label: 'Assembly' },
  { key: 'pollingStationName', label: 'Polling Stn' },
  { key: 'partNumber', label: 'Part No', short: true, numeric: true },
  { key: 'partSerial', label: 'Part Sl', short: true, numeric: true },
];

function cellKey(v) {
  if (v == null || v === '') return '∅ blank';
  return String(v);
}

export default function VoterList({ onError, canDelete = true }) {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [assemblyNo, setAssemblyNo] = useState('');
  const [filters, setFilters] = useState({}); // server-side filters
  const [colFilters, setColFilters] = useState({}); // { [colKey]: { values?: Set, sort?: 'asc'|'desc' } }
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['voters', 'list', filters],
    queryFn: () => api.listVoters({ take: '200', ...filters }),
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
    setFilters(next);
  }
  function clear() {
    setSearch('');
    setState('');
    setAssemblyNo('');
    setFilters({});
    setColFilters({});
  }
  function clearColFilters() {
    setColFilters({});
  }
  function handleDelete(id) {
    if (!window.confirm('Delete this voter?')) return;
    del.mutate(id);
  }
  function setColFilter(key, next) {
    setColFilters((prev) => {
      const out = { ...prev };
      if (!next) delete out[key];
      else out[key] = next;
      return out;
    });
  }

  const items = list.data?.items ?? [];

  // Apply per-column filters + sort in memory
  const filteredItems = useMemo(() => {
    let out = items;
    // multi-select filters
    for (const [k, f] of Object.entries(colFilters)) {
      if (f?.values && f.values.size > 0) {
        out = out.filter((row) => f.values.has(cellKey(row[k])));
      }
    }
    // sort — last column with a sort wins
    const sortEntry = Object.entries(colFilters).find(([, f]) => f?.sort);
    if (sortEntry) {
      const [k, f] = sortEntry;
      const col = COLS.find((c) => c.key === k);
      const dir = f.sort === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = a[k];
        const bv = b[k];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (col?.numeric) return (Number(av) - Number(bv)) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
      });
    }
    return out;
  }, [items, colFilters]);

  const total = list.data?.total ?? 0;
  const colFilterCount = Object.keys(colFilters).length;

  return (
    <Card>
      <Card.Head
        title="Voters"
        subtitle={`Loaded from server. Total in DB: ${total}. Click the funnel on any column header to sort or filter.`}
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
          {colFilterCount > 0 && <Button onClick={clearColFilters}>Clear column filters ({colFilterCount})</Button>}
          {list.isFetching && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><Spinner size={12} /> refreshing…</span>
          )}
          <span className="ml-auto text-sm text-slate-500">{filteredItems.length} / {items.length} shown</span>
        </div>

        {list.isPending && <SkeletonRows rows={6} cols={6} rowHeight={26} />}
        {list.isError && (
          <ErrorState
            error={list.error}
            onRetry={() => list.refetch()}
            title="Couldn't load voters"
          />
        )}

        {list.data && (
          <div className="overflow-x-auto border border-slate-300">
            <table className="w-full text-sm">
              <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="px-2 py-2 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span>{c.label}</span>
                        <ColumnFilter
                          columnKey={c.key}
                          label={c.label}
                          values={items.map((r) => r[c.key])}
                          active={colFilters[c.key]}
                          onChange={(next) => setColFilter(c.key, next)}
                        />
                      </span>
                    </th>
                  ))}
                  {canDelete && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((v, i) => (
                  <tr key={v.id} className="border-t border-slate-200 hover:bg-[#fbfaf7]">
                    <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 whitespace-nowrap text-slate-700">{v[c.key] ?? ''}</td>
                    ))}
                    {canDelete && (
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          title="Delete voter"
                          onClick={() => handleDelete(v.id)}
                          disabled={del.isPending}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-50"
                        >
                          <CloseIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length + (canDelete ? 2 : 1)} className="px-2 py-8 text-center text-slate-400">
                      No voters match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
