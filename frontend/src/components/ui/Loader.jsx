// Reusable loading + error state primitives.
// Pair with TanStack Query: pass `query` and let the component decide.

export function Spinner({ size = 16 }) {
  return (
    <span
      className="qq-spinner"
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    />
  );
}

export function FullLoader({ label = 'Loading…' }) {
  return (
    <div className="qq-fullloader">
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 4, style }) {
  return (
    <div
      className="qq-skel"
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

export function SkeletonRows({ rows = 5, cols = 5, rowHeight = 28 }) {
  return (
    <div className="qq-skel-rows">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="qq-skel-row" style={{ height: rowHeight }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} height={rowHeight - 10} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * ErrorState — renders a small card describing the error with a Retry
 * button. Use directly or via QueryBoundary.
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const status = error?.status;
  const message = error?.message ?? String(error);
  return (
    <div className="qq-error" role="alert">
      <div className="qq-error-head">
        <span className="qq-error-icon">!</span>
        <strong>{title}</strong>
        {status != null && <span className="qq-error-status">{status}</span>}
      </div>
      <div className="qq-error-msg">{message}</div>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * QueryBoundary — wrap children that depend on a query. Renders loader
 * skeleton or error state until the query has settled.
 *
 *   <QueryBoundary query={q} skeleton={<SkeletonRows />}>
 *     {(data) => <Table rows={data.items} />}
 *   </QueryBoundary>
 */
export function QueryBoundary({
  query,
  skeleton,
  loader,
  children,
  errorTitle,
  empty,
  isEmpty,
}) {
  if (query.isPending || (query.isFetching && !query.data)) {
    return skeleton ?? loader ?? <FullLoader />;
  }
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => query.refetch()}
        title={errorTitle}
      />
    );
  }
  if (isEmpty?.(query.data) && empty) return empty;
  return typeof children === 'function' ? children(query.data) : children;
}
