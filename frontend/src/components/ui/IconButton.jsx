export default function IconButton({ title, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 ${className}`.trim()}
      title={title}
      aria-label={title}
      {...rest}
    >
      {children}
    </button>
  );
}
