const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  default: 'border border-slate-300 bg-white text-slate-800 hover:bg-[#f7f5f0]',
  primary: 'bg-slate-950 text-white hover:bg-slate-800',
  ghost: 'text-slate-700 hover:bg-white',
  danger: 'bg-rose-700 text-white hover:bg-rose-800',
};

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  variant = 'default',
  size = 'md',
  block = false,
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  ...rest
}) {
  const cls = [BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
