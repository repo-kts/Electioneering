// Reusable loading + error state primitives (Tailwind).

export function Spinner({ size = 16 }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-accent-700 align-[-2px]"
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    />
  );
}

export function FullLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 6, style }) {
  return (
    <div
      className="animate-pulse bg-slate-100"
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

export function SkeletonRows({ rows = 5, cols = 5, rowHeight = 28 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2" style={{ height: rowHeight }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} height={rowHeight - 10} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const status = error?.status;
  const message = error?.message ?? String(error);
  return (
    <div className="border border-rose-200 bg-rose-50 p-4" role="alert">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center bg-rose-600 text-xs font-bold text-white">!</span>
        <strong className="text-sm text-rose-800">{title}</strong>
        {status != null && <span className="rounded bg-rose-100 px-1.5 text-xs text-rose-600">{status}</span>}
      </div>
      <div className="mt-2 text-sm text-rose-700">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function QueryBoundary({ query, skeleton, loader, children, errorTitle, empty, isEmpty }) {
  if (query.isPending || (query.isFetching && !query.data)) {
    return skeleton ?? loader ?? <FullLoader />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} title={errorTitle} />;
  }
  if (isEmpty?.(query.data) && empty) return empty;
  return typeof children === 'function' ? children(query.data) : children;
}
