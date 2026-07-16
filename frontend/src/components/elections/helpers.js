// Shared display + color helpers for the elections drill-down and analytics pages.
// Mirrors the colorFor()/PALETTE/pct/num pattern used in ElectionOverviewPage.jsx
// so charts and badges stay visually consistent across the app.

export const PALETTE = [
  '#24594b', '#6f4e37', '#5f6f52', '#7a4e57',
  '#3f5f75', '#8a6f2a', '#574b63', '#6b6f76',
];

/** Deterministic color for an entity (candidate / party) name. Color follows the
 *  entity, never its rank, so filtering never repaints survivors. */
export function colorFor(s) {
  if (!s) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Share value is a 0..1 fraction. */
export const pct = (n) => `${((n ?? 0) * 100).toFixed(1)}%`;
export const num = (n) => (n ?? 0).toLocaleString();
