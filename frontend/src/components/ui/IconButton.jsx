export default function IconButton({ title, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`.trim()}
      title={title}
      aria-label={title}
      {...rest}
    >
      {children}
    </button>
  );
}
