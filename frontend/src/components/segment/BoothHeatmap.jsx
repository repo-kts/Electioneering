import { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { api } from '../../lib/api.js';

// Stable color from a candidate name
function colorFor(name) {
  if (!name) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 65% 50%)`;
}

export default function BoothHeatmap({ elections = [] }) {
  const [electionId, setElectionId] = useState(elections[0]?.id ?? null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!electionId) return;
    setBusy(true);
    setError(null);
    api
      .boothLeaning(electionId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [electionId]);

  async function recompute() {
    if (!electionId) return;
    setBusy(true);
    try {
      await api.recomputeLeaning(electionId);
      const fresh = await api.boothLeaning(electionId);
      setData(fresh);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const allCandidates = useMemo(() => {
    if (!data?.items) return [];
    const set = new Set();
    for (const ps of data.items) Object.keys(ps.byCandidate ?? {}).forEach((c) => set.add(c));
    return Array.from(set);
  }, [data]);

  return (
    <Card>
      <Card.Head
        title="Booth heatmap"
        subtitle="Each polling station coloured by its dominant predicted candidate (Form 20 share). Recompute after editing Form 20."
      />
      <Card.Body>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Election:</label>
          <select
            value={electionId ?? ''}
            onChange={(e) => setElectionId(e.target.value ? Number(e.target.value) : null)}
            style={{ padding: 6 }}
          >
            <option value="">— pick —</option>
            {elections.map((e) => (
              <option key={e.id} value={e.id}>
                {e.assemblyNo}-{e.assemblyName} {e.electionYear ?? ''}
              </option>
            ))}
          </select>
          <Button onClick={recompute} disabled={!electionId || busy}>
            {busy ? 'Working…' : 'Recompute'}
          </Button>
          {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
        </div>

        {data?.items?.length > 0 && (
          <>
            <div className="booth-grid">
              {data.items.map((ps) => {
                const color = colorFor(ps.leader);
                return (
                  <div
                    key={ps.id}
                    className="booth-cell"
                    style={{ borderTop: `4px solid ${color}` }}
                    title={`${ps.serial} — ${ps.name ?? '—'}\nLeader: ${ps.leader ?? '—'} (${(
                      (ps.leaderShare ?? 0) * 100
                    ).toFixed(1)}%)\nValid: ${ps.totalValid}\nVoters: ${ps.registeredVoters}`}
                  >
                    <div className="booth-num">PS-{ps.serial}</div>
                    <div className="booth-name">{ps.name ?? '—'}</div>
                    <div className="booth-leader" style={{ color }}>
                      {ps.leader ?? '—'}
                    </div>
                    <div className="booth-share">
                      {((ps.leaderShare ?? 0) * 100).toFixed(0)}% · {ps.totalValid} valid
                    </div>
                    <div className="booth-voters">{ps.registeredVoters} voters mapped</div>
                  </div>
                );
              })}
            </div>

            <div className="booth-legend">
              {allCandidates.map((c) => (
                <span key={c} className="booth-legend-item">
                  <span className="dot" style={{ background: colorFor(c) }} />
                  {c}
                </span>
              ))}
            </div>
          </>
        )}

        {data && data.items?.length === 0 && (
          <div className="grid-empty">No polling stations for this election.</div>
        )}
      </Card.Body>
    </Card>
  );
}
