import { useMemo, useState } from 'react';
import { CheckIcon, CloseIcon, PlusIcon } from '../ui/Icon.jsx';
import {
  FORM20_CANDIDATES,
  FORM20_HEADER,
  FORM20_INITIAL_ROWS,
} from '../../data/form20Data.js';

/**
 * Form 20 — Detailed Result Sheet (per polling station).
 * Spreadsheet layout: rows = polling stations, columns = candidates + totals.
 */

const SUMMARY_COLS = [
  { key: 'validVotes', label: 'Total Valid' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'nota', label: 'NOTA' },
  { key: 'total', label: 'Total' },
  { key: 'tendered', label: 'Tendered' },
];

let nextId = FORM20_INITIAL_ROWS.length + 1;

function makeEmptyRow(serial) {
  const r = { id: nextId++, serial };
  FORM20_CANDIDATES.forEach((c) => {
    r[c.key] = '';
  });
  SUMMARY_COLS.forEach((c) => {
    r[c.key] = '';
  });
  return r;
}

export default function Form20({ onSubmit }) {
  const [header, setHeader] = useState(FORM20_HEADER);
  const [rows, setRows] = useState(FORM20_INITIAL_ROWS);

  function updateCell(id, key, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [key]: value };
        // Auto-recalc valid votes when a candidate cell changes
        if (FORM20_CANDIDATES.some((c) => c.key === key)) {
          const sum = FORM20_CANDIDATES.reduce(
            (acc, c) => acc + (Number(next[c.key]) || 0),
            0,
          );
          next.validVotes = sum ? String(sum) : '';
        }
        // Auto-recalc total when valid/rejected/nota change
        if (['validVotes', 'rejected', 'nota'].includes(key) || FORM20_CANDIDATES.some((c) => c.key === key)) {
          const t =
            (Number(next.validVotes) || 0) +
            (Number(next.rejected) || 0) +
            (Number(next.nota) || 0);
          next.total = t ? String(t) : '';
        }
        return next;
      }),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, makeEmptyRow(prev.length + 1)]);
  }

  function deleteRow(id) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      // re-number serials
      return next.map((r, i) => ({ ...r, serial: i + 1 }));
    });
  }

  function isRowEmpty(r) {
    return FORM20_CANDIDATES.every((c) => !String(r[c.key] || '').trim());
  }

  const totals = useMemo(() => {
    const sums = {};
    FORM20_CANDIDATES.forEach((c) => {
      sums[c.key] = rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
    });
    SUMMARY_COLS.forEach((c) => {
      sums[c.key] = rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
    });
    return sums;
  }, [rows]);

  const filledCount = useMemo(() => rows.filter((r) => !isRowEmpty(r)).length, [rows]);

  function handleSave() {
    if (filledCount === 0) {
      onSubmit?.({ ok: false, message: 'Add at least one polling station before saving' });
      return;
    }
    onSubmit?.({
      ok: true,
      record: {
        file: `form20_${header.assemblyName.toLowerCase().replace(/\s+/g, '_')}.xlsx`,
        source: `Form 20 · ${filledCount} polling stations · ${totals.total.toLocaleString()} total votes`,
        records: filledCount,
        constituency: header.assemblyName,
      },
    });
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Form 20 — Detailed Result Sheet</h2>
          <p>Polling-station-wise vote count for each candidate. Totals recalculate automatically.</p>
        </div>
      </div>

      <div className="card-body">
        {/* ─── Header info ─── */}
        <div className="form20-header">
          <div className="form20-header-row">
            <label>Total No. of Electors</label>
            <input
              type="number"
              value={header.totalElectors}
              onChange={(e) => setHeader({ ...header, totalElectors: e.target.value })}
            />
          </div>
          <div className="form20-header-row">
            <label>Assembly Constituency</label>
            <input
              type="text"
              value={header.assemblyName}
              onChange={(e) => setHeader({ ...header, assemblyName: e.target.value })}
            />
          </div>
          <div className="form20-header-row">
            <label>Election Type</label>
            <input
              type="text"
              value={header.electionType}
              onChange={(e) => setHeader({ ...header, electionType: e.target.value })}
            />
          </div>
        </div>

        {/* ─── Toolbar ─── */}
        <div className="grid-toolbar">
          <div className="row-count">
            <strong>{filledCount}</strong> of <strong>{rows.length}</strong> polling stations
            {' · '}
            <strong>{totals.total.toLocaleString()}</strong> total votes
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              <CheckIcon />
              Save Form 20
            </button>
          </div>
        </div>

        {/* ─── Spreadsheet ─── */}
        <div className="grid-wrap">
          <table className="voter-grid form20-grid">
            <thead>
              <tr>
                <th rowSpan="2" className="row-num">PS #</th>
                <th colSpan={FORM20_CANDIDATES.length} className="group-head">
                  No. of Valid Votes Cast in favour of
                </th>
                <th rowSpan="2">Valid Votes</th>
                <th rowSpan="2">Rejected</th>
                <th rowSpan="2">NOTA</th>
                <th rowSpan="2">Total</th>
                <th rowSpan="2">Tendered</th>
                <th rowSpan="2" className="actions-col" />
              </tr>
              <tr>
                {FORM20_CANDIDATES.map((c) => (
                  <th key={c.key} className="cand-head">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="row-num">{row.serial}</td>
                  {FORM20_CANDIDATES.map((c) => (
                    <td key={c.key} className="value">
                      <input
                        type="number"
                        min="0"
                        className="cell-input short"
                        value={row[c.key]}
                        onChange={(e) => updateCell(row.id, c.key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="value calc">
                    <input
                      type="number"
                      className="cell-input short"
                      value={row.validVotes}
                      readOnly
                      title="Auto-calculated from candidate votes"
                    />
                  </td>
                  <td className="value">
                    <input
                      type="number"
                      min="0"
                      className="cell-input short"
                      value={row.rejected}
                      onChange={(e) => updateCell(row.id, 'rejected', e.target.value)}
                    />
                  </td>
                  <td className="value">
                    <input
                      type="number"
                      min="0"
                      className="cell-input short"
                      value={row.nota}
                      onChange={(e) => updateCell(row.id, 'nota', e.target.value)}
                    />
                  </td>
                  <td className="value calc">
                    <input
                      type="number"
                      className="cell-input short"
                      value={row.total}
                      readOnly
                      title="Auto-calculated: Valid + Rejected + NOTA"
                    />
                  </td>
                  <td className="value">
                    <input
                      type="number"
                      min="0"
                      className="cell-input short"
                      value={row.tendered}
                      onChange={(e) => updateCell(row.id, 'tendered', e.target.value)}
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
              ))}

              {/* Totals row */}
              <tr className="totals-row">
                <td className="row-num">Σ</td>
                {FORM20_CANDIDATES.map((c) => (
                  <td key={c.key} className="totals-cell">
                    {totals[c.key].toLocaleString()}
                  </td>
                ))}
                <td className="totals-cell">{totals.validVotes.toLocaleString()}</td>
                <td className="totals-cell">{totals.rejected.toLocaleString()}</td>
                <td className="totals-cell">{totals.nota.toLocaleString()}</td>
                <td className="totals-cell">{totals.total.toLocaleString()}</td>
                <td className="totals-cell">{totals.tendered.toLocaleString()}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <button type="button" className="add-row-btn" onClick={addRow}>
          <PlusIcon />
          Add Polling Station
        </button>
      </div>
    </div>
  );
}
