import { useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { api, downloadUrls } from '../../lib/api.js';

export default function CohortsList({ refreshKey, onLoad, onError }) {
  const [items, setItems] = useState([]);

  async function load() {
    try {
      const r = await api.listCohorts();
      setItems(r.items);
    } catch (e) {
      onError?.(e.message || 'Failed to load cohorts');
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this cohort?')) return;
    try {
      await api.deleteCohort(id);
      load();
    } catch (e) {
      onError?.(e.message || 'Delete failed');
    }
  }

  return (
    <Card>
      <Card.Head
        title="Saved cohorts"
        subtitle="Click Load to apply a saved filter, Export to download CSV."
      />
      <Card.Body>
        {items.length === 0 && (
          <div className="grid-empty">No cohorts yet. Save the current filter to add one.</div>
        )}
        <div className="cohorts-list">
          {items.map((c) => (
            <div key={c.id} className="cohort-item">
              <div className="cohort-name">{c.name}</div>
              {c.description && <div className="cohort-desc">{c.description}</div>}
              <div className="cohort-criteria">
                <code>{JSON.stringify(c.criteria)}</code>
              </div>
              <div className="cohort-actions">
                <Button onClick={() => onLoad?.(c)}>Load</Button>
                <a className="btn" href={downloadUrls.cohortExport(c.id)}>
                  Export CSV
                </a>
                <button
                  type="button"
                  className="row-delete"
                  title="Delete"
                  onClick={() => handleDelete(c.id)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
