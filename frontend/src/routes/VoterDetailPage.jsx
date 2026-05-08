import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RecordForm from '../components/upload/RecordForm.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import UploadPreview from '../components/upload/UploadPreview.jsx';
import VoterList from '../components/upload/VoterList.jsx';
import SessionCard from '../components/upload/SessionCard.jsx';
import ValidationCard from '../components/upload/ValidationCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ClockIcon, PlusIcon, UploadIcon, FileSpreadsheetIcon } from '../components/ui/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import StatGroup from '../components/ui/StatGroup.jsx';
import { api } from '../lib/api.js';

const TABS = [
  { key: 'add', label: 'Add Voter', Icon: PlusIcon },
  { key: 'upload', label: 'Upload File', Icon: UploadIcon },
  { key: 'voters', label: 'Voters', Icon: FileSpreadsheetIcon },
  { key: 'history', label: 'History', Icon: ClockIcon },
];

function nowTime() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function VoterDetailPage() {
  const [tab, setTab] = useState('add');
  const [history, setHistory] = useState([]);
  const [preview, setPreview] = useState(null); // { file, kind, rows, headers }
  const [voterRefresh, setVoterRefresh] = useState(0);
  const { show } = useToast();

  async function refreshHistory() {
    try {
      const res = await api.uploadHistory();
      setHistory(
        res.items.map((h) => ({
          id: h.id,
          time: new Date(h.createdAt).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit',
          }),
          file: h.fileName,
          source: h.source,
          records: h.records,
          constituency: h.constituency || '—',
          status: h.status,
        })),
      );
    } catch (e) {
      console.error('history fetch failed', e);
    }
  }

  useEffect(() => {
    refreshHistory();
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

  async function handleRecordSubmit({ ok, voters, message, reset }) {
    if (!ok) {
      show(message || 'Please fix the highlighted fields', 'error');
      return;
    }
    try {
      const res = await api.bulkVoters(voters);
      show(`${res.inserted} of ${res.requested} voter${res.requested === 1 ? '' : 's'} saved`);
      reset?.();
      refreshHistory();
      setVoterRefresh((n) => n + 1);
      setTab('voters');
    } catch (e) {
      show(e.message || 'Save failed', 'error');
    }
  }

  async function handleFileAccepted(file) {
    try {
      const res = await api.previewUpload(file, 'voter');
      setPreview({ file: file.name, kind: 'voter', ...res });
    } catch (e) {
      show(e.message || 'Upload failed', 'error');
    }
  }

  async function handleCommitPreview(rows) {
    try {
      const res = await api.commitVoters({
        fileName: preview.file,
        source: 'Excel/CSV upload',
        rows,
      });
      const parts = [`${res.inserted} imported`];
      if (res.duplicates) parts.push(`${res.duplicates} duplicates`);
      if (res.skipped) parts.push(`${res.skipped} skipped`);
      show(parts.join(' · '), res.skipped ? 'warn' : 'success');
      if (res.errors?.length) {
        console.warn('upload errors', res.errors);
      }
      setPreview(null);
      refreshHistory();
      setVoterRefresh((n) => n + 1);
      setTab('voters');
    } catch (e) {
      show(e.message || 'Commit failed', 'error');
    }
  }

  return (
    <div className="shell">
      <PageHead
        title="Voter Detail"
        subtitle="Add voter records by hand, upload bulk data from Excel/CSV, or review submission history. Everything is checked before it's saved."
        stats={<StatGroup items={stats} />}
        actions={
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button>← Home</Button>
          </Link>
        }
      />

      <Tabs tabs={tabsWithCount} active={tab} onChange={setTab} />

      {tab === 'add' && (
        <>
          <RecordForm onSubmit={handleRecordSubmit} />
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
                  title="Upload Excel / CSV file"
                  subtitle="Drop your voter sheet here, or click to browse. You'll preview rows before saving."
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
              kind="voter"
              data={preview}
              onCancel={() => setPreview(null)}
              onCommit={handleCommitPreview}
            />
          )}
        </>
      )}

      {tab === 'voters' && (
        <VoterList
          refreshKey={voterRefresh}
          onError={(msg) => show(msg, 'error')}
        />
      )}

      {tab === 'history' && <HistoryTable rows={history} />}
    </div>
  );
}
