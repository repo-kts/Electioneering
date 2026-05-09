import { useCallback, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CheckIcon, CloseIcon } from '../ui/Icon.jsx';
import { useGridNav } from '../../lib/useGridNav.js';
import {
  validateVoterRow,
  validateForm20Row,
  GENDERS,
} from '../../lib/voterValidation.js';

/**
 * UploadPreview — full Excel-style editable grid for parsed upload rows.
 *
 * - Cells are inputs/selects bound to local state. Edits re-validate the
 *   row inline so the user can fix problems before commit.
 * - useGridNav gives Tab / Enter / arrows / multi-cell paste.
 * - Bad cells get a red highlight, a corner dot marker, and a custom
 *   tooltip on hover/focus showing the exact reason.
 * - Top banner lists the first 8 errors so the user has a punch list.
 */

const VOTER_COLUMNS = [
  { key: 'firstName', label: 'First Name', type: 'text', required: true, uppercase: true },
  { key: 'lastName', label: 'Last Name', type: 'text', required: true, uppercase: true },
  { key: 'relFirstName', label: 'Rel First', type: 'text', required: true, uppercase: true },
  { key: 'relLastName', label: 'Rel Last', type: 'text', required: true, uppercase: true },
  { key: 'age', label: 'Age', type: 'number', required: true, short: true, min: 18, max: 120 },
  { key: 'gender', label: 'Gender', type: 'select', options: GENDERS, required: true, short: true },
  { key: 'epic', label: 'EPIC', type: 'text', required: true, uppercase: true, maxLength: 10 },
  { key: 'mobile', label: 'Mobile', type: 'tel', maxLength: 10, short: true },
  { key: 'state', label: 'State', type: 'text', required: true },
  { key: 'parlNo', label: 'Parl No', type: 'text', required: true, short: true },
  { key: 'parlName', label: 'Parl Name', type: 'text', required: true },
  { key: 'assemblyNo', label: 'Asm No', type: 'text', required: true, short: true },
  { key: 'assemblyName', label: 'Asm Name', type: 'text', required: true },
  { key: 'pollingStationName', label: 'Polling Station', type: 'text', required: true, long: true },
  { key: 'partNumber', label: 'Part No', type: 'text', required: true, short: true },
  { key: 'partName', label: 'Part Name', type: 'text', long: true },
  { key: 'partSerial', label: 'Part Serial', type: 'text', required: true, short: true },
  { key: 'community', label: 'Community', type: 'text' },
  { key: 'occupation', label: 'Occupation', type: 'text' },
  { key: 'language', label: 'Language', type: 'text', short: true },
];

function flattenErrors(rows, max = 8) {
  const out = [];
  for (let i = 0; i < rows.length && out.length < max; i++) {
    const errs = rows[i].__errors || {};
    for (const [field, msg] of Object.entries(errs)) {
      out.push({ row: i + 1, field, msg });
      if (out.length >= max) break;
    }
  }
  return out;
}

