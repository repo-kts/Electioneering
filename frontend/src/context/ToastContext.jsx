// Central toast notifications. Self-styled (Tailwind) and stacking — multiple
// toasts queue bottom-right and auto-dismiss. Types: success | error | info |
// warning. API is back-compatible: useToast().show(message, type) still works,
// plus convenience helpers .success/.error/.info/.warning and manual .dismiss.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);
let idSeq = 0;

const STYLES = {
  success: 'border-accent-600 bg-accent-50 text-accent-800',
  error: 'border-rose-300 bg-rose-50 text-rose-800',
  info: 'border-slate-300 bg-white text-slate-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
};
const ICON_BG = {
  success: 'bg-accent-600',
  error: 'bg-rose-600',
  info: 'bg-slate-600',
  warning: 'bg-amber-500',
};
const ICON = { success: '✓', error: '!', info: 'i', warning: '!' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const show = useCallback((message, type = 'success', opts = {}) => {
    const id = ++idSeq;
    const duration = opts.duration ?? 3200;
    setToasts((list) => [...list, { id, message, type }]);
    if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show,
    dismiss,
    success: (m, o) => show(m, 'success', o),
    error: (m, o) => show(m, 'error', o),
    info: (m, o) => show(m, 'info', o),
    warning: (m, o) => show(m, 'warning', o),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={`toast-item pointer-events-auto flex items-start gap-2.5 border px-3 py-2.5 text-sm shadow-pop ${STYLES[t.type] ?? STYLES.info}`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ICON_BG[t.type] ?? ICON_BG.info}`}>
                {ICON[t.type] ?? 'i'}
              </span>
              <span className="min-w-0 flex-1 break-words">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-mr-0.5 shrink-0 text-base leading-none text-slate-400 hover:text-slate-700"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
