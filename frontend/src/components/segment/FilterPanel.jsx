import { useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';

/**
 * FilterPanel — controlled segmentation filter UI.
 * Props:
 *   value: criteria object
 *   elections: [{ id, assemblyName, electionYear }]
 *   onChange: (criteria) => void
 *   onApply: () => void
 *   onSaveCohort: () => void
 *   onExport: () => void
 *   onReset: () => void
 */
export default function FilterPanel({
  value,
  elections = [],
  onChange,
  onApply,
  onSaveCohort,
  onExport,
  onReset,
}) {
  const [v, setV] = useState(value);

  function set(k, val) {
    const next = { ...v, [k]: val };
    setV(next);
    onChange?.(next);
  }
  function setNum(k, val) {
    set(k, val === '' ? undefined : Number(val));
  }
  function toggleArr(k, val) {
    const arr = Array.isArray(v[k]) ? [...v[k]] : v[k] ? [v[k]] : [];
    const i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(val);
    set(k, arr.length ? arr : undefined);
  }
  function toggleElec(k, id) {
    const arr = Array.isArray(v[k]) ? [...v[k]] : [];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    set(k, arr.length ? arr : undefined);
  }
  const isElecOn = (k, id) => Array.isArray(v[k]) && v[k].includes(id);

  return (
    <Card>
      <Card.Head
        title="Filter"
        subtitle="Combine geography, demographics, turnout history and predicted leaning."
      />
      <Card.Body>
        <div className="seg-filter">
          <FilterRow label="Free text">
            <input
              type="text"
              placeholder="name / EPIC / mobile"
              value={v.search ?? ''}
              onChange={(e) => set('search', e.target.value || undefined)}
            />
          </FilterRow>

          <FilterRow label="State">
            <input
              type="text"
              placeholder="Bihar"
              value={v.state ?? ''}
              onChange={(e) => set('state', e.target.value || undefined)}
            />
          </FilterRow>
          <FilterRow label="Assembly">
            <input
              type="text"
              placeholder="172"
              style={{ width: 70 }}
              value={v.assemblyNo ?? ''}
              onChange={(e) => set('assemblyNo', e.target.value || undefined)}
            />
            <input
              type="text"
              placeholder="Biharsharif"
              value={v.assemblyName ?? ''}
              onChange={(e) => set('assemblyName', e.target.value || undefined)}
            />
          </FilterRow>
          <FilterRow label="Polling station">
            <input
              type="text"
              placeholder="PS-1"
              value={v.pollingStationName ?? ''}
              onChange={(e) => set('pollingStationName', e.target.value || undefined)}
            />
          </FilterRow>
          <FilterRow label="Part #">
            <input
              type="text"
              placeholder="381"
              value={v.partNumber ?? ''}
              onChange={(e) => set('partNumber', e.target.value || undefined)}
            />
          </FilterRow>

          <hr />

          <FilterRow label="Gender">
            <select
              value={v.gender ?? ''}
              onChange={(e) => set('gender', e.target.value || undefined)}
            >
              <option value="">any</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </FilterRow>
          <FilterRow label="Age">
            <input
              type="number"
              placeholder="18"
              style={{ width: 70 }}
              value={v.ageMin ?? ''}
              onChange={(e) => setNum('ageMin', e.target.value)}
            />
            <span style={{ padding: '0 6px' }}>to</span>
            <input
              type="number"
              placeholder="60"
              style={{ width: 70 }}
              value={v.ageMax ?? ''}
              onChange={(e) => setNum('ageMax', e.target.value)}
            />
          </FilterRow>
          <FilterRow label="Community">
            <input
              type="text"
              placeholder="comma separated"
              value={Array.isArray(v.community) ? v.community.join(', ') : v.community ?? ''}
              onChange={(e) => {
                const arr = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                set('community', arr.length === 0 ? undefined : arr.length === 1 ? arr[0] : arr);
              }}
            />
          </FilterRow>
          <FilterRow label="Occupation">
            <input
              type="text"
              placeholder="Farmer, Teacher"
              value={Array.isArray(v.occupation) ? v.occupation.join(', ') : v.occupation ?? ''}
              onChange={(e) => {
                const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                set('occupation', arr.length === 0 ? undefined : arr.length === 1 ? arr[0] : arr);
              }}
            />
          </FilterRow>
          <FilterRow label="Language">
            <input
              type="text"
              placeholder="Hindi, Urdu"
              value={Array.isArray(v.language) ? v.language.join(', ') : v.language ?? ''}
              onChange={(e) => {
                const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                set('language', arr.length === 0 ? undefined : arr.length === 1 ? arr[0] : arr);
              }}
            />
          </FilterRow>

          <hr />

          {elections.length > 0 && (
            <>
              <FilterRow label="Voted in">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {elections.map((e) => (
                    <label key={e.id} className="seg-chip">
                      <input
                        type="checkbox"
                        checked={isElecOn('votedIn', e.id)}
                        onChange={() => toggleElec('votedIn', e.id)}
                      />
                      {e.assemblyName} {e.electionYear ?? ''}
                    </label>
                  ))}
                </div>
              </FilterRow>
              <FilterRow label="Did NOT vote in">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {elections.map((e) => (
                    <label key={e.id} className="seg-chip">
                      <input
                        type="checkbox"
                        checked={isElecOn('notVotedIn', e.id)}
                        onChange={() => toggleElec('notVotedIn', e.id)}
                      />
                      {e.assemblyName} {e.electionYear ?? ''}
                    </label>
                  ))}
                </div>
              </FilterRow>
            </>
          )}

          <FilterRow label="Predicted lean to">
            <input
              type="text"
              placeholder="Candidate name"
              value={v.leaningTo ?? ''}
              onChange={(e) => set('leaningTo', e.target.value || undefined)}
            />
          </FilterRow>
          <FilterRow label="Min share">
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              placeholder="0.50"
              style={{ width: 90 }}
              value={v.leaningMin ?? ''}
              onChange={(e) => setNum('leaningMin', e.target.value)}
            />
          </FilterRow>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={onApply}>Apply</Button>
          <Button onClick={onReset}>Reset</Button>
          <Button onClick={onSaveCohort}>Save as cohort</Button>
          <Button onClick={onExport}>Export CSV</Button>
        </div>
      </Card.Body>
    </Card>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="seg-filter-row">
      <div className="seg-filter-label">{label}</div>
      <div className="seg-filter-input">{children}</div>
    </div>
  );
}
