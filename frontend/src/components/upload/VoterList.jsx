import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../ui/Loader.jsx';
import { api } from '../../lib/api.js';

const COLS = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'age', label: 'Age', short: true },
  { key: 'gender', label: 'Gender', short: true },
  { key: 'epic', label: 'EPIC' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'community', label: 'Community' },
  { key: 'religion', label: 'Religion', short: true },
  { key: 'occupation', label: 'Occupation' },
  { key: 'language', label: 'Lang', short: true },
  { key: 'state', label: 'State' },
  { key: 'assemblyNo', label: 'Asm No', short: true },
  { key: 'assemblyName', label: 'Assembly' },
  { key: 'pollingStationName', label: 'Polling Stn' },
  { key: 'partNumber', label: 'Part No', short: true },
  { key: 'partSerial', label: 'Part Sl', short: true },
];

export default function VoterList({ onError, canDelete = true }) {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [assemblyNo, setAssemblyNo] = useState('');
  // committedFilters drives the query. Apply button copies inputs into them.
  const [filters, setFilters] = useState({});
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
  }
  function handleDelete(id) {
    if (!window.confirm('Delete this voter?')) return;
    del.mutate(id);
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <Card>
      <Card.Head
        title="Voters"
        subtitle={`Loaded from server. Use filters to narrow down. Total in DB: ${total}.`}
      />
      <Card.Body>
        <div className="grid-toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name / EPIC / mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            style={{ padding: 6, minWidth: 220 }}
          />
          <input
            type="text"
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{ padding: 6, width: 140 }}
          />
          <input
            type="text"
            placeholder="Assembly No"
            value={assemblyNo}
            onChange={(e) => setAssemblyNo(e.target.value)}
            style={{ padding: 6, width: 120 }}
          />
          <Button onClick={apply} disabled={list.isFetching}>
            {list.isFetching ? 'Loading…' : 'Apply'}
          </Button>
          <Button onClick={clear}>Clear</Button>
          {list.isFetching && (
            <span className="qq-inline-busy"><Spinner size={12} /> refreshing…</span>
          )}
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
          <div className="grid-wrap">
            <table className="voter-grid excel-compact">
              <thead>
                <tr>
                  <th className="row-num">#</th>
                  {COLS.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  {canDelete && <th className="actions-col" />}
                </tr>
              </thead>
              <tbody>
                {items.map((v, i) => (
                  <tr key={v.id}>
                    <td className="row-num">{i + 1}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="value">
                        <span style={{ padding: '0 8px' }}>{v[c.key] ?? ''}</span>
                      </td>
                    ))}
                    {canDelete && (
                      <td className="actions-col">
                        <button
                          type="button"
                          className="row-delete"
                          title="Delete voter"
                          onClick={() => handleDelete(v.id)}
                          disabled={del.isPending}
                        >
                          <CloseIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length + (canDelete ? 2 : 1)} style={{ padding: 16, color: 'var(--text-2)' }}>
                      No voters found.
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
