import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FilterIcon, CloseIcon } from './Icon.jsx';

/**
 * Excel-style column filter popover.
 *
 * Click the funnel icon on a column header → popover with:
 *   - Sort A→Z / Z→A
 *   - Search box that narrows the value list
 *   - Multi-select checkboxes for distinct values (Select all / clear)
 *   - Apply / Clear actions
 *
 * Props:
 *   columnKey: string                    unique column id
 *   label:     string                    column label (heading)
 *   values:    Array<string|number|null> all current cell values for this column (uniques computed inside)
 *   active:    { values?: Set<string>, sort?: 'asc'|'desc' } | undefined  current filter
 *   onChange:  (next) => void            new state (or undefined to clear)
 */
export default function ColumnFilter({ columnKey, label, values = [], active, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftSelected, setDraftSelected] = useState(null); // null = all
  const [draftSort, setDraftSort] = useState(null);
  const [popPos, setPopPos] = useState(null); // { top, left } in viewport coords
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Compute popover position from button's bounding rect.
  function placePopover() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const popW = 280;
    const popH = 380;
    const margin = 8;
    let left = r.left;
    if (left + popW > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - popW - margin);
    }
    let top = r.bottom + 6;
    if (top + popH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - popH - 6);
    }
    setPopPos({ top, left });
  }

  const distinct = useMemo(() => {
    const seen = new Map();
    for (const v of values) {
      const key = v == null || v === '' ? '∅ blank' : String(v);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return Array.from(seen.entries())
      .map(([k, count]) => ({ key: k, count, raw: k === '∅ blank' ? '' : k }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [values]);

  // When opening, hydrate draft from active filter + place popover
  useEffect(() => {
    if (!open) return;
    setDraftSelected(active?.values ?? null);
    setDraftSort(active?.sort ?? null);
    setSearch('');
    placePopover();
  }, [open, active]);

  // Close on outside click / Escape; reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onScroll() {
      placePopover();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const filteredDistinct = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return distinct;
    return distinct.filter((d) => d.key.toLowerCase().includes(q));
  }, [search, distinct]);

  const allKeys = useMemo(() => distinct.map((d) => d.key), [distinct]);
  const selectedKeys =
    draftSelected ?? new Set(allKeys); // null draft = all checked

  function toggle(key) {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraftSelected(next);
  }
  function selectAll() {
    setDraftSelected(null);
  }
  function clearAll() {
    setDraftSelected(new Set());
  }
  function setSort(dir) {
    setDraftSort(draftSort === dir ? null : dir);
  }
  function apply() {
    const isAll = draftSelected == null || draftSelected.size === allKeys.length;
    const noFilter = isAll && !draftSort;
    onChange(noFilter ? undefined : { values: isAll ? null : draftSelected, sort: draftSort });
    setOpen(false);
  }
  function clearFilter() {
    onChange(undefined);
    setOpen(false);
  }

  const filterCount =
    active?.values && active.values.size !== allKeys.length ? active.values.size : null;

  return (
    <span className="col-filter-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`col-filter-btn ${active ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={`Filter ${label}`}
        aria-expanded={open}
        aria-label={`Filter ${label}`}
      >
        <FilterIcon style={{ width: 12, height: 12 }} />
        {active?.sort && (
          <span className="col-filter-sort">{active.sort === 'asc' ? '▲' : '▼'}</span>
        )}
        {filterCount != null && <span className="col-filter-count">{filterCount}</span>}
      </button>
      {open && popPos && createPortal(
        <div
          className="col-filter-pop"
          role="dialog"
          ref={popRef}
          style={{ position: 'fixed', top: popPos.top, left: popPos.left }}
        >
          <div className="col-filter-head">
            <strong>{label}</strong>
            <button type="button" className="row-delete" onClick={() => setOpen(false)} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="col-filter-sort-row">
            <button
              type="button"
              className={`btn btn-sm ${draftSort === 'asc' ? 'btn-primary' : ''}`}
              onClick={() => setSort('asc')}
            >
              Sort A → Z
            </button>
            <button
              type="button"
              className={`btn btn-sm ${draftSort === 'desc' ? 'btn-primary' : ''}`}
              onClick={() => setSort('desc')}
            >
              Sort Z → A
            </button>
          </div>
          <input
            type="text"
            className="field field-sm"
            placeholder="Search values…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
          <div className="col-filter-tools">
            <button type="button" className="link-btn" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="link-btn" onClick={clearAll}>
              Clear
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
              {distinct.length} unique
            </span>
          </div>
          <div className="col-filter-list">
            {filteredDistinct.length === 0 && (
              <div className="grid-empty" style={{ padding: 12 }}>No matches.</div>
            )}
            {filteredDistinct.map((d) => (
              <label key={d.key} className="col-filter-item">
                <input
                  type="checkbox"
                  checked={selectedKeys.has(d.key)}
                  onChange={() => toggle(d.key)}
                />
                <span className="col-filter-label">{d.key}</span>
                <span className="col-filter-cnt">{d.count}</span>
              </label>
            ))}
          </div>
          <div className="col-filter-actions">
            {active && (
              <button type="button" className="btn btn-sm" onClick={clearFilter}>
                Clear filter
              </button>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={apply}>
              Apply
            </button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
