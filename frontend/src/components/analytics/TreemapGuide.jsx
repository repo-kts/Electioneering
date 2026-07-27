// Explainer shown in a modal from the treemap's "i" button: what the two dials
// (Size by / Colour by) control, every combination, and how to read one tile.
const BAND = { tight: '#e11d48', lean: '#e0891b', clear: '#84cc16', safe: '#059669' };

function Swatch({ color }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-sm" style={{ background: color }} />;
}

export default function TreemapGuide() {
  return (
    <div className="space-y-6 text-sm text-slate-700">
      <p className="text-slate-600">
        Every booth is a rectangle. <b className="text-slate-900">Size by</b> sets how big each one is;{' '}
        <b className="text-slate-900">Colour by</b> sets its shade. They work independently, so each tile carries
        two facts at once.
      </p>

      {/* Two channels */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="border border-slate-200 bg-[#fbfaf7] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Size by</div>
          <div className="mt-0.5 font-semibold text-slate-900">How big the tile is</div>
          <div className="mt-3 flex items-end gap-1" style={{ height: 40 }} aria-hidden="true">
            <span className="rounded-sm bg-accent-600" style={{ width: '34%', height: '100%' }} />
            <span className="rounded-sm bg-accent-600" style={{ width: '26%', height: '66%' }} />
            <span className="rounded-sm bg-accent-600" style={{ width: '18%', height: '40%' }} />
            <span className="rounded-sm bg-accent-600" style={{ width: '10%', height: '20%' }} />
          </div>
          <ul className="mt-3 space-y-1 text-[13px]">
            <li><b>Registered voters</b> — size = electorate</li>
            <li><b>Vote share</b> — size = winner's %</li>
            <li><b>Win margin</b> — size = winner − runner-up</li>
          </ul>
        </div>

        <div className="border border-slate-200 bg-[#fbfaf7] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Colour by</div>
          <div className="mt-0.5 font-semibold text-slate-900">What shade the tile is</div>
          <div className="mt-3 flex gap-1" style={{ height: 30 }} aria-hidden="true">
            {Object.values(BAND).map((c) => <span key={c} className="flex-1 rounded-sm" style={{ background: c }} />)}
          </div>
          <ul className="mt-3 space-y-1 text-[13px]">
            <li className="flex items-baseline gap-2"><Swatch color={BAND.tight} /><span><b>Win margin</b> — red = tight, green = safe</span></li>
            <li className="flex items-baseline gap-2"><Swatch color={BAND.safe} /><span><b>Turnout</b> — red = low, green = high</span></li>
          </ul>
        </div>
      </div>

      {/* Combination matrix */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Every combination — what a standout tile means
        </div>
        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Size ↓ · Colour →</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Colour = Win margin</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Colour = Turnout</th>
              </tr>
            </thead>
            <tbody className="align-top text-slate-600">
              <tr>
                <th className="border-b border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-800">Registered voters</th>
                <td className="border-b border-slate-100 px-3 py-2.5">Big <b className="text-slate-900">red</b> = a large booth that was <b className="text-slate-900">close</b> — top battleground.</td>
                <td className="border-b border-slate-100 px-3 py-2.5">Big <b className="text-slate-900">red</b> = a large booth with <b className="text-slate-900">low turnout</b> — mobilisation priority.</td>
              </tr>
              <tr>
                <th className="border-b border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-800">Vote share</th>
                <td className="border-b border-slate-100 px-3 py-2.5">Big <b className="text-slate-900">green</b> = won big and by a wide gap — a fortress.</td>
                <td className="border-b border-slate-100 px-3 py-2.5">Big <b className="text-slate-900">red</b> = winner dominated but <b className="text-slate-900">few turned out</b> — soft support.</td>
              </tr>
              <tr>
                <th className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-800">Win margin</th>
                <td className="px-3 py-2.5"><span className="text-slate-400">same metric twice</span> — size &amp; colour agree: big green = safe, red sliver = tight.</td>
                <td className="px-3 py-2.5">Small red = a <b className="text-slate-900">tight booth</b> that also had <b className="text-slate-900">low turnout</b> — fragile.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Reading one tile */}
      <div className="flex flex-col gap-4 border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div
          className="relative flex min-h-[96px] w-full shrink-0 flex-col justify-end rounded-[5px] p-3 text-white sm:w-[130px]"
          style={{ background: BAND.tight, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }}
        >
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-[5px]" style={{ background: '#f97316' }} />
          <span className="text-lg font-semibold leading-none">PS&#8209;7</span>
          <span className="mt-1 text-[11px] font-medium opacity-90 tabular-nums">601 votes</span>
        </div>
        <div>
          <div className="font-semibold text-slate-900">A big red tile</div>
          <p className="mt-1 text-[13px] text-slate-600">
            With <b>Size = registered voters</b> and <b>Colour = win margin</b>, this is a booth with
            <b> many voters</b> (large) that was <b>won by a hair</b> (red). The orange stripe on top is the
            leading candidate's party. Big-and-red is exactly what you hunt for.
          </p>
        </div>
      </div>

      {/* Redundant note */}
      <div className="border-l-2 border-accent-600 bg-[#fbfaf7] px-4 py-3 text-[13px] text-slate-600">
        <b className="text-slate-900">Same metric on both dials?</b> Setting Size and Colour both to Win margin makes
        them say the same thing — big tiles always green, slivers always red. Dramatic for spotting close races, but
        you learn one fact instead of two. Pair <i>different</i> metrics to get more from a single glance.
      </div>

      <p className="text-[12px] text-slate-400">
        Bands — Margin: Tight &lt;3% · Lean &lt;10% · Clear &lt;20% · Safe 20%+. Turnout: Low &lt;55% · Mid 55–70% ·
        High 70–85% · Very high 85%+. Hover any tile for the full numbers.
      </p>
    </div>
  );
}
