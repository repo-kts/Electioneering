import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RecordForm from '../components/upload/RecordForm.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import UploadPreview from '../components/upload/UploadPreview.jsx';
import VoterList from '../components/upload/VoterList.jsx';
import FormatCard from '../components/upload/FormatCard.jsx';
import ValidationCard from '../components/upload/ValidationCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ClockIcon, PlusIcon, UploadIcon, FileSpreadsheetIcon } from '../components/ui/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import StatGroup from '../components/ui/StatGroup.jsx';
import { ErrorState, SkeletonRows, Spinner } from '../components/ui/Loader.jsx';
import { api } from '../lib/api.js';

const TABS = [
  { key: 'voters', label: 'Voters', Icon: FileSpreadsheetIcon },
  { key: 'add', label: 'Add Voter', Icon: PlusIcon },
  { key: 'upload', label: 'Upload File', Icon: UploadIcon },
  { key: 'history', label: 'History', Icon: ClockIcon },
];

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function VoterDetailPage() {
  const [tab, setTab] = useState('voters');
  const [historyQuery, setHistoryQuery] = useState('');
  const [preview, setPreview] = useState(null);
  const { show } = useToast();
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const historyQ = useQuery({
    queryKey: ['uploads', 'history'],
    queryFn: () => api.uploadHistory(),
    select: (raw) =>
      raw.items.map((h) => ({
        id: h.id,
        time: fmtTime(h.createdAt),
        file: h.fileName,
        source: h.source,
        records: h.records,
        constituency: h.constituency || '—',
        status: h.status,
      })),
  });

  const bulkVotersM = useMutation({
    mutationFn: (voters) => api.bulkVoters(voters),
    onSuccess: (res, _voters, ctx) => {
      show(`${res.inserted} of ${res.requested} voter${res.requested === 1 ? '' : 's'} saved`);
      ctx?.reset?.();
      qc.invalidateQueries({ queryKey: ['voters', 'list'] });
      qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
      setTab('voters');
    },
    onMutate: (_voters) => {
      // pass reset callback through context, not used yet
    },
    onError: (e) => show(e.message || 'Save failed', 'error'),
  });

  const previewM = useMutation({
    mutationFn: (file) => api.previewUpload(file, 'voter'),
    onSuccess: (data, file) => setPreview({ file: file.name, kind: 'voter', ...data }),
    onError: (e) => show(e.message || 'Upload failed', 'error'),
  });

  const commitPreviewM = useMutation({
    mutationFn: (rows) =>
      api.commitVoters({ fileName: preview.file, source: 'Excel/CSV upload', rows }),
    onSuccess: (res) => {
      const parts = [`${res.inserted} imported`];
      if (res.duplicates) parts.push(`${res.duplicates} duplicates`);
      if (res.skipped) parts.push(`${res.skipped} skipped`);
      show(parts.join(' · '), res.skipped ? 'warn' : 'success');
      if (res.errors?.length) console.warn('upload errors', res.errors);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['voters', 'list'] });
      qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
      setTab('voters');
    },
    onError: (e) => show(e.message || 'Commit failed', 'error'),
  });

  const history = historyQ.data ?? [];
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

  function handleRecordSubmit({ ok, voters, message, reset }) {
    if (!ok) {
      show(message || 'Please fix the highlighted fields', 'error');
      return;
    }
    bulkVotersM.mutate(voters, {
      onSuccess: (res) => {
        // Override outer onSuccess to call the reset callback from the form
        show(`${res.inserted} of ${res.requested} voter${res.requested === 1 ? '' : 's'} saved`);
        reset?.();
        qc.invalidateQueries({ queryKey: ['voters', 'list'] });
        qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
        setTab('voters');
      },
    });
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
          <RecordForm onSubmit={handleRecordSubmit} busy={bulkVotersM.isPending} />
          <div style={{ marginTop: 16 }}>
            <ValidationCard />
          </div>
        </>
      )}

      {tab === 'upload' && (
        <>
          {!preview && (
            <>
              <Card>
                <Card.Head
                  title="Upload Excel / CSV file"
                  subtitle="Drop your voter sheet here, or click to browse. You'll preview rows before saving."
                />
                <Card.Body>
                  <Dropzone onFileAccepted={(f) => previewM.mutate(f)} />
                  {previewM.isPending && (
                    <div className="qq-inline-busy" style={{ marginTop: 8 }}>
                      <Spinner size={12} /> parsing file…
                    </div>
                  )}
                  {previewM.isError && (
                    <div style={{ marginTop: 12 }}>
                      <ErrorState
                        error={previewM.error}
                        onRetry={() => previewM.reset()}
                        title="Couldn't parse file"
                      />
                    </div>
                  )}
                </Card.Body>
              </Card>
              <div style={{ marginTop: 16 }}>
                <FormatCard kind="voter" />
              </div>
            </>
          )}
          {preview && (
            <UploadPreview
              kind="voter"
              data={preview}
              onCancel={() => setPreview(null)}
              onCommit={(rows) => commitPreviewM.mutateAsync(rows)}
            />
          )}
        </>
      )}

      {tab === 'voters' && (
        <VoterList
          onError={(msg) => show(msg, 'error')}
          canDelete={hasRole('admin')}
        />
      )}

      {tab === 'history' && (() => {
        const q = historyQuery.toLowerCase();
        const filtered = history.filter((h) =>
          !q ||
          h.file?.toLowerCase().includes(q) ||
          h.source?.toLowerCase().includes(q) ||
          h.constituency?.toLowerCase().includes(q),
        );
        return (
          <>
            <div className="grid-toolbar" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search history (file / source / constituency)…"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="field"
                style={{ minWidth: 280 }}
              />
              {historyQuery && <Button onClick={() => setHistoryQuery('')}>Clear</Button>}
              <span className="row-count" style={{ marginLeft: 'auto' }}>
                {filtered.length} / {history.length}
                {historyQ.isFetching && (
                  <span className="qq-inline-busy" style={{ marginLeft: 8 }}>
                    <Spinner size={10} />
                  </span>
                )}
              </span>
            </div>
            {historyQ.isPending && <SkeletonRows rows={5} cols={5} rowHeight={32} />}
            {historyQ.isError && (
              <ErrorState
                error={historyQ.error}
                onRetry={() => historyQ.refetch()}
                title="Couldn't load history"
              />
            )}
            {historyQ.data && <HistoryTable rows={filtered} />}
          </>
        );
      })()}
    </div>
  );
}
