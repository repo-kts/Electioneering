import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form20 from '../components/upload/Form20.jsx';
import HistoryTable from '../components/upload/HistoryTable.jsx';
import Dropzone from '../components/upload/Dropzone.jsx';
import UploadPreview from '../components/upload/UploadPreview.jsx';
import FormatCard from '../components/upload/FormatCard.jsx';
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
import { ErrorState, SkeletonRows, Spinner } from '../components/ui/Loader.jsx';
import { api } from '../lib/api.js';

const TABS = [
    { key: 'form20', label: 'Vote Segement', Icon: FileSpreadsheetIcon },
    { key: 'upload', label: 'Upload File', Icon: UploadIcon },
    { key: 'history', label: 'History', Icon: ClockIcon },
];

function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function Form20Page() {
    const [tab, setTab] = useState('form20');
    const [selectedId, setSelectedId] = useState(null);
    const [preview, setPreview] = useState(null);
    const [historyQuery, setHistoryQuery] = useState('');
    const { show } = useToast();
    const qc = useQueryClient();

    const electionsQ = useQuery({
        queryKey: ['elections'],
        queryFn: () => api.listElections(),
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

    const previewM = useMutation({
        mutationFn: (file) => api.previewUpload(file, 'form20'),
        onSuccess: (data, file) => setPreview({ file: file.name, kind: 'form20', ...data }),
        onError: (e) => show(e.message || 'Upload failed', 'error'),
    });

    const commitM = useMutation({
        mutationFn: (rows) => {
            const eid = preview?.electionId;
            if (!eid) {
                const err = new Error('No Election ID found in the sheet. Create the election in Master Data and put its ID in the Election ID column.');
                err.status = 400;
                throw err;
            }
            return api.commitForm20({
                fileName: preview.file,
                source: 'Form 20 Excel/CSV upload',
                electionId: eid,
                candidates: preview.candidates,
                rows,
            });
        },
        onSuccess: (res) => {
            show(`Form 20 saved · election #${res.electionId}`);
            setPreview(null);
            setSelectedId(res.electionId);
            qc.invalidateQueries({ queryKey: ['elections'] });
            qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
            qc.invalidateQueries({ queryKey: ['analytics'] });
            setTab('form20');
        },
        onError: (e) => show(e.message || 'Commit failed', 'error'),
    });

    const elections = electionsQ.data?.items ?? [];
    const history = historyQ.data ?? [];
    const effectiveElectionId = selectedId ?? elections[0]?.id ?? null;

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
        qc.invalidateQueries({ queryKey: ['elections'] });
        qc.invalidateQueries({ queryKey: ['uploads', 'history'] });
        qc.invalidateQueries({ queryKey: ['analytics'] });
        setTab('history');
    }

    return (
        <div>
            <PageHead
                title="Vote Segement"
                subtitle="Detailed Result Sheet — polling-station-wise vote counts. Candidates and rows are dynamic."
            />
            <div className="mb-5">
                <StatGroup items={stats} />
            </div>

            <Tabs tabs={tabsWithCount} active={tab} onChange={setTab} />

            <div className="mt-5 space-y-4">
                {tab === 'form20' && (
                    <>
                        <Card>
                            <Card.Head title="Election" subtitle="Pick an existing election or create a new one below." />
                            <Card.Body>
                                {electionsQ.isPending && <SkeletonRows rows={1} cols={2} rowHeight={32} />}
                                {electionsQ.isError && (
                                    <ErrorState error={electionsQ.error} onRetry={() => electionsQ.refetch()} title="Couldn't load elections" />
                                )}
                                {electionsQ.data && (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <select
                                            value={selectedId ?? ''}
                                            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                                            className="w-auto"
                                        >
                                            <option value="">— New election —</option>
                                            {elections.map((e) => (
                                                <option key={e.id} value={e.id}>
                                                    {e.assemblyNo}-{e.assemblyName} ({e.state})
                                                </option>
                                            ))}
                                        </select>
                                        <Button onClick={() => setSelectedId(null)}>+ New Election</Button>
                                        {electionsQ.isFetching && (
                                            <span className="flex items-center gap-1.5 text-xs text-slate-500"><Spinner size={12} /> refreshing…</span>
                                        )}
                                    </div>
                                )}
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
                            <>
                                <Card>
                                    <Card.Head
                                        title="Upload Form 20 sheet"
                                        subtitle="Drop your Form 20 sheet — candidate columns are detected automatically. The election comes from the sheet's Election ID column (created in Master Data)."
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
                                                <ErrorState error={previewM.error} onRetry={() => previewM.reset()} title="Couldn't parse file" />
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                                <div style={{ marginTop: 16 }}>
                                    <FormatCard kind="form20" />
                                </div>
                            </>
                        )}
                        {preview && (
                            <UploadPreview
                                kind="form20"
                                data={preview}
                                commitDisabled={!preview.electionId}
                                onCancel={() => setPreview(null)}
                                onCommit={(rows) => commitM.mutateAsync(rows)}
                                headerExtras={(() => {
                                    const eid = preview.electionId;
                                    const match = elections.find((e) => e.id === eid);
                                    return eid ? (
                                        <div className="mb-3 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                            Election ID <span className="font-semibold">#{eid}</span> from the sheet
                                            {match ? <> · <span className="font-semibold">{match.assemblyNo}-{match.assemblyName} ({match.state})</span></> : ' · not found in Master Data — create it first'}
                                        </div>
                                    ) : (
                                        <div className="mb-3 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                            No <span className="font-semibold">Election ID</span> column detected. Add it to the sheet (create the election in Master Data → Elections).
                                        </div>
                                    );
                                })()}
                            />
                        )}
                    </>
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
