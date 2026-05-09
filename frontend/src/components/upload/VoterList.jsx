import { useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { CloseIcon } from '../ui/Icon.jsx';
import { api } from '../../lib/api.js';

const COLS = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'age', label: 'Age', short: true },
  { key: 'gender', label: 'Gender', short: true },
  { key: 'epic', label: 'EPIC' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'state', label: 'State' },
  { key: 'assemblyNo', label: 'Asm No', short: true },
  { key: 'assemblyName', label: 'Assembly' },
  { key: 'pollingStationName', label: 'Polling Stn' },
  { key: 'partNumber', label: 'Part No', short: true },
  { key: 'partSerial', label: 'Part Sl', short: true },
];

export default function VoterList({ refreshKey, onError }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [assemblyNo, setAssemblyNo] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { take: '200' };
      if (search.trim()) params.search = search.trim();
      if (state.trim()) params.state = state.trim();
      if (assemblyNo.trim()) params.assemblyNo = assemblyNo.trim();
      const res = await api.listVoters(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      onError?.(e.message || 'Failed to load voters');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this voter?')) return;
    try {
      await api.deleteVoter(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      onError?.(e.message || 'Delete failed');
    }
  }

  return (
    <Card>
      <Card.Head
        title="Voters"
        subtitle={`Loaded from server. Use filters to narrow down. Total in DB: ${total}.`}
      />
      <Card.Body>
        <div className="grid-toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name / EPIC / mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ padding: 6, minWidth: 220 }}
          />
          <input
            type="text"
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{ padding: 6, width: 140 }}
          />
          <input
            type="text"
            placeholder="Assembly No"
            value={assemblyNo}
            onChange={(e) => setAssemblyNo(e.target.value)}
            style={{ padding: 6, width: 120 }}
          />
          <Button onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
          </Button>
          <Button
            onClick={() => {
              setSearch('');
              setState('');
              setAssemblyNo('');
              setTimeout(load, 0);
            }}
          >
            Clear
          </Button>
        </div>

        <div className="grid-wrap">
          <table className="voter-grid excel-compact">
            <thead>
              <tr>
                <th className="row-num">#</th>
                {COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {items.map((v, i) => (
                <tr key={v.id}>
                  <td className="row-num">{i + 1}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="value">
                      <span style={{ padding: '0 8px' }}>{v[c.key] ?? ''}</span>
                    </td>
                  ))}
                  <td className="actions-col">
                    <button
                      type="button"
                      className="row-delete"
                      title="Delete voter"
                      onClick={() => handleDelete(v.id)}
                    >
                      <CloseIcon />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={COLS.length + 2} style={{ padding: 16, color: 'var(--text-2)' }}>
                    No voters found.
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
