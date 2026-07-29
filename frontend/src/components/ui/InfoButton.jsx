import { useState } from 'react';

// Small "i" affordance that explains, in plain words, what a chart or panel is
// about. Text shows on hover/focus and can be pinned open with a click (so it
// works for touch + keyboard too). Matches the (i) used by the treemap guide.
export default function InfoButton({ text, label = 'What is this?', className = '' }) {
  const [pinned, setPinned] = useState(false);
  if (!text) return null;
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold italic text-slate-500 transition hover:border-accent-500 hover:text-accent-700"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`absolute right-0 top-full z-40 mt-1 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-600 shadow-lg transition ${
          pinned ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  );
}
