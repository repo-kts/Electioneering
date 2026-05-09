import { useCallback, useMemo, useState } from 'react';
import { CheckIcon, CloseIcon, PlusIcon } from '../ui/Icon.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import {
  EPIC_PATTERN,
  GENDER_OPTIONS,
  INDIAN_STATES,
} from '../../data/voterForm.js';
import { useGridNav } from '../../lib/useGridNav.js';

/**
 * Spreadsheet-style data entry. Each row is a voter record;
 * each column is a field. Click "+ Add Row" to insert a row,
 * type into cells, then "Save All" to submit the batch.
 */

const COLUMNS = [
  { key: 'firstName', label: 'First Name', type: 'text', required: true, placeholder: 'SAHIL', uppercase: true },
  { key: 'lastName', label: 'Last Name', type: 'text', required: true, placeholder: 'SAXENA', uppercase: true },
  { key: 'relFirstName', label: "Relative's First Name", type: 'text', required: true, placeholder: 'SANJAY', uppercase: true },
  { key: 'relLastName', label: "Relative's Last Name", type: 'text', required: true, placeholder: 'KUMAR', uppercase: true },
  { key: 'age', label: 'Age', type: 'number', required: true, placeholder: '23', short: true, min: 18, max: 120 },
  { key: 'gender', label: 'Gender', type: 'select', required: true, options: GENDER_OPTIONS, short: true },
  { key: 'epic', label: 'EPIC No', type: 'text', required: true, placeholder: 'TGK3378866', uppercase: true, maxLength: 10 },
  { key: 'mobile', label: 'Mobile No', type: 'tel', placeholder: '9876543210', maxLength: 10, short: true },
  { key: 'state', label: 'State', type: 'select', required: true, options: INDIAN_STATES },
  { key: 'parlNo', label: 'Parl. No', type: 'number', required: true, placeholder: '29', short: true, min: 1 },
  { key: 'parlName', label: 'Parl. Constituency', type: 'text', required: true, placeholder: 'Nalanda' },
  { key: 'assemblyNo', label: 'Asm. No', type: 'number', required: true, placeholder: '172', short: true, min: 1 },
  { key: 'assemblyName', label: 'Asm. Constituency', type: 'text', required: true, placeholder: 'Biharsharif' },
  { key: 'pollingStationName', label: 'Polling Station', type: 'text', required: true, placeholder: 'Madarasa Ajijiya', long: true },
  { key: 'partNumber', label: 'Part No', type: 'number', required: true, placeholder: '381', short: true, min: 1 },
  { key: 'partName', label: 'Part Name', type: 'text', placeholder: 'Madarasa Ajijaya Dakshini Bhag', long: true },
  { key: 'partSerial', label: 'Part Serial', type: 'number', required: true, placeholder: '283', short: true, min: 1 },
  { key: 'pollingDate', label: 'Polling Date', type: 'date' },
];

let nextId = 1;
function makeRow(seed = {}) {
  const r = { id: nextId++ };
  COLUMNS.forEach((c) => {
    r[c.key] = seed[c.key] ?? '';
  });
  return r;
}

