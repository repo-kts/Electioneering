import { useState } from 'react';
import { Link } from 'react-router-dom';
import RecordForm from '../components/upload/RecordForm.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import SessionCard from '../components/upload/SessionCard.jsx';
import { initialHistory } from '../data/history.js';
import { useToast } from '../context/ToastContext.jsx';
import { ClockIcon, PlusIcon, UploadIcon } from '../components/ui/Icon.jsx';

const TABS = [
  { key: 'add', label: 'Add Voter', Icon: PlusIcon },
  { key: 'upload', label: 'Upload File', Icon: UploadIcon },
  { key: 'history', label: 'History', Icon: ClockIcon, count: true },
];

function nowTime() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VoterDetailPage() {
  const [tab, setTab] = useState('add');
  const [history, setHistory] = useState(initialHistory);
  const { show } = useToast();

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

  function handleRecordSubmit({ ok, record, message }) {
    if (!ok) {
      show(message || 'Please fix the highlighted fields', 'error');
      return;
    }
    addHistoryRow(record, 'processing');
    show(`${record.records} ${record.records === 1 ? 'voter' : 'voters'} saved`);
    setTab('history');
  }

  function handleFileAccepted(file) {
    addHistoryRow(
      {
        file: file.name,
        source: 'Excel · Officer L2',
        records: Math.floor(Math.random() * 400) + 50,
        constituency: 'Bandra North',
      },
      'validated',
    );
    show('File uploaded successfully');
  }

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1>Voter Detail</h1>
          <p>
            Add voter records by hand, upload bulk data from Excel, or review the
            submission history. Everything is checked before it's saved.
          </p>
        </div>
        <Link
          to="/"
          className="btn"
          style={{ alignSelf: 'flex-start', textDecoration: 'none' }}
        >
          ← Back to Home
        </Link>
      </div>

      <div className="tabs">
        {TABS.map(({ key, label, Icon, count }) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon width="16" height="16" />
            {label}
            {count && <span className="tab-count">{history.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'add' && <RecordForm onSubmit={handleRecordSubmit} />}

      {tab === 'upload' && (
        <div className="two-col">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Upload Excel file</h2>
                <p>Drop your tally sheet here, or browse to select one from your computer.</p>
              </div>
            </div>
            <div className="card-body">
              <Dropzone onFileAccepted={handleFileAccepted} />
            </div>
          </div>
          <SessionCard />
        </div>
      )}

      {tab === 'history' && <HistoryTable rows={history} />}
    </div>
  );
}
