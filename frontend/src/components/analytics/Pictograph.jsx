// Small reusable pictograph primitives for booth demographics.
// Inline SVG glyphs + an icon-array that renders one glyph per unit of people,
// colored by segment. Colors come from the caller (colorFor / PALETTE) so the
// whole app stays on one palette.

export function PersonGlyph({ size = 18, color = '#94a3b8', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill={color}
        d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 1.6c-4 0-7.5 2-7.5 4.9V21h15v-2.5c0-2.9-3.5-4.9-7.5-4.9Z"
      />
    </svg>
  );
}

export function HouseGlyph({ size = 20, color = '#94a3b8', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill={color} d="M12 3 2 11.2h2.6V21h5.1v-5.6h4.6V21h5.1v-9.8H22Z" />
    </svg>
  );
}

// Renders `total` broken into proportional glyphs. Each glyph ≈ one "unit" of
// people; a legend (in the caller) carries the exact counts. Non-zero segments
// always get at least one glyph so small groups stay visible.
export function IconArray({ segments = [], glyphs = 40, size = 16, Glyph = PersonGlyph }) {
  const total = segments.reduce((a, s) => a + (s.count || 0), 0);
  if (total <= 0) return <p className="py-6 text-center text-sm text-slate-400">No data</p>;

  const cells = [];
  let used = 0;
  segments.forEach((s, si) => {
    if (!s.count) return;
    let n = Math.max(1, Math.round((s.count / total) * glyphs));
    if (si === segments.length - 1) n = Math.max(1, glyphs - used); // last fills remainder
    used += n;
    for (let i = 0; i < n; i++) cells.push(s.color);
  });

  return (
    <div className="flex flex-wrap gap-[3px]">
      {cells.map((c, i) => (
        <Glyph key={i} size={size} color={c} />
      ))}
    </div>
  );
}
