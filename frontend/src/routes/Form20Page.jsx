import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Form20 from '../components/upload/Form20.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import SessionCard from '../components/upload/SessionCard.jsx';
import ValidationCard from '../components/upload/ValidationCard.jsx';
import { initialHistory } from '../data/history.js';
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

const TABS = [
  { key: 'form20', label: 'Form 20', Icon: FileSpreadsheetIcon },
  { key: 'upload', label: 'Upload File', Icon: UploadIcon },
  { key: 'history', label: 'History', Icon: ClockIcon },
];

function nowTime() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Form20Page() {
  const [tab, setTab] = useState('form20');
  const [history, setHistory] = useState(initialHistory);
  const { show } = useToast();

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

  function addHistoryRow(partial, status) {
    const row = { id: Date.now(), time: nowTime(), status, ...partial };
    setHistory((h) => [row, ...h]);
    if (status === 'processing') {
      setTimeout(() => {
        setHistory((h) =>
          h.map((r) => (r.id === row.id ? { ...r, status: 'validated' } : r)),
        );
      }, 3500);
    }
  }

  function handleSubmit({ ok, record, message }) {
    if (!ok) {
      show(message || 'Please fix the highlighted fields', 'error');
      return;
    }
    addHistoryRow(record, 'processing');
    show('Form 20 saved');
    setTab('history');
  }

  function handleFileAccepted(file) {
    addHistoryRow(
      {
        file: file.name,
        source: 'Form 20 Excel · Officer L2',
        records: Math.floor(Math.random() * 50) + 20,
        constituency: '172-Biharsharif',
      },
      'validated',
    );
    show('File uploaded successfully');
  }

  return (
    <div className="shell">
      <PageHead
        title="Form 20"
        subtitle="Detailed Result Sheet — polling-station-wise vote counts for each candidate. Edit any cell, totals recalculate automatically."
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
          <Form20 onSubmit={handleSubmit} />
          <div style={{ marginTop: 16 }}>
            <ValidationCard />
          </div>
        </>
      )}

      {tab === 'upload' && (
        <div className="two-col">
          <Card>
            <Card.Head
              title="Upload Form 20 Excel"
              subtitle="Drop your filled-in Form 20 sheet here, or browse to select one from your computer."
            />
            <Card.Body>
              <Dropzone onFileAccepted={handleFileAccepted} />
            </Card.Body>
          </Card>
          <SessionCard />
        </div>
      )}

      {tab === 'history' && <HistoryTable rows={history} />}
    </div>
  );
}
