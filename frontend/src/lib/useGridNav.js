import { useCallback, useMemo, useRef } from 'react';

/**
 * useGridNav — Excel-like keyboard nav and multi-cell paste for a
 * spreadsheet-style table.
 *
 * Wire-up:
 *   const { gridId, gridProps } = useGridNav({ cols, onPasteMatrix });
 *   <table data-grid-id={gridId} {...gridProps}> ... </table>
 *
 * Each editable cell input/select must carry:
 *   data-row={rowIndex} data-col={colIndex}
 *
 * Behavior:
 *   - Arrow keys: move to neighbor cell. ArrowLeft/Right only move when
 *     the caret is at the input boundary (Excel-like).
 *   - Tab / Shift+Tab: move to next / previous col, wrapping to the
 *     adjacent row at the edges.
 *   - Enter / Shift+Enter: move down / up.
 *   - Multi-cell paste (TSV from Excel): split clipboard on \n / \t and
 *     write into rows starting at the focused cell via onPasteMatrix.
 *   - Single-cell paste: native browser behavior (no interception).
 *   - Arrow keys on <select> are not intercepted, so dropdown navigation
 *     keeps working.
 */
export function useGridNav({ cols, onPasteMatrix } = {}) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    idRef.current = 'grid-' + Math.random().toString(36).slice(2, 9);
  }
  const gridId = idRef.current;

  const focusCell = useCallback(
    (r, c) => {
      const el = document.querySelector(
        `[data-grid-id="${gridId}"] [data-row="${r}"][data-col="${c}"]`,
      );
      if (el && typeof el.focus === 'function') {
        el.focus();
        if (el instanceof HTMLInputElement && el.type !== 'date' && !el.readOnly) {
          try {
            el.select();
          } catch {
            /* select not supported on this input type */
          }
        }
        return true;
      }
      return false;
    },
    [gridId],
  );

  const onKeyDown = useCallback(
    (e) => {
      const target = e.target;
      const isInput = target instanceof HTMLInputElement;
      const isSelect = target instanceof HTMLSelectElement;
      if (!isInput && !isSelect) return;

      const r = Number(target.dataset.row);
      const c = Number(target.dataset.col);
      if (!Number.isFinite(r) || !Number.isFinite(c)) return;

      // Don't hijack arrow keys on <select> (used to navigate options)
      if (isSelect && e.key.startsWith('Arrow')) return;

      let nr = r;
      let nc = c;
      let move = false;

      const getStart = () => {
        try {
          return target.selectionStart;
        } catch {
          return null;
        }
      };
      const getEnd = () => {
        try {
          return target.selectionEnd;
        } catch {
          return null;
        }
      };
      const valLen = () => (typeof target.value === 'string' ? target.value.length : 0);

      if (e.key === 'Enter') {
        nr += e.shiftKey ? -1 : 1;
        move = true;
      } else if (e.key === 'Tab') {
        nc += e.shiftKey ? -1 : 1;
        if (cols && nc < 0) {
          nc = cols - 1;
          nr -= 1;
        } else if (cols && nc >= cols) {
          nc = 0;
          nr += 1;
        }
        move = true;
      } else if (e.key === 'ArrowUp') {
        nr -= 1;
        move = true;
      } else if (e.key === 'ArrowDown') {
        nr += 1;
        move = true;
      } else if (e.key === 'ArrowLeft') {
        const s = getStart();
        if (s !== null && s > 0) return;
        nc -= 1;
        move = true;
      } else if (e.key === 'ArrowRight') {
        const ePos = getEnd();
        if (ePos !== null && ePos < valLen()) return;
        nc += 1;
        move = true;
      }

      if (!move) return;
      if (nr < 0) return;
      if (focusCell(nr, nc)) e.preventDefault();
      else if (e.key === 'Tab' || e.key === 'Enter') e.preventDefault();
    },
    [cols, focusCell],
  );

  const onPaste = useCallback(
    (e) => {
      if (typeof onPasteMatrix !== 'function') return;
      const target = e.target;
      const isInput = target instanceof HTMLInputElement;
      const isSelect = target instanceof HTMLSelectElement;
      if (!isInput && !isSelect) return;
      const r = Number(target.dataset.row);
      const c = Number(target.dataset.col);
      if (!Number.isFinite(r) || !Number.isFinite(c)) return;

      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text) return;
      const lines = text.replace(/\r/g, '').split('\n');
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      if (lines.length === 0) return;
      const matrix = lines.map((l) => l.split('\t'));
      // Single cell — let native paste happen
      if (matrix.length === 1 && matrix[0].length === 1) return;
      e.preventDefault();
      onPasteMatrix(r, c, matrix);
    },
    [onPasteMatrix],
  );

  const gridProps = useMemo(
    () => ({ onKeyDown, onPaste }),
    [onKeyDown, onPaste],
  );

  return { gridId, gridProps, focusCell };
}
