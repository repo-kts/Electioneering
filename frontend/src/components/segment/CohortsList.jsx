import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../ui/Loader.jsx';
import { api, downloadUrls } from '../../lib/api.js';

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
          <div className="grid-empty">No cohorts yet. Save the current filter to add one.</div>
        )}
        {list.data?.items?.length > 0 && (
          <div className="cohorts-list">
            {list.data.items.map((c) => (
              <div key={c.id} className="cohort-item">
                <div className="cohort-name">{c.name}</div>
                {c.description && <div className="cohort-desc">{c.description}</div>}
                <div className="cohort-criteria">
                  <code>{JSON.stringify(c.criteria)}</code>
                </div>
                <div className="cohort-actions">
                  <Button onClick={() => onLoad?.(c)}>Load</Button>
                  <a className="btn" href={downloadUrls.cohortExport(c.id)}>
                    Export CSV
                  </a>
                  <button
                    type="button"
                    className="row-delete"
                    title="Delete"
                    onClick={() => handleDelete(c.id)}
                    disabled={del.isPending}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            ))}
            {del.isPending && (
              <div className="qq-inline-busy">
                <Spinner size={12} /> deleting…
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