export default function RecordForm({ onSubmit }) {
  const [rows, setRows] = useState(() => [makeRow()]);
  const [errors, setErrors] = useState({}); // { 'rowId-key': msg }

  // Excel-style multi-cell paste: write a TSV matrix into the grid,
  // appending rows as needed. Honors uppercase + select option matching.
  const onPasteMatrix = useCallback((startRow, startCol, matrix) => {
    setRows((prev) => {
      const next = [...prev];
      matrix.forEach((line, di) => {
        const r = startRow + di;
        while (r >= next.length) next.push(makeRow());
        const row = { ...next[r] };
        line.forEach((rawVal, dj) => {
          const c = startCol + dj;
          if (c < 0 || c >= COLUMNS.length) return;
          const col = COLUMNS[c];
          let v = String(rawVal ?? '');
          if (col.uppercase) v = v.toUpperCase();
          if (col.type === 'select' && col.options) {
            const trimmed = v.trim();
            const m = col.options.find(
              (o) => o.toLowerCase() === trimmed.toLowerCase(),
            );
            v = m ?? trimmed;
          }
          if (col.maxLength) v = v.slice(0, col.maxLength);
          row[col.key] = v;
        });
        next[r] = row;
      });
      return next;
    });
  }, []);

  const { gridId, gridProps } = useGridNav({
    cols: COLUMNS.length,
    onPasteMatrix,
  });

  function updateCell(id, key, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    const ek = `${id}-${key}`;
    if (errors[ek]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[ek];
        return next;
      });
    }
  }

  function addRow() {
    setRows((r) => [...r, makeRow()]);
  }

  function deleteRow(id) {
    setRows((r) => (r.length === 1 ? [makeRow()] : r.filter((x) => x.id !== id)));
    setErrors((e) => {
      const next = {};
      Object.keys(e).forEach((k) => {
        if (!k.startsWith(`${id}-`)) next[k] = e[k];
      });
      return next;
    });
  }

  function isRowEmpty(r) {
    return COLUMNS.every((c) => !String(r[c.key] || '').trim());
  }

  function validate() {
    const next = {};
    rows.forEach((row) => {
      if (isRowEmpty(row)) return; // skip totally blank rows
      COLUMNS.forEach((c) => {
        const val = String(row[c.key] || '').trim();
        if (c.required && !val) {
          next[`${row.id}-${c.key}`] = 'Required';
        } else if (c.key === 'epic' && val && !EPIC_PATTERN.test(val)) {
          next[`${row.id}-${c.key}`] = 'Bad format';
        } else if (c.key === 'mobile' && val && !/^[6-9]\d{9}$/.test(val)) {
          next[`${row.id}-${c.key}`] = 'Bad mobile';
        } else if (c.key === 'age' && val && Number(val) < 18) {
          next[`${row.id}-${c.key}`] = 'Min 18';
        }
      });
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    const usable = rows.filter((r) => !isRowEmpty(r));
    if (usable.length === 0) {
      onSubmit?.({ ok: false, message: 'Add at least one row before saving' });
      return;
    }
    if (!validate()) {
      onSubmit?.({ ok: false });
      return;
    }
    onSubmit?.({
      ok: true,
      voters: usable.map((r) => {
        const out = {};
        COLUMNS.forEach((c) => {
          const v = r[c.key];
          if (c.key === 'pollingDate') {
            out.pollingDate = v || undefined;
            return;
          }
          out[c.key] = v;
        });
        return out;
      }),
      record: {
        file: `voter_batch_${usable.length}_records`,
        source: `Manual entry · ${usable.length} ${
          usable.length === 1 ? 'voter' : 'voters'
        } · Officer L2`,
        records: usable.length,
        constituency:
          usable[0].assemblyName ? `${usable[0].assemblyNo}-${usable[0].assemblyName}` : '—',
      },
      reset: () => {
        setRows([makeRow()]);
        setErrors({});
      },
    });
  }

  function handleClear() {
    setRows([makeRow()]);
    setErrors({});
  }

  const filledCount = useMemo(() => rows.filter((r) => !isRowEmpty(r)).length, [rows]);
  const errorCount = Object.keys(errors).length;

  function renderCell(row, col, ri, ci) {
    const ek = `${row.id}-${col.key}`;
    const errMsg = errors[ek];
    const hasError = !!errMsg;
    const cellClass = 'value' + (hasError ? ' cell-error' : '');

    if (col.type === 'select') {
      return (
        <td key={col.key} className={cellClass} data-error={errMsg || undefined}>
          <select
            className={`cell-input cell-select ${col.short ? 'short' : col.long ? 'long' : ''}`}
            value={row[col.key]}
            onChange={(e) => updateCell(row.id, col.key, e.target.value)}
            data-row={ri}
            data-col={ci}
            title={hasError ? errors[ek] : undefined}
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
      <td key={col.key} className={cellClass} data-error={errMsg || undefined}>
        <input
          type={col.type}
          className={`cell-input ${col.short ? 'short' : col.long ? 'long' : ''}`}
          value={row[col.key]}
          placeholder={col.placeholder}
          maxLength={col.maxLength}
          min={col.min}
          max={col.max}
          data-row={ri}
          data-col={ci}
          onChange={(e) => {
            let v = e.target.value;
            if (col.uppercase) v = v.toUpperCase();
            updateCell(row.id, col.key, v);
          }}
          onFocus={(e) => {
            if (col.type !== 'date') {
              try {
                e.target.select();
              } catch {
                /* ignore */
              }
            }
          }}
          title={hasError ? errors[ek] : undefined}
        />
      </td>
    );
  }

  return (
    <Card>
      <Card.Head
        title="Voter Details"
        subtitle="Spreadsheet entry: Tab / Enter / arrows to move between cells, paste a TSV block from Excel to fill many rows at once. Add Row appends a blank row."
      />
      <Card.Body>
        <div className="grid-toolbar">
          <div className="row-count">
            <strong>{filledCount}</strong> of <strong>{rows.length}</strong> rows have data
            {errorCount > 0 && (
              <span style={{ color: 'var(--danger)', marginLeft: 12 }}>
                · {errorCount} field{errorCount === 1 ? '' : 's'} need attention
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleClear}>Clear all</Button>
            <Button
              variant="primary"
              leadingIcon={<CheckIcon />}
              onClick={handleSave}
            >
              Save {filledCount > 0 ? `${filledCount} ` : ''}
              {filledCount === 1 ? 'Voter' : 'Voters'}
            </Button>
          </div>
        </div>

        <div className="grid-wrap">
          <table className="voter-grid excel-compact" data-grid-id={gridId} {...gridProps}>
            <thead>
              <tr>
                <th className="row-num">#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={c.required ? 'req-col' : ''}>
                    {c.label}
                  </th>
                ))}
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rowHasError = Object.keys(errors).some((k) => k.startsWith(`${row.id}-`));
                return (
                <tr key={row.id} className={rowHasError ? 'row-has-error' : ''}>
                  <td className="row-num">{i + 1}</td>
                  {COLUMNS.map((col, j) => renderCell(row, col, i, j))}
                  <td className="actions-col">
                    <button
                      type="button"
                      className="row-delete"
                      title="Delete row"
                      onClick={() => deleteRow(row.id)}
                    >
                      <CloseIcon />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button type="button" className="add-row-btn" onClick={addRow}>
          <PlusIcon />
          Add Row
        </button>
      </Card.Body>
    </Card>
  );
}
