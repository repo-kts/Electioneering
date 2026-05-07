import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Form20 from '../components/upload/Form20.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import UploadPreview from '../components/upload/UploadPreview.jsx';
import SessionCard from '../components/upload/SessionCard.jsx';
import ValidationCard from '../components/upload/ValidationCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  ClockIcon,
  FileSpreadsheetIcon,
  UploadIcon,
} from '../components/ui/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import StatGroup from '../components/ui/StatGroup.jsx';
import { api } from '../lib/api.js';

const TABS = [
  { key: 'form20', label: 'Form 20', Icon: FileSpreadsheetIcon },
  { key: 'upload', label: 'Upload File', Icon: UploadIcon },
  { key: 'history', label: 'History', Icon: ClockIcon },
];

export default function Form20Page() {
  const [tab, setTab] = useState('form20');
  const [history, setHistory] = useState([]);
  const [elections, setElections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewHeader, setPreviewHeader] = useState({
    state: '', parlNo: '', parlName: '', assemblyNo: '', assemblyName: '',
    electionType: 'Assembly Election', totalElectors: '',
  });
  const { show } = useToast();

  async function refreshElections() {
    try {
      const r = await api.listElections();
      setElections(r.items);
      if (!selectedId && r.items.length) setSelectedId(r.items[0].id);
    } catch (e) {
      console.error(e);
    }
  }

  async function refreshHistory() {
    try {
      const r = await api.uploadHistory();
      setHistory(
        r.items.map((h) => ({
          id: h.id,
          time: new Date(h.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          file: h.fileName,
          source: h.source,
          records: h.records,
          constituency: h.constituency || '—',
          status: h.status,
        })),
      );
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    refreshElections();
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const counts = { validated: 0, processing: 0, failed: 0 };
    history.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
    return [
      { value: counts.validated, label: 'Submitted today' },
      { value: counts.processing, label: 'Pending', tone: 'warning' },
      { value: counts.failed, label: 'Failed', tone: 'danger' },
    ];
  }, [history]);

  const tabsWithCount = TABS.map((t) =>
    t.key === 'history' ? { ...t, count: history.length } : t,
  );

  function handleSubmit({ ok, message }) {
    if (!ok) {
      show(message || 'Please fix the highlighted fields', 'error');
      return;
    }
    show('Form 20 saved');
    refreshElections();
    refreshHistory();
    setTab('history');
  }

  async function handleFileAccepted(file) {
    try {
      const res = await api.previewUpload(file, 'form20');
      setPreview({ file: file.name, kind: 'form20', ...res });
    } catch (e) {
      show(e.message || 'Upload failed', 'error');
    }
  }

  async function handleCommitForm20(rows) {
    if (!previewHeader.assemblyNo || !previewHeader.assemblyName || !previewHeader.state) {
      show('Fill State, Assembly No and Assembly Name to commit', 'error');
      throw new Error('header missing');
    }
    try {
      const res = await api.commitForm20({
        fileName: preview.file,
        source: 'Form 20 Excel/CSV upload',
        ...previewHeader,
        totalElectors: previewHeader.totalElectors ? Number(previewHeader.totalElectors) : undefined,
        candidates: preview.candidates,
        rows,
      });
      show(`Form 20 saved · election #${res.electionId}`);
      setPreview(null);
      setSelectedId(res.electionId);
      refreshElections();
      refreshHistory();
      setTab('form20');
    } catch (e) {
      show(e.message || 'Commit failed', 'error');
      throw e;
    }
  }

  return (
    <div className="shell">
      <PageHead
        title="Form 20"
        subtitle="Detailed Result Sheet — polling-station-wise vote counts. Candidates and rows are dynamic."
        stats={<StatGroup items={stats} />}
        actions={
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button>← Home</Button>
          </Link>
        }
      />

      <Tabs tabs={tabsWithCount} active={tab} onChange={setTab} />

      {tab === 'form20' && (
        <>
          <Card>
            <Card.Head title="Election" subtitle="Pick an existing election or create a new one below." />
            <Card.Body>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: 8 }}
                >
                  <option value="">— New election —</option>
                  {elections.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.assemblyNo}-{e.assemblyName} ({e.state})
                    </option>
                  ))}
                </select>
                <Button onClick={() => setSelectedId(null)}>+ New Election</Button>
              </div>
            </Card.Body>
          </Card>
          <div style={{ marginTop: 16 }}>
            <Form20
              key={selectedId || 'new'}
              electionId={selectedId}
              onChangeElection={(e) => setSelectedId(e.id)}
              onSubmit={handleSubmit}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ValidationCard />
          </div>
        </>
      )}

      {tab === 'upload' && (
        <>
          {!preview && (
            <div className="two-col">
              <Card>
                <Card.Head
                  title="Upload Form 20 Excel/CSV"
                  subtitle="Drop your Form 20 sheet — candidate columns are detected automatically. You'll set the election header before saving."
                />
                <Card.Body>
                  <Dropzone onFileAccepted={handleFileAccepted} />
                </Card.Body>
              </Card>
              <SessionCard />
            </div>
          )}
          {preview && (
            <UploadPreview
              kind="form20"
              data={preview}
              onCancel={() => setPreview(null)}
              onCommit={handleCommitForm20}
              headerExtras={
                <div className="form20-header" style={{ marginBottom: 12 }}>
                  {[
                    ['state', 'State *'],
                    ['parlNo', 'Parl. No'],
                    ['parlName', 'Parl. Name'],
                    ['assemblyNo', 'Assembly No *'],
                    ['assemblyName', 'Assembly Name *'],
                    ['totalElectors', 'Total Electors'],
                    ['electionType', 'Election Type'],
                  ].map(([k, label]) => (
                    <div key={k} className="form20-header-row">
                      <label>{label}</label>
                      <input
                        type={k === 'totalElectors' ? 'number' : 'text'}
                        value={previewHeader[k] ?? ''}
                        onChange={(e) => setPreviewHeader({ ...previewHeader, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              }
            />
          )}
        </>
      )}

      {tab === 'history' && <HistoryTable rows={history} />}
    </div>
  );
}
