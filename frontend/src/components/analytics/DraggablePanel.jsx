// A panel you can drag anywhere on the page. Grab the grip in the header to
// pop it out into a floating (position: fixed) window and move it around the
// whole site; "Dock" returns it to its original inline position.
import { useRef, useState } from 'react';

export default function DraggablePanel({ title, right, children, className = '' }) {
  const [pos, setPos] = useState(null); // {x,y} viewport coords when floating
  const [width, setWidth] = useState(null);
  const panelRef = useRef(null);
  const drag = useRef(null);

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setPos({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
  };
  const endDrag = () => {
    drag.current = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', endDrag);
    document.body.style.userSelect = '';
  };
  const startDrag = (e) => {
    e.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    if (pos == null) { setPos({ x: rect.left, y: rect.top }); setWidth(rect.width); }
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos?.x ?? rect.left,
      baseY: pos?.y ?? rect.top,
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', endDrag);
    document.body.style.userSelect = 'none';
  };
  const dock = () => { setPos(null); setWidth(null); };

  const floating = pos != null;
  const style = floating
    ? { position: 'fixed', left: pos.x, top: pos.y, width, zIndex: 60, maxHeight: '90vh', overflow: 'auto' }
    : undefined;

  return (
    <div
      ref={panelRef}
      style={style}
      className={`border border-slate-300 bg-white ${floating ? 'shadow-2xl ring-1 ring-slate-900/5' : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onMouseDown={startDrag}
            className="cursor-move rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            title="Drag to move this panel anywhere"
            aria-label="Drag panel"
          >
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
              <circle cx="3" cy="3" r="1.4" /><circle cx="9" cy="3" r="1.4" />
              <circle cx="3" cy="8" r="1.4" /><circle cx="9" cy="8" r="1.4" />
              <circle cx="3" cy="13" r="1.4" /><circle cx="9" cy="13" r="1.4" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {floating && (
            <button
              type="button"
              onClick={dock}
              className="border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Dock ↩
            </button>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
