import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHead from '../components/ui/PageHead.jsx';
import Button from '../components/ui/Button.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import { ErrorState, Spinner } from '../components/ui/Loader.jsx';
import { useToast } from '../context/ToastContext.jsx';
import FilterPanel from '../components/segment/FilterPanel.jsx';
import AggregatesPanel from '../components/segment/AggregatesPanel.jsx';
import ResultsTable from '../components/segment/ResultsTable.jsx';
import BoothHeatmap from '../components/segment/BoothHeatmap.jsx';
import CohortsList from '../components/segment/CohortsList.jsx';
import { api, API_BASE } from '../lib/api.js';

const TABS = [
  { key: 'segment', label: 'Segment' },
  { key: 'heatmap', label: 'Booth heatmap' },
  { key: 'cohorts', label: 'Saved cohorts' },
];

const EMPTY = { take: 200, skip: 0 };

export default function SegmentPage() {
  const [tab, setTab] = useState('segment');
  const [criteria, setCriteria] = useState(EMPTY);
  const { show } = useToast();
  const qc = useQueryClient();

  const electionsQ = useQuery({
    queryKey: ['elections'],
    queryFn: () => api.listElections(),
  });

  const segmentQ = useQuery({
    queryKey: ['voters', 'segment', criteria],
    queryFn: () => api.segment(criteria),
    placeholderData: (prev) => prev,
  });

  const saveCohort = useMutation({
    mutationFn: (data) => api.createCohort(data),
    onSuccess: (cohort) => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      show(`Cohort "${cohort.name}" saved`);
    },
    onError: (e) => show(e.message || 'Save failed', 'error'),
  });

  const exportMut = useMutation({
    mutationFn: async (c) => {
      const token = localStorage.getItem('auth_token');
      const r = await fetch(`${API_BASE}/api/cohorts/preview-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(c),
      });
      if (!r.ok) {
        const err = new Error(`${r.status} export failed`);
        err.status = r.status;
        throw err;
      }
      return r.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'voters_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => show(e.message || 'Export failed', 'error'),
  });

  function handleSaveCohort() {
    const name = window.prompt('Cohort name?');
    if (!name) return;
    const description = window.prompt('Description (optional)?', '') || undefined;
    saveCohort.mutate({ name, description, criteria });
  }

  return (
    <div className="shell">
      <PageHead
        title="Voter segmentation"
        subtitle="Slice the voter file by community, religion, occupation, age, polling station, predicted leaning. Save filters as cohorts. Export CSV."
        actions={
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button>← Home</Button>
          </Link>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'segment' && (
        <div className="seg-shell">
          <div className="seg-side">
            <FilterPanel
              value={criteria}
              elections={electionsQ.data?.items ?? []}
              onChange={setCriteria}
              onApply={() => segmentQ.refetch()}
              onReset={() => setCriteria(EMPTY)}
              onSaveCohort={handleSaveCohort}
              onExport={() => exportMut.mutate(criteria)}
            />
            {(saveCohort.isPending || exportMut.isPending) && (
              <div className="qq-inline-busy" style={{ marginTop: 8 }}>
                <Spinner size={12} />
                {saveCohort.isPending ? 'saving cohort…' : 'preparing export…'}
              </div>
            )}
          </div>
          <div className="seg-main">
            {segmentQ.isError && (
              <ErrorState
                error={segmentQ.error}
                onRetry={() => segmentQ.refetch()}
                title="Couldn't run segment"
              />
            )}
            <AggregatesPanel
              aggregates={segmentQ.data?.aggregates}
              total={segmentQ.data?.total ?? 0}
            />
            <div style={{ marginTop: 16 }}>
              <ResultsTable
                items={segmentQ.data?.items ?? []}
                total={segmentQ.data?.total ?? 0}
                busy={segmentQ.isFetching}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'heatmap' && (
        <>
          {electionsQ.isError ? (
            <ErrorState error={electionsQ.error} onRetry={() => electionsQ.refetch()} title="Couldn't load elections" />
          ) : (
            <BoothHeatmap elections={electionsQ.data?.items ?? []} />
          )}
        </>
      )}

      {tab === 'cohorts' && (
        <CohortsList
          onLoad={(c) => {
            setCriteria(c.criteria || EMPTY);
            setTab('segment');
            show(`Loaded "${c.name}"`);
          }}
          onError={(msg) => show(msg, 'error')}
        />
      )}
    </div>
  );
}
