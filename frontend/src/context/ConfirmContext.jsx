// Central confirmation dialog. Replaces native window.confirm() with a themed,
// promise-based dialog so call sites stay imperative and tiny:
//
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Delete voter?', message: '…', confirmText: 'Delete' })) {
//     del.mutate();
//   }
//
// tone: 'danger' (default, red) or 'primary' (accent) for the confirm button.
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/ui/Modal.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({
      title: opts.title ?? 'Are you sure?',
      message: opts.message ?? '',
      confirmText: opts.confirmText ?? 'Confirm',
      cancelText: opts.cancelText ?? 'Cancel',
      tone: opts.tone ?? 'danger',
    });
  }), []);

  const close = useCallback((result) => {
    setState(null);
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  const confirmBtn = state?.tone === 'primary'
    ? 'border-accent-600 bg-accent-600 text-white hover:bg-accent-700'
    : 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={(
          <>
            <button
              type="button"
              onClick={() => close(false)}
              className="border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {state?.cancelText}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={`border px-3 py-1.5 text-sm font-semibold ${confirmBtn}`}
            >
              {state?.confirmText}
            </button>
          </>
        )}
      >
        {state?.message
          ? <p className="text-sm text-slate-600">{state.message}</p>
          : <p className="text-sm text-slate-600">This action cannot be undone.</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
