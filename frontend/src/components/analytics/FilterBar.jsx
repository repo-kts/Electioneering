import { FilterIcon } from '../ui/Icon.jsx';

export default function FilterBar({ filters, onChange, lastRefresh }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar-label">
        <FilterIcon />
        Filters
      </div>
      <div className="filter-select">
        <label>Date</label>
        <select
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value })}
        >
          <option>Today · 02 May 2026</option>
          <option>Last 24 hours</option>
          <option>Round 3 only</option>
          <option>All rounds</option>
        </select>
      </div>
      <div className="filter-select">
        <label>Region</label>
        <select
          value={filters.region}
          onChange={(e) => onChange({ ...filters, region: e.target.value })}
        >
          <option>All regions</option>
          <option>Maharashtra 24N</option>
          <option>Karnataka 18S</option>
          <option>Delhi NCR</option>
          <option>Tamil Nadu 12W</option>
        </select>
      </div>
      <div className="filter-select">
        <label>Source</label>
        <select
          value={filters.source}
          onChange={(e) => onChange({ ...filters, source: e.target.value })}
        >
          <option>Excel + manual entries</option>
          <option>Excel uploads only</option>
          <option>Manual entries only</option>
        </select>
      </div>
      <div className="filter-bar-spacer" />
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Last refresh{' '}
        <strong style={{ color: 'var(--text)', fontWeight: 600 }} className="tnum">
          {lastRefresh}
        </strong>
      </div>
    </div>
  );
}
