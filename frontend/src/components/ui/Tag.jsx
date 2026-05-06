export default function Tag({ tone = 'default', dot = false, children, className = '' }) {
  const toneCls = tone === 'default' ? '' : tone;
  const cls = ['tag', toneCls, dot && 'dot', className].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}
