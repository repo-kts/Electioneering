// "Constituency at a glance" — the whole record of a seat across every recorded
// election, as one scorecard: summary stats + a chronological winner timeline.
// Mirrors BoothScorecard (the booth-level version) but for a constituency, where
// margin is a vote count (not a share fraction). Sits atop the all-years Overview
// so the story reads at a glance before the narrative + charts below it.
import { useMemo } from 'react';
import { colorForCandidate, benchmarkFor, num, pct } from '../elections/helpers.js';

const typeAbbr = (t) => (/lok\s*sabha/i.test(t) ? 'GE' : /assembly/i.test(t) ? 'AE' : (t || '').slice(0, 3).toUpperCase());
const turnoutText = (v) => (v > 0 && v <= 1.05 ? pct(v) : '—');

function Stat({ label, value, sub, accent }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-[19px] font-semibold leading-tight tabular-nums" style={{ color: accent ?? '#0f172a' }} title={String(value)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/**
 * `elections` is the assembly-timeline list (year DESC) — each entry has
 * `{ electionId, electionYear, electionType, winner:{name,party,share}, winnerParty, margin(votes), turnout:{pct} }`.
 * `registeredLatest` is the latest year's registered-voter count.
 */
export default function ConstituencyScorecard({ elections = [], registeredLatest }) {
  // Chronological (oldest → newest) so the "who won" strip reads left to right.
  const timeline = useMemo(
    () => [...elections].reverse().map((e) => ({
      electionId: e.electionId,
      type: e.electionType,
      label: `${e.electionYear ?? '—'} · ${typeAbbr(e.electionType)}`,
      winnerName: e.winner?.name ?? null,
      winnerParty: e.winnerParty || e.winner?.party || null,
      winShare: e.winner?.share ?? 0,
      margin: e.margin ?? 0, // votes
      turnoutPct: e.turnout?.pct ?? 0,
    })),
    [elections],
  );

  const summary = useMemo(() => {
    const byType = new Map();
    for (const t of timeline) byType.set(t.type, (byType.get(t.type) ?? 0) + 1);
    const typeBreakdown = [...byType.entries()].map(([t, n]) => `${n} ${typeAbbr(t)}`).join(' · ');

    const wins = new Map();
    for (const t of timeline) {
      if (!t.winnerName) continue;
      const e = wins.get(t.winnerName) ?? { name: t.winnerName, party: t.winnerParty, times: 0 };
      e.times += 1;
      wins.set(t.winnerName, e);
    }
    const topWinner = [...wins.values()].sort((a, b) => b.times - a.times)[0] ?? null;
    const latest = timeline[timeline.length - 1] ?? null;
    return { typeBreakdown, topWinner, latest };
  }, [timeline]);

  if (timeline.length === 0) return null;

  return (
    <div className="border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Constituency at a glance</div>
        <h2 className="text-[15px] font-semibold text-slate-950">
          {timeline.length} election{timeline.length === 1 ? '' : 's'} on record
          {summary.typeBreakdown && <span className="font-normal text-slate-500"> · {summary.typeBreakdown}</span>}
        </h2>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 sm:grid-cols-4">
        <Stat label="Elections" value={num(timeline.length)} sub={summary.typeBreakdown || undefined} />
        <Stat
          label="Most often won by"
          value={summary.topWinner?.name ?? '—'}
          sub={summary.topWinner ? `${summary.topWinner.times}× · ${summary.topWinner.party ?? 'Ind.'}` : undefined}
          accent={summary.topWinner ? colorForCandidate(summary.topWinner.name, summary.topWinner.party) : undefined}
        />
        <Stat
          label="Latest result"
          value={summary.latest?.winnerName ?? '—'}
          sub={summary.latest ? `${summary.latest.label} · ${pct(summary.latest.winShare)}` : undefined}
          accent={summary.latest ? colorForCandidate(summary.latest.winnerName, summary.latest.winnerParty) : undefined}
        />
        <Stat label="Registered (latest)" value={num(registeredLatest)} />
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Who won, election by election</div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {timeline.map((t) => {
            const bench = benchmarkFor(t.winShare);
            const color = colorForCandidate(t.winnerName, t.winnerParty);
            return (
              <div key={t.electionId ?? t.label} className="flex w-[190px] shrink-0 flex-col border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                  <span className="text-xs font-semibold tabular-nums text-slate-700">{t.label}</span>
                  <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold ${bench.cls}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: bench.dot }} />
                    {bench.label}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-sm font-semibold text-slate-900" title={t.winnerName ?? ''}>{t.winnerName ?? '—'}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.winnerParty && <span className="font-medium text-slate-600">{t.winnerParty}</span>}
                    {t.winnerParty ? ' · ' : ''}{pct(t.winShare)} share
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1 text-[11px] tabular-nums text-slate-500">
                    <span>margin {num(t.margin)}</span>
                    <span>turnout {turnoutText(t.turnoutPct)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
