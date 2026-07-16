// Excel-like data table: a global search plus a per-column filter dropdown
// (checkbox list of distinct values + in-dropdown search + A→Z / Z→A sort +
// reset). The filter popup itself is draggable by its top handle.
//
// columns: [{ key, label, render?(row), filterValue?(row), className? }]
// rows:    array of objects
// getRowKey(row) -> stable key ; rowClassName(row) -> optional row classes
import { useEffect, useMemo, useRef, useState } from 'react';

const valueOf = (col, row) => {
  const v = col.filterValue ? col.filterValue(row) : row[col.key];
  return v == null || v === '' ? '—' : String(v);
};

function FunnelIcon({ active }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${active ? 'text-accent-600' : 'text-slate-400'}`} fill="currentColor" aria-hidden>
      <path d="M1.5 2h13a.5.5 0 0 1 .4.8L10 9v4.5a.5.5 0 0 1-.72.45l-2.5-1.25A.5.5 0 0 1 6.5 12.7V9L1.1 2.8A.5.5 0 0 1 1.5 2Z" />
    </svg>
  );
}

function ColumnFilter({ col, rows, selected, onApply, sort, onSort, onClose, anchor }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const distinct = useMemo(() => {
    const set = new Set();
    for (const r of rows) set.add(valueOf(col, r));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [col, rows]);
  // Local draft selection — a Set of checked values (defaults to all checked).
  const [draft, setDraft] = useState(() => new Set(selected ?? distinct));

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', onDoc);
    // Close if the page/table scrolls, so the fixed popover never detaches.
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  // Fixed overlay positioned to the funnel button — escapes the table's scroll clip.
  const WIDTH = 240;
  const baseLeft = anchor ? Math.max(8, Math.min(anchor.right - WIDTH, window.innerWidth - WIDTH - 8)) : 8;
  const baseTop = anchor ? anchor.bottom + 4 : 8;

  // The popup itself is draggable via its top handle.
  const [pos, setPos] = useState(null); // {x,y} once moved; else base position
  const drag = useRef(null);
  const left = pos ? pos.x : baseLeft;
  const top = pos ? pos.y : baseTop;
  const onDragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setPos({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
  };
  const onDragUp = () => {
    drag.current = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragUp);
    document.body.style.userSelect = '';
  };
  const startDrag = (e) => {
    e.preventDefault();
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: left, baseY: top };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
    document.body.style.userSelect = 'none';
  };

  const shown = distinct.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
  const allChecked = shown.every((v) => draft.has(v));
  const toggle = (v) => {
    const next = new Set(draft);
    next.has(v) ? next.delete(v) : next.add(v);
    setDraft(next);
  };
  const setAllShown = (on) => {
    const next = new Set(draft);
    shown.forEach((v) => (on ? next.add(v) : next.delete(v)));
    setDraft(next);
  };
  const apply = () => {
    // A filter covering every distinct value === no filter.
    onApply(draft.size >= distinct.length ? undefined : new Set(draft));
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, width: WIDTH }}
      className="z-50 border border-slate-300 bg-white text-left normal-case tracking-normal shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle — grab here to move the filter around the page */}
      <div
        onMouseDown={startDrag}
        className="flex cursor-move items-center justify-center gap-1.5 border-b border-slate-200 bg-[#fbfaf7] py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 select-none"
        title="Drag to move this filter"
      >
        <svg width="18" height="8" viewBox="0 0 18 8" fill="currentColor" aria-hidden>
          <circle cx="3" cy="2" r="1.1" /><circle cx="9" cy="2" r="1.1" /><circle cx="15" cy="2" r="1.1" />
          <circle cx="3" cy="6" r="1.1" /><circle cx="9" cy="6" r="1.1" /><circle cx="15" cy="6" r="1.1" />
        </svg>
        Drag
      </div>
      <div className="p-2">
      <div className="flex gap-1 border-b border-slate-200 pb-2">
        <button type="button" onClick={() => onSort('asc')} className={`flex-1 border px-2 py-1 text-[11px] font-medium ${sort?.dir === 'asc' ? 'border-accent-300 bg-accent-50 text-accent-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>A → Z</button>
        <button type="button" onClick={() => onSort('desc')} className={`flex-1 border px-2 py-1 text-[11px] font-medium ${sort?.dir === 'desc' ? 'border-accent-300 bg-accent-50 text-accent-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Z → A</button>
        <button type="button" onClick={() => onSort(null)} className="flex-1 border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50" title="Reset ordering">Reset</button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search values…"
        className="mt-2 w-full border border-slate-300 px-2 py-1 text-xs focus:border-accent-500 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-accent-600">
        <button type="button" onClick={() => setAllShown(true)} className="hover:underline">Select all</button>
        <button type="button" onClick={() => setAllShown(false)} className="hover:underline">Clear</button>
      </div>
      <ul className="mt-1 max-h-48 overflow-auto">
        {shown.map((v) => (
          <li key={v}>
            <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs text-slate-700 hover:bg-slate-50">
              <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} />
              <span className="truncate" title={v}>{v}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-1 py-2 text-center text-xs text-slate-400">No values</li>}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <input type="checkbox" checked={allChecked} onChange={(e) => setAllShown(e.target.checked)} /> Toggle shown
        </label>
        <button type="button" onClick={apply} className="border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-700">Apply</button>
      </div>
      </div>
    </div>
  );
}

export default function FilterableTable({
  columns,
  rows,
  getRowKey = (r) => r.id,
  rowClassName,
  maxHeight = 460,
  searchPlaceholder = 'Search…',
}) {
  const [filters, setFilters] = useState({}); // key -> Set | undefined
  const [sort, setSort] = useState(null); // { key, dir }
  const [search, setSearch] = useState('');
  const [openCol, setOpenCol] = useState(null);
  const [anchor, setAnchor] = useState(null); // DOMRect of the open funnel button

  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (q && !columns.some((c) => valueOf(c, r).toLowerCase().includes(q))) return false;
      for (const c of columns) {
        const sel = filters[c.key];
        if (sel && !sel.has(valueOf(c, r))) return false;
      }
      return true;
    });
    if (sort) {
      const col = colByKey[sort.key];
      if (col) {
        out = [...out].sort((a, b) => {
          const cmp = valueOf(col, a).localeCompare(valueOf(col, b), undefined, { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, columns, filters, sort, search, colByKey]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-64 max-w-full border border-slate-300 px-3 py-1.5 text-sm focus:border-accent-500 focus:outline-none"
        />
        <span className="text-xs text-slate-500">{processed.length} of {rows.length}</span>
        <button
          type="button"
          onClick={() => { setFilters({}); setSort(null); setSearch(''); }}
          disabled={activeFilters === 0 && !sort && !search}
          className="border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Reset all
        </button>
      </div>

      <div className="overflow-auto border border-slate-200" style={{ maxHeight }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((col) => {
                const active = !!filters[col.key];
                return (
                  <th
                    key={col.key}
                    className="relative select-none whitespace-nowrap border-b border-slate-200 px-2 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openCol === col.key) { setOpenCol(null); return; }
                          setAnchor(e.currentTarget.getBoundingClientRect());
                          setOpenCol(col.key);
                        }}
                        className={`ml-auto rounded p-0.5 hover:bg-slate-200 ${active ? 'bg-accent-50' : ''}`}
                        title="Filter / sort"
                      >
                        <FunnelIcon active={active || sort?.key === col.key} />
                      </button>
                    </div>
                    {openCol === col.key && (
                      <ColumnFilter
                        col={col}
                        rows={rows}
                        anchor={anchor}
                        selected={filters[col.key]}
                        sort={sort?.key === col.key ? sort : null}
                        onSort={(dir) => setSort((s) => (dir == null ? null : (s && s.key === col.key && s.dir === dir ? null : { key: col.key, dir })))}
                        onApply={(sel) => setFilters((f) => ({ ...f, [col.key]: sel }))}
                        onClose={() => setOpenCol(null)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processed.map((r) => (
              <tr key={getRowKey(r)} className={`border-t border-slate-200 ${rowClassName?.(r) ?? ''}`}>
                {columns.map((col) => (
                  <td key={col.key} className={`px-2 py-1.5 ${col.className ?? ''}`}>
                    {col.render ? col.render(r) : valueOf(col, r)}
                  </td>
                ))}
              </tr>
            ))}
            {processed.length === 0 && (
              <tr><td colSpan={columns.length} className="px-2 py-6 text-center text-slate-400">No matching rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
