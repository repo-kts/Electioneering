import { Link } from 'react-router-dom';

/** Breadcrumbs — items: [{ label, to? }]. Last item is the current page. */
export default function Breadcrumbs({ items = [] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {it.to && !last ? (
              <Link to={it.to} className="hover:text-accent-700">
                <span className="text-slate-500 hover:text-accent-700">{it.label}</span>
              </Link>
            ) : (
              <span className={last ? 'font-medium text-slate-800' : 'text-slate-500'}>
                {it.label}
              </span>
            )}
            {!last && <span className="text-slate-300">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
