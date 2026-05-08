import { useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CheckIcon, CloseIcon } from '../ui/Icon.jsx';

/**
 * UploadPreview — renders parsed rows from a file upload, highlights
 * cells that fail validation (mobile / EPIC / numbers / etc.), and lets
 * the user review before committing.
 *
 * Props:
 *   kind: 'voter' | 'form20'
 *   data: {
 *     fileName, headers?, rows[], candidates?,
 *     errorCount?, validCount?, totalRows?
 *   }
 *   onCancel: () => void
 *   onCommit: (rows) => Promise<void>
 *   headerExtras?: ReactNode  (used by form20 election header form)
 */
export default function UploadPreview({ kind, data, onCancel, onCommit, headerExtras }) {
  const [rows, setRows] = useState(() => data.rows.map((r, i) => ({ __id: i, ...r })));
  const [busy, setBusy] = useState(false);

  const headers = useMemo(() => {
    if (kind === 'form20') {
      return [
        'serial',
        'name',
        ...data.candidates,
        'rejectedVotes',
        'notaVotes',
        'total',
        'tenderedVotes',
      ];
    }
    if (data.headers && data.headers.length) return data.headers;
    return rows.length
      ? Object.keys(rows[0]).filter((k) => k !== '__id' && k !== '__errors')
      : [];
  }, [data, kind, rows]);

  const errorRowCount = useMemo(
    () => rows.filter((r) => r.__errors && Object.keys(r.__errors).length > 0).length,
    [rows],
  );
  const validRowCount = rows.length - errorRowCount;

  function removeRow(id) {
    setRows((r) => r.filter((x) => x.__id !== id));
  }
  function removeInvalid() {
    setRows((r) => r.filter((x) => !x.__errors || Object.keys(x.__errors).length === 0));
  }

  function cellValue(row, h) {
    if (kind === 'form20' && data.candidates?.includes(h)) {
      return row.votes?.[h] ?? '';
    }
    return row[h];
  }

  function cellError(row, h) {
    return row.__errors?.[h];
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

  return (
    <Card>
      <Card.Head
        title={`Preview · ${data.fileName}`}
        subtitle={`${rows.length} row${rows.length === 1 ? '' : 's'} parsed${
          kind === 'form20' ? ` · ${data.candidates?.length ?? 0} candidates detected` : ''
        }. Cells in red fail format checks (EPIC AAA9999999, mobile 6-9 + 9 digits, integer, age 18..120).`}
      />
      <Card.Body>
        {headerExtras}

        <div className="grid-toolbar">
          <div className="row-count">
            <span style={{ color: 'var(--success, #16a34a)' }}>
              <strong>{validRowCount}</strong> valid
            </span>
            {errorRowCount > 0 && (
              <span style={{ color: 'var(--danger)', marginLeft: 12 }}>
                · <strong>{errorRowCount}</strong> with errors
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onCancel} disabled={busy}>Cancel</Button>
            {errorRowCount > 0 && (
              <Button onClick={removeInvalid} disabled={busy}>
                Remove invalid ({errorRowCount})
              </Button>
            )}
            <Button
              variant="primary"
              leadingIcon={<CheckIcon />}
              onClick={commit}
              disabled={busy || rows.length === 0}
              title={
                errorRowCount > 0
                  ? 'Rows with errors will be skipped on the server'
                  : undefined
              }
            >
              {busy ? 'Saving…' : `Save ${rows.length} record${rows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>

        <div className="grid-wrap">
          <table className="voter-grid">
            <thead>
              <tr>
                <th className="row-num">#</th>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const hasErr = row.__errors && Object.keys(row.__errors).length > 0;
                return (
                  <tr
                    key={row.__id}
                    style={hasErr ? { background: 'rgba(239, 68, 68, 0.08)' } : undefined}
                  >
                    <td className="row-num">{i + 1}</td>
                    {headers.map((h) => {
                      const v = cellValue(row, h);
                      const err = cellError(row, h);
                      return (
                        <td
                          key={h}
                          className={`value${err ? ' error' : ''}`}
                          title={err || undefined}
                          style={
                            err
                              ? {
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  color: 'var(--danger)',
                                }
                              : undefined
                          }
                        >
                          <span style={{ padding: '0 8px' }}>
                            {v == null ? '' : String(v)}
                          </span>
                        </td>
                      );
                    })}
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
            </tbody>
          </table>
        </div>

        {errorRowCount > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
            Hover any red cell for the exact reason. The server validates again
            on commit and skips rows that still have errors.
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
