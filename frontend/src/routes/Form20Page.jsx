import { useState } from 'react';
import { Link } from 'react-router-dom';
import Form20 from '../components/upload/Form20.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import SessionCard from '../components/upload/SessionCard.jsx';
import { initialHistory } from '../data/history.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  ClockIcon,
  FileSpreadsheetIcon,
  UploadIcon,
} from '../components/ui/Icon.jsx';

const TABS = [
  { key: 'form20', label: 'Form 20', Icon: FileSpreadsheetIcon },
  { key: 'upload', label: 'Upload File', Icon: UploadIcon },
  { key: 'history', label: 'History', Icon: ClockIcon, count: true },
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
      <div className="page-head">
        <div>
          <h1>Form 20</h1>
          <p>
            Detailed Result Sheet — polling-station-wise vote counts for each candidate.
            Edit any cell, totals recalculate automatically.
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

      {tab === 'form20' && <Form20 onSubmit={handleSubmit} />}

      {tab === 'upload' && (
        <div className="two-col">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Upload Form 20 Excel</h2>
                <p>Drop your filled-in Form 20 sheet here, or browse to select one from your computer.</p>
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
