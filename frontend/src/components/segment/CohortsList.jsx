import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../ui/Loader.jsx';
import { api, downloadBlob } from '../../lib/api.js';

export default function CohortsList({ onLoad, onError }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['cohorts'],
    queryFn: () => api.listCohorts(),
  });
  const del = useMutation({
    mutationFn: (id) => api.deleteCohort(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts'] }),
    onError: (e) => onError?.(e.message || 'Delete failed'),
  });
  const exportMut = useMutation({
    mutationFn: ({ id, slug }) => downloadBlob(`/api/cohorts/${id}/export`, `${slug}.csv`),
    onError: (e) => onError?.(e.message || 'Export failed'),
  });

  function handleDelete(id) {
    if (!window.confirm('Delete this cohort?')) return;
    del.mutate(id);
  }

  return (
    <Card>
      <Card.Head
        title="Saved cohorts"
        subtitle="Click Load to apply a saved filter, Export to download CSV."
      />
      <Card.Body>
        {list.isPending && <SkeletonRows rows={3} cols={3} rowHeight={50} />}
        {list.isError && (
          <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load cohorts" />
        )}
        {list.data && list.data.items.length === 0 && (
          <div className="border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            No cohorts yet. Save the current filter to add one.
          </div>
        )}
        {list.data?.items?.length > 0 && (
          <div className="divide-y divide-slate-200 border border-slate-300">
            {list.data.items.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => handleDelete(c.id)}
                    disabled={del.isPending}
                    className="text-slate-400 hover:text-rose-600 disabled:opacity-50"
                  >
                    <CloseIcon />
                  </button>
                </div>
                {c.description && <div className="mt-0.5 text-sm text-slate-500">{c.description}</div>}
                <div className="mt-2 overflow-x-auto border border-slate-200 bg-[#fbfaf7] p-2">
                  <code className="text-[11px] text-slate-500">{JSON.stringify(c.criteria)}</code>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => onLoad?.(c)}>Load</Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      exportMut.mutate({
                        id: c.id,
                        slug: (c.name || 'cohort').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                      })
                    }
                    disabled={exportMut.isPending}
                  >
                    {exportMut.isPending ? 'Exporting…' : 'Export CSV'}
                  </Button>
                </div>
              </div>
            ))}
            {del.isPending && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner size={12} /> deleting…
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
