import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, CloseIcon, PlusIcon } from '../ui/Icon.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import { api } from '../../lib/api.js';
import { useGridNav } from '../../lib/useGridNav.js';

/**
 * Form 20 — Detailed Result Sheet (per polling station).
 * Spreadsheet layout: rows = polling stations, columns = candidates + totals.
 * Candidates are dynamic — add, rename, remove from the API.
 */

const SUMMARY_COLS = [
    { key: 'rejectedVotes', label: 'Rejected' },
    { key: 'notaVotes', label: 'NOTA' },
    { key: 'tenderedVotes', label: 'Tendered' },
];

let nextLocalRowId = -1;
function makeEmptyRow(serial) {
    return {
        id: nextLocalRowId--,
        serial,
        code: '',
        name: '',
        votes: {},
        rejectedVotes: 0,
        notaVotes: 0,
        tenderedVotes: 0,
    };
}

export default function Form20({ electionId, onSubmit, onChangeElection }) {
    const [election, setElection] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [rows, setRows] = useState([]);
    const [header, setHeader] = useState({
        state: '',
        parlNo: '',
        parlName: '',
        assemblyNo: '',
        assemblyName: '',
        electionType: 'Assembly Election',
        totalElectors: '',
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [newCandName, setNewCandName] = useState('');
    const [newCandParty, setNewCandParty] = useState('');
    const [newCandAlliance, setNewCandAlliance] = useState('');

    // Master-driven party + alliance options for candidate setup.
    const partyQ = useQuery({ queryKey: ['master-options', 'party'], queryFn: () => api.masterOptions('party') });
    const allianceQ = useQuery({ queryKey: ['master-options', 'alliance'], queryFn: () => api.masterOptions('alliance') });

    // Load existing election (if any)
    useEffect(() => {
        if (!electionId) return;
        setLoading(true);
        api
            .getElection(electionId)
            .then((e) => {
                setElection(e);
                setCandidates(e.candidates);
                setRows(
                    (e.booths ?? []).map((ps) => {
                        const votes = {};
                        for (const v of ps.voteResults) votes[v.candidateId] = v.votes;
                        return {
                            id: ps.id,
                            serial: ps.serial,
                            code: ps.pollingStation?.code || '',
                            name: ps.name || ps.pollingStation?.name || '',
                            votes,
                            rejectedVotes: ps.rejectedVotes,
                            notaVotes: ps.notaVotes,
                            tenderedVotes: ps.tenderedVotes,
                        };
                    }),
                );
                setHeader({
                    state: e.state,
                    parlNo: e.parlNo,
                    parlName: e.parlName,
                    assemblyNo: e.assemblyNo,
                    assemblyName: e.assemblyName,
                    electionType: e.electionType,
                    totalElectors: e.totalElectors ?? '',
                });
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [electionId]);

    async function createElection() {
        setSaving(true);
        try {
            const body = { ...header, totalElectors: header.totalElectors ? Number(header.totalElectors) : undefined };
            const e = await api.createElection(body);
            setElection(e);
            onChangeElection?.(e);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function saveHeader() {
        if (!election) return;
        const body = { ...header, totalElectors: header.totalElectors ? Number(header.totalElectors) : undefined };
        const updated = await api.updateElection(election.id, body);
        setElection(updated);
    }

    async function addCandidate() {
        if (!election || !newCandName.trim()) return;
        const c = await api.addCandidate(election.id, {
            name: newCandName.trim(),
            party: newCandParty || undefined,
            alliance: newCandAlliance || undefined,
        });
        setCandidates((cs) => [...cs, c]);
        setNewCandName('');
        setNewCandParty('');
        setNewCandAlliance('');
    }

    async function removeCandidate(cid) {
        if (!election) return;
        await api.deleteCandidate(election.id, cid);
        setCandidates((cs) => cs.filter((c) => c.id !== cid));
        setRows((rs) =>
            rs.map((r) => {
                const next = { ...r, votes: { ...r.votes } };
                delete next.votes[cid];
                return next;
            }),
        );
    }

    async function renameCandidate(cid, name) {
        if (!election) return;
        const updated = await api.updateCandidate(election.id, cid, { name });
        setCandidates((cs) => cs.map((c) => (c.id === cid ? updated : c)));
    }

    function updateCell(rowId, key, value) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.id !== rowId) return r;
                if (key === 'name') return { ...r, name: value };
                if (key === 'code') return { ...r, code: value };
                if (key === 'serial') return { ...r, serial: Number(value) || 0 };
                if (typeof key === 'object' && key.candidateId != null) {
                    return { ...r, votes: { ...r.votes, [key.candidateId]: Number(value) || 0 } };
                }
                return { ...r, [key]: Number(value) || 0 };
            }),
        );
    }

    function addRow() {
        setRows((prev) => [...prev, makeEmptyRow(prev.length + 1)]);
    }

    function deleteRow(id) {
        setRows((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, serial: i + 1 })));
    }

    const totals = useMemo(() => {
        const sums = { rejectedVotes: 0, notaVotes: 0, tenderedVotes: 0, valid: 0, total: 0 };
        const candTotals = {};
        candidates.forEach((c) => (candTotals[c.id] = 0));
        rows.forEach((r) => {
            let valid = 0;
            candidates.forEach((c) => {
                const v = Number(r.votes[c.id]) || 0;
                candTotals[c.id] += v;
                valid += v;
            });
            sums.valid += valid;
            sums.rejectedVotes += Number(r.rejectedVotes) || 0;
            sums.notaVotes += Number(r.notaVotes) || 0;
            sums.tenderedVotes += Number(r.tenderedVotes) || 0;
            sums.total += valid + (Number(r.rejectedVotes) || 0) + (Number(r.notaVotes) || 0);
        });
        return { ...sums, cand: candTotals };
    }, [rows, candidates]);

    function rowValid(r) {
        return candidates.reduce((acc, c) => acc + (Number(r.votes[c.id]) || 0), 0);
    }
    function rowTotal(r) {
        return rowValid(r) + (Number(r.rejectedVotes) || 0) + (Number(r.notaVotes) || 0);
    }

    // colMap drives Excel-like paste targeting. Layout matches the rendered
    // table exactly: 0 serial, 1 UNIQUE_CODE, 2 ps name, 3..N candidates, then
    // Valid (RO), Rejected, NOTA, Total (RO), Tendered.
    const colMap = useMemo(() => {
        const m = [{ kind: 'serial' }, { kind: 'code' }, { kind: 'name' }];
        candidates.forEach((c) => m.push({ kind: 'cand', id: c.id }));
        m.push({ kind: 'valid', readonly: true });
        m.push({ kind: 'rejectedVotes' });
        m.push({ kind: 'notaVotes' });
        m.push({ kind: 'total', readonly: true });
        m.push({ kind: 'tenderedVotes' });
        return m;
    }, [candidates]);

    const onPasteMatrix = useCallback(
        (startRow, startCol, matrix) => {
            const num = (v) => {
                const n = Number(String(v ?? '').replace(/,/g, '').trim());
                return Number.isFinite(n) ? n : 0;
            };
            setRows((prev) => {
                const next = [...prev];
                matrix.forEach((line, di) => {
                    const r = startRow + di;
                    while (r >= next.length) {
                        next.push({
                            id: -(Date.now() + Math.random()),
                            serial: next.length + 1,
                            code: '',
                            name: '',
                            votes: {},
                            rejectedVotes: 0,
                            notaVotes: 0,
                            tenderedVotes: 0,
                        });
                    }
                    const row = { ...next[r], votes: { ...next[r].votes } };
                    line.forEach((rawVal, dj) => {
                        const c = startCol + dj;
                        const def = colMap[c];
                        if (!def || def.readonly) return;
                        if (def.kind === 'serial') {
                            row.serial = num(rawVal) || row.serial;
                        } else if (def.kind === 'code') {
                            row.code = String(rawVal ?? '').trim();
                        } else if (def.kind === 'name') {
                            row.name = String(rawVal ?? '').trim();
                        } else if (def.kind === 'cand') {
                            row.votes[def.id] = num(rawVal);
                        } else if (
                            def.kind === 'rejectedVotes' ||
                            def.kind === 'notaVotes' ||
                            def.kind === 'tenderedVotes'
                        ) {
                            row[def.kind] = num(rawVal);
                        }
                    });
                    next[r] = row;
                });
                return next;
            });
        },
        [colMap],
    );

    const { gridId, gridProps } = useGridNav({
        cols: colMap.length,
        onPasteMatrix,
    });

    async function handleSave() {
        if (!election) {
            setError('Create the election header first.');
            return;
        }
        if (rows.length === 0) {
            onSubmit?.({ ok: false, message: 'Add at least one polling station' });
            return;
        }
        const missingCode = rows.filter((r) => !String(r.code || '').trim()).length;
        if (missingCode > 0) {
            setError(`${missingCode} row${missingCode === 1 ? '' : 's'} missing a UNIQUE_CODE. Every polling station must name its master booth by code.`);
            return;
        }
        setSaving(true);
        try {
            const payload = rows.map((r) => ({
                code: String(r.code).trim(),
                serial: Number(r.serial) || 0,
                rejectedVotes: Number(r.rejectedVotes) || 0,
                notaVotes: Number(r.notaVotes) || 0,
                tenderedVotes: Number(r.tenderedVotes) || 0,
                votes: Object.fromEntries(
                    candidates.map((c) => [String(c.id), Number(r.votes[c.id]) || 0]),
                ),
            }));
            await api.saveForm20(election.id, payload);
            onSubmit?.({
                ok: true,
                record: {
                    file: `form20_${header.assemblyName.toLowerCase().replace(/\s+/g, '_')}.json`,
                    source: `Form 20 · ${rows.length} polling stations · ${totals.total.toLocaleString()} votes`,
                    records: rows.length,
                    constituency: `${header.assemblyNo}-${header.assemblyName}`,
                },
            });
        } catch (err) {
            setError(err.message);
            onSubmit?.({ ok: false, message: err.message });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card>
            <Card.Head
                title="Form 20 — Detailed Result Sheet"
                subtitle="Excel-style grid: Tab / Enter / arrows to move between cells, paste a TSV block from Excel to fill many polling stations at once. Totals recalc live."
            />
            <Card.Body>
                {error && <div className="form20-error" style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>}
                {loading && <div>Loading…</div>}

                {/* ─── Header info ─── */}
                <div className="form20-header">
                    {[
                        ['state', 'State'],
                        ['parlNo', 'Parl. No'],
                        ['parlName', 'Parl. Name'],
                        ['assemblyNo', 'Assembly No'],
                        ['assemblyName', 'Assembly Name'],
                        ['totalElectors', 'Total Electors'],
                        ['electionType', 'Election Type'],
                    ].map(([k, label]) => (
                        <div key={k} className="form20-header-row">
                            <label>{label}</label>
                            <input
                                type={k === 'totalElectors' ? 'number' : 'text'}
                                value={header[k] ?? ''}
                                onChange={(e) => setHeader({ ...header, [k]: e.target.value })}
                                onBlur={election ? saveHeader : undefined}
                            />
                        </div>
                    ))}
                </div>

                {!election && (
                    <div style={{ margin: '12px 0' }}>
                        <Button variant="primary" onClick={createElection} disabled={saving || !header.assemblyNo || !header.assemblyName}>
                            {saving ? 'Creating…' : 'Create Election'}
                        </Button>
                        <span style={{ marginLeft: 12, color: '#475569', fontSize: 12 }}>
                            Saves the election header. After this, add candidates and polling-station rows.
                        </span>
                    </div>
                )}

                {/* ─── Candidate manager ─── */}
                {election && (
                    <div className="form20-cand-manager" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                        <strong>Candidates ({candidates.length}):</strong>
                        <input
                            type="text"
                            placeholder="Candidate name"
                            value={newCandName}
                            onChange={(e) => setNewCandName(e.target.value)}
                            style={{ padding: 6 }}
                        />
                        <select
                            value={newCandParty}
                            onChange={(e) => setNewCandParty(e.target.value)}
                            style={{ padding: 6, width: 140 }}
                        >
                            <option value="">Party…</option>
                            {(partyQ.data?.options ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
                        </select>
                        <select
                            value={newCandAlliance}
                            onChange={(e) => setNewCandAlliance(e.target.value)}
                            style={{ padding: 6, width: 140 }}
                        >
                            <option value="">Alliance…</option>
                            {(allianceQ.data?.options ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
                        </select>
                        <Button leadingIcon={<PlusIcon />} onClick={addCandidate} disabled={!newCandName.trim()}>
                            Add Candidate
                        </Button>
                    </div>
                )}

                {/* ─── Toolbar ─── */}
                <div className="grid-toolbar">
                    <div className="row-count">
                        <strong>{rows.length}</strong> polling stations · <strong>{totals.total.toLocaleString()}</strong> total votes
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="primary" leadingIcon={<CheckIcon />} onClick={handleSave} disabled={saving || !election}>
                            {saving ? 'Saving…' : 'Save Form 20'}
                        </Button>
                    </div>
                </div>

                {/* ─── Spreadsheet ─── */}
                {election && candidates.length > 0 && (
                    <>
                        <div className="grid-wrap">
                            <table className="voter-grid form20-grid excel-compact" data-grid-id={gridId} {...gridProps}>
                                <thead>
                                    <tr>
                                        <th rowSpan="2" className="row-num">PS #</th>
                                        <th rowSpan="2">UNIQUE_CODE</th>
                                        <th rowSpan="2">PS Name</th>
                                        <th colSpan={candidates.length} className="group-head">
                                            No. of Valid Votes Cast in favour of
                                        </th>
                                        <th rowSpan="2">Valid</th>
                                        <th rowSpan="2">Rejected</th>
                                        <th rowSpan="2">NOTA</th>
                                        <th rowSpan="2">Total</th>
                                        <th rowSpan="2">Tendered</th>
                                        <th rowSpan="2" className="actions-col" />
                                    </tr>
                                    <tr>
                                        {candidates.map((c) => (
                                            <th key={c.id} className="cand-head">
                                                <input
                                                    type="text"
                                                    value={c.name}
                                                    onChange={(e) =>
                                                        setCandidates((cs) => cs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
                                                    }
                                                    onBlur={(e) => renameCandidate(c.id, e.target.value)}
                                                    style={{ width: '100%', fontSize: 12, padding: 2 }}
                                                />
                                                {(c.party || c.alliance) && (
                                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                                        {c.party || '—'}{c.alliance ? ` · ${c.alliance}` : ''}
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    className="row-delete"
                                                    title="Remove candidate"
                                                    onClick={() => removeCandidate(c.id)}
                                                    style={{ marginTop: 4 }}
                                                >
                                                    <CloseIcon />
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, ri) => {
                                        const candStart = 3;
                                        const validCol = candStart + candidates.length;
                                        const rejectedCol = validCol + 1;
                                        const notaCol = validCol + 2;
                                        const totalCol = validCol + 3;
                                        const tenderedCol = validCol + 4;
                                        const onFocusSelect = (e) => {
                                            try {
                                                e.target.select();
                                            } catch {
                                                /* ignore */
                                            }
                                        };
                                        return (
                                            <tr key={row.id}>
                                                <td className="row-num">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="cell-input short"
                                                        value={row.serial}
                                                        data-row={ri}
                                                        data-col={0}
                                                        onFocus={onFocusSelect}
                                                        onChange={(e) => updateCell(row.id, 'serial', e.target.value)}
                                                    />
                                                </td>
                                                <td className="value">
                                                    <input
                                                        type="text"
                                                        className="cell-input"
                                                        value={row.code}
                                                        data-row={ri}
                                                        data-col={1}
                                                        placeholder="UNIQUE_CODE"
                                                        onFocus={onFocusSelect}
                                                        onChange={(e) => updateCell(row.id, 'code', e.target.value)}
                                                    />
                                                </td>
                                                <td className="value">
                                                    <input
                                                        type="text"
                                                        className="cell-input"
                                                        value={row.name}
                                                        data-row={ri}
                                                        data-col={2}
                                                        onFocus={onFocusSelect}
                                                        onChange={(e) => updateCell(row.id, 'name', e.target.value)}
                                                    />
                                                </td>
                                                {candidates.map((c, ci) => (
                                                    <td key={c.id} className="value">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="cell-input short"
                                                            value={row.votes[c.id] ?? ''}
                                                            data-row={ri}
                                                            data-col={candStart + ci}
                                                            onFocus={onFocusSelect}
                                                            onChange={(e) => updateCell(row.id, { candidateId: c.id }, e.target.value)}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="value calc">
                                                    <input
                                                        type="number"
                                                        className="cell-input short"
                                                        value={rowValid(row)}
                                                        data-row={ri}
                                                        data-col={validCol}
                                                        readOnly
                                                    />
                                                </td>
                                                <td className="value">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="cell-input short"
                                                        value={row.rejectedVotes}
                                                        data-row={ri}
                                                        data-col={rejectedCol}
                                                        onFocus={onFocusSelect}
                                                        onChange={(e) => updateCell(row.id, 'rejectedVotes', e.target.value)}
                                                    />
                                                </td>
                                                <td className="value">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="cell-input short"
                                                        value={row.notaVotes}
                                                        data-row={ri}
                                                        data-col={notaCol}
                                                        onFocus={onFocusSelect}
                                                        onChange={(e) => updateCell(row.id, 'notaVotes', e.target.value)}
                                                    />
                                                </td>
                                                <td className="value calc">
                                                    <input
                                                        type="number"
                                                        className="cell-input short"
                                                        value={rowTotal(row)}
                                                        data-row={ri}
                                                        data-col={totalCol}
                                                        readOnly
                                                    />
                                                </td>
                                                <td className="value">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="cell-input short"
                                                        value={row.tenderedVotes}
                                                        data-row={ri}
                                                        data-col={tenderedCol}
                                                        onFocus={onFocusSelect}
                                                        onChange={(e) => updateCell(row.id, 'tenderedVotes', e.target.value)}
                                                    />
                                                </td>
                                                <td className="actions-col">
                                                    <button
                                                        type="button"
                                                        className="row-delete"
                                                        title="Delete polling station"
                                                        onClick={() => deleteRow(row.id)}
                                                    >
                                                        <CloseIcon />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Totals row */}
                                    <tr className="totals-row">
                                        <td className="row-num">Σ</td>
                                        <td />
                                        <td />
                                        {candidates.map((c) => (
                                            <td key={c.id} className="totals-cell">
                                                {(totals.cand[c.id] ?? 0).toLocaleString()}
                                            </td>
                                        ))}
                                        <td className="totals-cell">{totals.valid.toLocaleString()}</td>
                                        <td className="totals-cell">{totals.rejectedVotes.toLocaleString()}</td>
                                        <td className="totals-cell">{totals.notaVotes.toLocaleString()}</td>
                                        <td className="totals-cell">{totals.total.toLocaleString()}</td>
                                        <td className="totals-cell">{totals.tenderedVotes.toLocaleString()}</td>
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <button type="button" className="add-row-btn" onClick={addRow}>
                            <PlusIcon />
                            Add Polling Station
                        </button>
                    </>
                )}

                {election && candidates.length === 0 && (
                    <div style={{ padding: 16, color: '#475569' }}>
                        Add at least one candidate above to start filling the spreadsheet.
                    </div>
                )}
            </Card.Body>
        </Card>
    );
}
