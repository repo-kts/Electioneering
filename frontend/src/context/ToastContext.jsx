import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });
  const timer = useRef(null);

  const show = useCallback((message, type = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type, visible: true });
    timer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={`toast ${toast.type} ${toast.visible ? 'show' : ''}`}>
        <span className="toast-icon">{toast.type === 'error' ? '!' : '✓'}</span>
        <span>{toast.message}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
