import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHead from '../components/ui/PageHead.jsx';
import Button from '../components/ui/Button.jsx';
import Tabs from '../components/ui/Tabs.jsx';
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
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [aggregates, setAggregates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [elections, setElections] = useState([]);
  const [cohortsKey, setCohortsKey] = useState(0);
  const { show } = useToast();

  useEffect(() => {
    api.listElections().then((r) => setElections(r.items)).catch(() => {});
    runSegment(criteria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSegment(c) {
    setBusy(true);
    try {
      const r = await api.segment(c);
      setItems(r.items);
      setTotal(r.total);
      setAggregates(r.aggregates);
    } catch (e) {
      show(e.message || 'Segment failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCohort() {
    const name = window.prompt('Cohort name?');
    if (!name) return;
    const description = window.prompt('Description (optional)?', '') || undefined;
    try {
      await api.createCohort({ name, description, criteria });
      show(`Cohort "${name}" saved`);
      setCohortsKey((n) => n + 1);
    } catch (e) {
      show(e.message || 'Save failed', 'error');
    }
  }

  function handleExport() {
    // POST CSV download via fetch + blob
    fetch(`${API_BASE}/api/cohorts/preview-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criteria),
    })
      .then((r) => {
        if (!r.ok) throw new Error('export failed');
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'voters_export.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => show(e.message || 'Export failed', 'error'));
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
              elections={elections}
              onChange={setCriteria}
              onApply={() => runSegment(criteria)}
              onReset={() => {
                setCriteria(EMPTY);
                runSegment(EMPTY);
              }}
              onSaveCohort={handleSaveCohort}
              onExport={handleExport}
            />
          </div>
          <div className="seg-main">
            <AggregatesPanel aggregates={aggregates} total={total} />
            <div style={{ marginTop: 16 }}>
              <ResultsTable items={items} total={total} busy={busy} />
            </div>
          </div>
        </div>
      )}

      {tab === 'heatmap' && <BoothHeatmap elections={elections} />}

      {tab === 'cohorts' && (
        <CohortsList
          refreshKey={cohortsKey}
          onLoad={(c) => {
            setCriteria(c.criteria || EMPTY);
            runSegment(c.criteria || EMPTY);
            setTab('segment');
            show(`Loaded "${c.name}"`);
          }}
          onError={(msg) => show(msg, 'error')}
        />
      )}
    </div>
  );
}
