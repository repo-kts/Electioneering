const VARIANTS = {
  default: 'btn',
  primary: 'btn btn-primary',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-danger',
};

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

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
  const cls = [VARIANTS[variant], SIZES[size], block && 'btn-block', className]
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
