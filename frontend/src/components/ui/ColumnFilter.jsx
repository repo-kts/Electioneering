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

  const miniBtn = 'rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-[#f7f5f0]';
  const miniBtnOn = 'rounded-md border border-slate-950 bg-slate-950 px-2 py-1 text-xs font-medium text-white';

  return (
    <span className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`inline-flex items-center gap-0.5 rounded p-1 ${active ? 'text-accent-700' : 'text-slate-400 hover:text-slate-600'}`}
        onClick={() => setOpen((v) => !v)}
        title={`Filter ${label}`}
        aria-expanded={open}
        aria-label={`Filter ${label}`}
      >
        <FilterIcon style={{ width: 12, height: 12 }} />
        {active?.sort && <span className="text-[9px]">{active.sort === 'asc' ? '▲' : '▼'}</span>}
        {filterCount != null && (
          <span className="bg-accent-700 px-1 text-[9px] text-white">{filterCount}</span>
        )}
      </button>
      {open && popPos && createPortal(
        <div
          className="z-50 w-[280px] border border-slate-300 bg-white p-3 shadow-pop"
          role="dialog"
          ref={popRef}
          style={{ position: 'fixed', top: popPos.top, left: popPos.left }}
        >
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-sm text-slate-800">{label}</strong>
            <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setOpen(false)} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="mb-2 flex gap-2">
            <button type="button" className={draftSort === 'asc' ? miniBtnOn : miniBtn} onClick={() => setSort('asc')}>Sort A → Z</button>
            <button type="button" className={draftSort === 'desc' ? miniBtnOn : miniBtn} onClick={() => setSort('desc')}>Sort Z → A</button>
          </div>
          <input
            type="text"
            placeholder="Search values…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="font-medium text-accent-700 hover:underline" onClick={selectAll}>Select all</button>
            <button type="button" className="font-medium text-accent-700 hover:underline" onClick={clearAll}>Clear</button>
            <span className="ml-auto text-slate-400">{distinct.length} unique</span>
          </div>
          <div className="mt-2 max-h-52 overflow-auto border border-slate-200">
            {filteredDistinct.length === 0 && <div className="p-3 text-center text-sm text-slate-400">No matches.</div>}
            {filteredDistinct.map((d) => (
              <label key={d.key} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-[#fbfaf7]">
                <input type="checkbox" checked={selectedKeys.has(d.key)} onChange={() => toggle(d.key)} />
                <span className="flex-1 truncate text-slate-700">{d.key}</span>
                <span className="text-xs text-slate-400">{d.count}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {active && <button type="button" className={miniBtn} onClick={clearFilter}>Clear filter</button>}
            <button type="button" className="rounded-md bg-slate-950 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800" onClick={apply}>Apply</button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
