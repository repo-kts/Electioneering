import { useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CheckIcon, CloseIcon } from '../ui/Icon.jsx';

/**
 * UploadPreview — renders parsed rows from a file upload, lets the user
 * review (and remove rows), then commits the cleaned set to the backend.
 *
 * Props:
 *   kind: 'voter' | 'form20'
 *   data: { fileName, headers?, rows, candidates? }
 *   onCancel: () => void
 *   onCommit: (rows | { candidates, rows, header }) => Promise<void>
 *   header?: ReactNode  (extra UI for form20 election header, only used by voter when kind=form20)
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
        'tenderedVotes',
        'total',
      ];
    }
    if (data.headers && data.headers.length) return data.headers;
    return rows.length ? Object.keys(rows[0]).filter((k) => k !== '__id') : [];
  }, [data, kind, rows]);

  function removeRow(id) {
    setRows((r) => r.filter((x) => x.__id !== id));
  }

  async function commit() {
    setBusy(true);
    try {
      const cleaned = rows.map(({ __id, ...rest }) => rest);
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
          kind === 'form20' ? ` · ${data.candidates.length} candidates detected` : ''
        }. Review then save.`}
      />
      <Card.Body>
        {headerExtras}

        <div className="grid-toolbar">
          <div className="row-count">
            <strong>{rows.length}</strong> rows ready to import
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
              {rows.map((row, i) => (
                <tr key={row.__id}>
                  <td className="row-num">{i + 1}</td>
                  {headers.map((h) => {
                    let v = row[h];
                    if (kind === 'form20' && data.candidates.includes(h)) {
                      v = row.votes?.[h] ?? '';
                    }
                    return (
                      <td key={h} className="value">
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
              ))}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
