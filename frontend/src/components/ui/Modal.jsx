// Central modal/dialog primitive. Portals to <body> so it escapes any parent
// stacking/overflow context, traps Escape, locks body scroll, and closes on
// backdrop click. Compose a header (title), body (children) and footer (actions).
//
//   <Modal open={open} onClose={close} title="Edit voter" footer={<>…buttons…</>}>
//     …form…
//   </Modal>
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = SIZES[size] ?? SIZES.md;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`modal-panel flex max-h-[calc(100vh-2rem)] w-full ${width} flex-col border border-slate-300 bg-white shadow-pop`}
      >
        {title != null && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
            <button type="button" onClick={() => onClose?.()} className="text-lg leading-none text-slate-400 hover:text-slate-700" aria-label="Close">×</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer != null && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
