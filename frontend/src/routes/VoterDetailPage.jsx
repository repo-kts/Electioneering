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
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total } during a batched import
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState(''); // election id to copy FROM
  const [copyTarget, setCopyTarget] = useState(''); // election id to copy INTO
  const { show } = useToast();
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const electionsQ = useQuery({
    queryKey: ['elections'],
    queryFn: () => api.listElections(),
  });
  const elections = electionsQ.data?.items ?? [];
  const elLabel = (e) =>
    `${e.assemblyNo}-${e.assemblyName} (${e.state})${e.electionYear ? ` · ${e.electionYear}` : ''}`;

  const copyM = useMutation({
    mutationFn: () => api.copyVoters(Number(copyTarget), Number(copySource)),
    onSuccess: (res) => {
      const parts = [`${res.copied} voter${res.copied === 1 ? '' : 's'} copied`];
      if (res.duplicates) parts.push(`${res.duplicates} already present`);
      show(parts.join(' · '), res.duplicates ? 'warn' : 'success');
      setCopyOpen(false);
      setCopyTarget('');
      qc.invalidateQueries({ queryKey: ['voters'] });
      qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
    },
    onError: (e) => show(e.message || 'Copy failed', 'error'),
  });

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

  // Large rolls (30k+) are committed in batches so no single request is huge and
  // the user sees live progress. Everything (incl. Election ID) is in the rows.
  const BATCH = 2000;
  const commitPreviewM = useMutation({
    mutationFn: async (rows) => {
      let inserted = 0, linked = 0, skipped = 0, electionId = null;
      setUploadProgress({ done: 0, total: rows.length });
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const isLast = i + BATCH >= rows.length;
        const res = await api.commitVoters({
          fileName: preview.file,
          source: 'Excel/CSV upload',
          rows: chunk,
          finalize: isLast,
          totalRows: rows.length,
        });
        inserted += res.inserted || 0;
        linked += res.linked || 0;
        skipped += res.skipped || 0;
        electionId = res.electionId;
        setUploadProgress({ done: Math.min(i + BATCH, rows.length), total: rows.length });
      }
      return { inserted, linked, skipped, electionId };
    },
    onSuccess: (res) => {
      const parts = [`${res.inserted} voters added`];
      if (res.linked != null) parts.push(`${res.linked} mapped to booths`);
      if (res.skipped) parts.push(`${res.skipped} skipped`);
      show(parts.join(' · '), res.skipped ? 'warn' : 'success');
      setUploadProgress(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['voters', 'list'] });
      qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
      setTab('voters');
    },
    onError: (e) => {
      setUploadProgress(null);
      show(e.message || 'Commit failed', 'error');
    },
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
    <div>
      <PageHead
        title="Voter Detail"
        subtitle="Add voter records by hand, upload bulk data from Excel/CSV, or review submission history. Everything is checked before it's saved."
      />
      <div className="mb-5">
        <StatGroup items={stats} />
      </div>

      {/* Copy an existing election's roll into another election — no re-import. */}
      {hasRole('admin') && elections.length >= 2 && (
        <Card className="mb-5">
          <Card.Body>
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Copy voters</div>
                <div className="text-sm text-slate-600">Replicate one election's voters into another — same people, no manual Excel import.</div>
              </div>
              <select
                value={copySource}
                onChange={(e) => setCopySource(e.target.value)}
                className="w-auto"
                title="Election to copy from"
              >
                <option value="">— Copy from… —</option>
                {elections.map((e) => (
                  <option key={e.id} value={e.id}>{elLabel(e)}</option>
                ))}
              </select>
              <Button
                variant="primary"
                onClick={() => { setCopyTarget(''); setCopyOpen(true); }}
                disabled={!copySource}
              >
                Copy voters to…
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {copyOpen && copySource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !copyM.isPending && setCopyOpen(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card>
              <Card.Head
                title="Copy voters to another election"
                subtitle="Replicates the selected election's voters into the target — same people (no duplicates), on the target's booths. Predicted leaning resets and recomputes from the target's own Form 20."
              />
              <Card.Body>
                <div className="mb-3 text-sm text-slate-600">
                  From: <b>{elLabel(elections.find((e) => String(e.id) === String(copySource)) ?? {})}</b>
                </div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Copy into
                </label>
                <select
                  value={copyTarget}
                  onChange={(e) => setCopyTarget(e.target.value)}
                  className="mb-4 w-full"
                >
                  <option value="">— Select target election —</option>
                  {elections
                    .filter((e) => String(e.id) !== String(copySource))
                    .map((e) => (
                      <option key={e.id} value={e.id}>{elLabel(e)}</option>
                    ))}
                </select>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setCopyOpen(false)} disabled={copyM.isPending}>Cancel</Button>
                  <Button
                    variant="primary"
                    onClick={() => copyM.mutate()}
                    disabled={!copyTarget || copyM.isPending}
                  >
                    {copyM.isPending ? 'Copying…' : 'Copy voters'}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      )}

      <Tabs tabs={tabsWithCount} active={tab} onChange={setTab} />

      <div className="mt-5 space-y-4">
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
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
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
          {uploadProgress && (
            <div className="rounded-sm border border-slate-300 bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">Importing voters…</span>
                <span className="tabular-nums text-slate-500">
                  {uploadProgress.done.toLocaleString()} / {uploadProgress.total.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{ width: `${uploadProgress.total ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0}%` }}
                />
              </div>
            </div>
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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search history (file / source / constituency)…"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="min-w-[280px] flex-1"
              />
              {historyQuery && <Button onClick={() => setHistoryQuery('')}>Clear</Button>}
              <span className="ml-auto flex items-center gap-2 text-sm text-slate-500">
                {filtered.length} / {history.length}
                {historyQ.isFetching && <Spinner size={10} />}
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
    </div>
  );
}
