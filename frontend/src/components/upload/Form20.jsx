import { useCallback, useEffect, useMemo, useState } from 'react';
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
          e.pollingStations.map((ps) => {
            const votes = {};
            for (const v of ps.voteResults) votes[v.candidateId] = v.votes;
            return {
              id: ps.id,
              serial: ps.serial,
              name: ps.name || '',
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
    const c = await api.addCandidate(election.id, { name: newCandName.trim(), party: newCandParty.trim() || undefined });
    setCandidates((cs) => [...cs, c]);
    setNewCandName('');
    setNewCandParty('');
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
  // table exactly: 0 serial, 1 ps name, 2..N candidates, then Valid (RO),
  // Rejected, NOTA, Total (RO), Tendered.
  const colMap = useMemo(() => {
    const m = [{ kind: 'serial' }, { kind: 'name' }];
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
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        serial: Number(r.serial) || 0,
        name: r.name || undefined,
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
        {error && <div className="form20-error" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
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
            <span style={{ marginLeft: 12, color: 'var(--text-2)', fontSize: 12 }}>
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
            <input
              type="text"
              placeholder="Party (optional)"
              value={newCandParty}
              onChange={(e) => setNewCandParty(e.target.value)}
              style={{ padding: 6, width: 140 }}
            />
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
                    const candStart = 2;
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
                          value={row.name}
                          data-row={ri}
                          data-col={1}
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
          <div style={{ padding: 16, color: 'var(--text-2)' }}>
            Add at least one candidate above to start filling the spreadsheet.
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