export default function UploadPreview({ kind, data, onCancel, onCommit, headerExtras }) {
  const [rows, setRows] = useState(() =>
    data.rows.map((r, i) => ({ __id: i, __errors: r.__errors || {}, ...r })),
  );
  const [busy, setBusy] = useState(false);

  const isVoter = kind === 'voter';
  const candidates = data.candidates || [];

  // ─── Voter cols ─────────────────────────────────────────────────
  const voterCols = VOTER_COLUMNS;

  // ─── Form 20 cols mapping (matches Form20.jsx layout) ──────────
  const form20Cols = useMemo(() => {
    if (isVoter) return [];
    const m = [
      { kind: 'serial', label: 'PS #', short: true },
      { kind: 'name', label: 'PS Name' },
    ];
    candidates.forEach((c) => m.push({ kind: 'cand', candidate: c, label: c, short: true }));
    m.push({ kind: 'valid', label: 'Valid', short: true, readonly: true });
    m.push({ kind: 'rejectedVotes', label: 'Rejected', short: true });
    m.push({ kind: 'notaVotes', label: 'NOTA', short: true });
    m.push({ kind: 'total', label: 'Total', short: true, readonly: true });
    m.push({ kind: 'tenderedVotes', label: 'Tendered', short: true });
    return m;
  }, [isVoter, candidates]);

  const colCount = isVoter ? voterCols.length : form20Cols.length;

  function reValidate(row) {
    if (isVoter) return validateVoterRow(row);
    return validateForm20Row(row, candidates);
  }

  function updateVoterCell(rid, key, raw) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.__id !== rid) return r;
        const col = voterCols.find((c) => c.key === key);
        let v = raw;
        if (col?.uppercase && typeof v === 'string') v = v.toUpperCase();
        const next = { ...r, [key]: v };
        next.__errors = reValidate(next);
        return next;
      }),
    );
  }

  function updateForm20Cell(rid, def, raw) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.__id !== rid) return r;
        const next = { ...r, votes: { ...(r.votes || {}) } };
        if (def.kind === 'serial') next.serial = Number(raw) || 0;
        else if (def.kind === 'name') next.name = String(raw);
        else if (def.kind === 'cand') next.votes[def.candidate] = Number(raw) || 0;
        else if (def.kind === 'rejectedVotes' || def.kind === 'notaVotes' || def.kind === 'tenderedVotes') {
          next[def.kind] = Number(raw) || 0;
        }
        next.__errors = reValidate(next);
        return next;
      }),
    );
  }

  // Multi-cell paste (TSV from Excel)
  const onPasteMatrix = useCallback(
    (startRow, startCol, matrix) => {
      setRows((prev) => {
        const next = [...prev];
        const blankVoter = () =>
          Object.fromEntries(voterCols.map((c) => [c.key, ''])); // empty row
        const blankForm20 = () => ({
          serial: 1, name: '', votes: {},
          rejectedVotes: 0, notaVotes: 0, tenderedVotes: 0, total: 0,
        });

        matrix.forEach((line, di) => {
          const r = startRow + di;
          while (r >= next.length) {
            const seed = isVoter ? blankVoter() : blankForm20();
            next.push({ __id: Date.now() + Math.random(), __errors: {}, ...seed });
          }
          let row = { ...next[r] };
          if (!isVoter) row.votes = { ...(row.votes || {}) };
          line.forEach((rawVal, dj) => {
            const c = startCol + dj;
            if (c < 0 || c >= colCount) return;
            if (isVoter) {
              const col = voterCols[c];
              let v = String(rawVal ?? '');
              if (col.uppercase) v = v.toUpperCase();
              if (col.type === 'select' && col.options) {
                const m = col.options.find((o) => o.toLowerCase() === v.trim().toLowerCase());
                if (m) v = m;
              }
              if (col.maxLength) v = v.slice(0, col.maxLength);
              row[col.key] = v;
            } else {
              const def = form20Cols[c];
              if (!def || def.readonly) return;
              if (def.kind === 'serial') row.serial = Number(rawVal) || row.serial;
              else if (def.kind === 'name') row.name = String(rawVal ?? '').trim();
              else if (def.kind === 'cand') row.votes[def.candidate] = Number(rawVal) || 0;
              else if (def.kind === 'rejectedVotes' || def.kind === 'notaVotes' || def.kind === 'tenderedVotes') {
                row[def.kind] = Number(rawVal) || 0;
              }
            }
          });
          row.__errors = reValidate(row);
          next[r] = row;
        });
        return next;
      });
    },
    [isVoter, voterCols, form20Cols, candidates, colCount],
  );

  const { gridId, gridProps } = useGridNav({ cols: colCount, onPasteMatrix });

  // ─── Stats ─────────────────────────────────────────────────────
  const errorRowCount = useMemo(
    () => rows.filter((r) => Object.keys(r.__errors || {}).length > 0).length,
    [rows],
  );
  const validRowCount = rows.length - errorRowCount;
  const errorList = useMemo(() => flattenErrors(rows, 8), [rows]);

  function removeRow(id) {
    setRows((r) => r.filter((x) => x.__id !== id));
  }
  function removeInvalid() {
    setRows((r) => r.filter((x) => Object.keys(x.__errors || {}).length === 0));
  }

  async function commit() {
    setBusy(true);
    try {
      const cleaned = rows.map(({ __id, __errors, ...rest }) => rest);
      await onCommit(cleaned);
    } finally {
      setBusy(false);
    }
  }

  // ─── Cell renderers ────────────────────────────────────────────
  function renderVoterCell(row, col, ri, ci) {
    const err = row.__errors?.[col.key];
    const cls = `value${err ? ' cell-error' : ''}`;
    const widthClass = col.short ? 'short' : col.long ? 'long' : '';
    if (col.type === 'select') {
      return (
        <td key={col.key} className={cls} data-error={err || undefined}>
          <select
            className={`cell-input cell-select ${widthClass}`}
            value={row[col.key] ?? ''}
            data-row={ri}
            data-col={ci}
            onChange={(e) => updateVoterCell(row.__id, col.key, e.target.value)}
          >
            <option value="">—</option>
            {col.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </td>
      );
    }
    return (
      <td key={col.key} className={cls} data-error={err || undefined}>
        <input
          type={col.type}
          className={`cell-input ${widthClass}`}
          value={row[col.key] ?? ''}
          maxLength={col.maxLength}
          min={col.min}
          max={col.max}
          data-row={ri}
          data-col={ci}
          onChange={(e) => updateVoterCell(row.__id, col.key, e.target.value)}
          onFocus={(e) => {
            if (col.type !== 'date') {
              try {
                e.target.select();
              } catch {
                /* ignore */
              }
            }
          }}
        />
      </td>
    );
  }

  function rowValid(r) {
    return candidates.reduce((acc, c) => acc + (Number(r.votes?.[c]) || 0), 0);
  }
  function rowTotal(r) {
    return rowValid(r) + (Number(r.rejectedVotes) || 0) + (Number(r.notaVotes) || 0);
  }

  function renderForm20Cell(row, def, ri, ci) {
    const errKey =
      def.kind === 'serial' ? 'serial' :
      def.kind === 'cand' ? def.candidate :
      def.kind === 'rejectedVotes' ? 'rejectedVotes' :
      def.kind === 'notaVotes' ? 'notaVotes' :
      def.kind === 'tenderedVotes' ? 'tenderedVotes' : null;
    const err = errKey ? row.__errors?.[errKey] : null;
    const cls = `value${err ? ' cell-error' : ''}${
      def.readonly ? ' calc' : ''
    }`;
    const value =
      def.kind === 'serial' ? row.serial :
      def.kind === 'name' ? (row.name ?? '') :
      def.kind === 'cand' ? (row.votes?.[def.candidate] ?? '') :
      def.kind === 'valid' ? rowValid(row) :
      def.kind === 'total' ? rowTotal(row) :
      row[def.kind];
    return (
      <td key={def.label + ci} className={cls} data-error={err || undefined}>
        <input
          type={def.kind === 'name' ? 'text' : 'number'}
          min={def.kind === 'serial' ? 1 : 0}
          className={`cell-input ${def.short ? 'short' : ''}`}
          value={value ?? ''}
          readOnly={def.readonly}
          data-row={ri}
          data-col={ci}
          onChange={(e) => !def.readonly && updateForm20Cell(row.__id, def, e.target.value)}
          onFocus={(e) => {
            try {
              e.target.select();
            } catch {
              /* ignore */
            }
          }}
        />
      </td>
    );
  }

  return (
    <Card>
      <Card.Head
        title={`Preview · ${data.fileName}`}
        subtitle={
          isVoter
            ? 'Edit any cell inline. Bad cells stay highlighted until fixed; hover for the reason. Save commits the rows the server still considers valid.'
            : `Edit any cell inline. ${candidates.length} candidate column${
                candidates.length === 1 ? '' : 's'
              } detected. Hover red cells for the reason.`
        }
      />
      <Card.Body>
        {headerExtras}

        {/* Error summary banner */}
        {errorRowCount > 0 && (
          <div className="errors-banner">
            <div className="errors-banner-head">
              <span>
                {errorRowCount} row{errorRowCount === 1 ? '' : 's'} with format errors
              </span>
              <Button onClick={removeInvalid} size="sm" disabled={busy}>
                Remove invalid
              </Button>
            </div>
            <ul>
              {errorList.map((e, i) => (
                <li key={i}>
                  Row {e.row} — <code>{e.field}</code>: {e.msg}
                </li>
              ))}
              {errorRowCount > 8 && <li>… and more</li>}
            </ul>
          </div>
        )}

        <div className="grid-toolbar">
          <div className="row-count">
            <strong style={{ color: 'var(--success, #16a34a)' }}>{validRowCount}</strong> valid
            {errorRowCount > 0 && (
              <span style={{ color: 'var(--danger)', marginLeft: 12 }}>
                · <strong>{errorRowCount}</strong> with errors
              </span>
            )}
            <span style={{ marginLeft: 12, color: 'var(--text-3)' }}>
              of {rows.length} row{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button
              variant="primary"
              leadingIcon={<CheckIcon />}
              onClick={commit}
              disabled={busy || rows.length === 0}
            >
              {busy ? 'Saving…' : `Save ${rows.length} record${rows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>

        <div className="grid-wrap">
          <table
            className="voter-grid excel-compact"
            data-grid-id={gridId}
            {...gridProps}
          >
            <thead>
              <tr>
                <th className="row-num">#</th>
                {isVoter
                  ? voterCols.map((c) => (
                      <th key={c.key} className={c.required ? 'req-col' : ''}>
                        {c.label}
                      </th>
                    ))
                  : form20Cols.map((c) => <th key={c.label}>{c.label}</th>)}
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const hasErr = Object.keys(row.__errors || {}).length > 0;
                return (
                  <tr key={row.__id} className={hasErr ? 'row-has-error' : ''}>
                    <td className="row-num">{ri + 1}</td>
                    {isVoter
                      ? voterCols.map((c, ci) => renderVoterCell(row, c, ri, ci))
                      : form20Cols.map((d, ci) => renderForm20Cell(row, d, ri, ci))}
                    <td className="actions-col">
                      <button
                        type="button"
                        className="row-delete"
                        title="Remove row"
                        onClick={() => removeRow(row.__id)}
                      >
                        <CloseIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount + 2} className="grid-empty">
                    No rows to import.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
