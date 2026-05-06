import { useMemo, useState } from 'react';
import { CheckIcon, CloseIcon, PlusIcon } from '../ui/Icon.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import {
  DUMMY_VOTERS,
  EPIC_PATTERN,
  GENDER_OPTIONS,
  INDIAN_STATES,
} from '../../data/voterForm.js';

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
  { key: 'state', label: 'State', type: 'select', required: true, options: INDIAN_STATES },
  { key: 'parlNo', label: 'Parl. No', type: 'number', required: true, placeholder: '29', short: true, min: 1 },
  { key: 'parlName', label: 'Parl. Constituency', type: 'text', required: true, placeholder: 'Nalanda' },
  { key: 'assemblyNo', label: 'Asm. No', type: 'number', required: true, placeholder: '172', short: true, min: 1 },
  { key: 'assemblyName', label: 'Asm. Constituency', type: 'text', required: true, placeholder: 'Biharsharif' },
  { key: 'pollingStation', label: 'Polling Station', type: 'text', required: true, placeholder: 'Madarasa Ajijiya', long: true },
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

function seedRows() {
  return DUMMY_VOTERS.map((v) => makeRow(v));
}

export default function RecordForm({ onSubmit }) {
  const [rows, setRows] = useState(() => seedRows());
  const [errors, setErrors] = useState({}); // { 'rowId-key': msg }

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
      record: {
        file: `voter_batch_${usable.length}_records`,
        source: `Manual entry · ${usable.length} ${
          usable.length === 1 ? 'voter' : 'voters'
        } · Officer L2`,
        records: usable.length,
        constituency:
          usable[0].assemblyName ? `${usable[0].assemblyNo}-${usable[0].assemblyName}` : '—',
      },
    });
    setRows([makeRow()]);
    setErrors({});
  }

  function handleClear() {
    setRows([makeRow()]);
    setErrors({});
  }

  const filledCount = useMemo(() => rows.filter((r) => !isRowEmpty(r)).length, [rows]);
  const errorCount = Object.keys(errors).length;

  function renderCell(row, col) {
    const ek = `${row.id}-${col.key}`;
    const hasError = !!errors[ek];
    const cellClass = 'value' + (hasError ? ' error' : '');

    if (col.type === 'select') {
      return (
        <td key={col.key} className={cellClass}>
          <select
            className={`cell-input cell-select ${col.short ? 'short' : col.long ? 'long' : ''}`}
            value={row[col.key]}
            onChange={(e) => updateCell(row.id, col.key, e.target.value)}
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
      <td key={col.key} className={cellClass}>
        <input
          type={col.type}
          className={`cell-input ${col.short ? 'short' : col.long ? 'long' : ''}`}
          value={row[col.key]}
          placeholder={col.placeholder}
          maxLength={col.maxLength}
          min={col.min}
          max={col.max}
          onChange={(e) => {
            let v = e.target.value;
            if (col.uppercase) v = v.toUpperCase();
            updateCell(row.id, col.key, v);
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
        subtitle='Add voter records like a spreadsheet. Click any cell to edit, "+ Add Row" to insert a new entry.'
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
          <table className="voter-grid">
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
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="row-num">{i + 1}</td>
                  {COLUMNS.map((col) => renderCell(row, col))}
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
              ))}
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
