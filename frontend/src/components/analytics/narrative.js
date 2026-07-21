// Plain-language narrative helpers — turn metric objects into short English
// sentences an advisor can read at a glance. Pure functions, no rendering, so
// they can be reused by the geography rollups, the constituency summary, and
// the booth banner (and unit-tested if a runner is ever added).

const pctPts = (frac) => `${((frac ?? 0) * 100).toFixed(1)}%`;
const nfmt = (n) => (n ?? 0).toLocaleString();

/** Count seats led by each party from a list of hierarchy constituencies. */
export function seatsByParty(constituencies = []) {
  const counts = new Map();
  for (const c of constituencies) {
    const party = c.winner?.party || 'Others';
    counts.set(party, (counts.get(party) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([party, seats]) => ({ party, seats }))
    .sort((a, b) => b.seats - a.seats);
}

/**
 * One-line rollup for a geography level (state / parliamentary / list).
 * e.g. "12 constituencies · BJP leads 8, INC 3, Others 1 · 9.4L electors".
 */
export function geoRollupStory(constituencies = []) {
  if (!constituencies.length) return 'No constituencies on record here yet.';
  const n = constituencies.length;
  const seats = seatsByParty(constituencies).slice(0, 3);
  const seatStr = seats.map((s) => `${s.party} ${s.seats}`).join(', ');
  const electors = constituencies.reduce((s, c) => s + (c.totalElectors ?? 0), 0);
  const electorStr = electors >= 100000 ? `${(electors / 100000).toFixed(1)}L electors` : `${nfmt(electors)} electors`;
  return `${n} ${n === 1 ? 'constituency' : 'constituencies'} · ${seatStr} · ${electorStr}`;
}

/**
 * A short story for a constituency across every recorded year of one election
 * type. `elections` is the assemblyTimeline list (year DESC). Returns an array
 * of sentences (0–3) so the caller can style each line.
 */
export function constituencyStory(elections = [], { electionType } = {}) {
  const rows = electionType
    ? elections.filter((e) => e.electionType === electionType)
    : elections;
  if (!rows.length) return [];
  const out = [];

  const total = rows.length;

  // 1) Who holds it — dominant winner across recorded years.
  if (total === 1) {
    // Only one election on record — describe it directly.
    const e = rows[0];
    const w = e.winner;
    if (w) {
      const party = w.party ? ` (${w.party})` : '';
      out.push(`Only ${e.electionYear ?? 'one year'} is on record so far — ${w.name}${party} won with ${pctPts(w.share)}.`);
    }
  } else {
    const winCounts = new Map();
    for (const e of rows) {
      const key = e.winner?.party || e.winner?.name;
      if (key) winCounts.set(key, (winCounts.get(key) ?? 0) + 1);
    }
    const top = [...winCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const [holder, wins] = top;
      if (wins === total) {
        out.push(`${holder} has won this seat in all ${total} recorded elections — a stronghold.`);
      } else if (wins > 1) {
        out.push(`${holder} has won this seat ${wins} of the last ${total} times.`);
      } else {
        out.push(`No single party dominates — ${winCounts.size} different winners across ${total} elections.`);
      }
    }
  }

  // 2) Turnout trend — earliest vs latest (rows are year DESC).
  const withTurnout = rows.filter((e) => e.turnout?.pct != null);
  if (withTurnout.length >= 2) {
    const latest = withTurnout[0];
    const earliest = withTurnout[withTurnout.length - 1];
    const delta = (latest.turnout.pct ?? 0) - (earliest.turnout.pct ?? 0);
    const dir = delta > 0.02 ? 'rising' : delta < -0.02 ? 'falling' : 'steady';
    out.push(
      `Turnout is ${dir} — ${pctPts(earliest.turnout.pct)} in ${earliest.electionYear ?? '—'} to ${pctPts(latest.turnout.pct)} in ${latest.electionYear ?? '—'}.`,
    );
  }

  // 3) Closest contest — smallest winner→runner-up share gap (needs >1 year).
  let closest = total > 1 ? null : undefined;
  for (const e of total > 1 ? rows : []) {
    if (e.winner?.share == null || e.runnerUp?.share == null) continue;
    const gap = e.winner.share - e.runnerUp.share;
    if (closest == null || gap < closest.gap) closest = { gap, year: e.electionYear, e };
  }
  if (closest) {
    out.push(`Closest fight: ${closest.year ?? '—'}, won by just ${pctPts(closest.gap)}.`);
  }

  return out;
}

/**
 * Plain-language banner for a single booth. `d` is the boothDetail payload.
 * Returns { headline, detail } — headline is the situation, detail the "so what".
 */
export function boothStory(d) {
  if (!d) return { headline: '', detail: '' };
  const leader = d.leader?.name ?? '—';
  const share = d.leader?.share ?? 0;
  const turnout = Math.min(d.turnout?.pct ?? 0, 1);
  const registered = d.turnout?.registered ?? 0;
  const cls = d.classification;

  const clsLabel = {
    'Safe-win': 'Stronghold',
    Stronghold: 'Stronghold',
    'Marginal-win': 'Narrow win',
    Swing: 'Swing booth',
    'Marginal-loss': 'Recoverable',
    'Safe-loss': 'Opposition stronghold',
    'Opposition-leaning': 'Opposition-leaning',
    'Low-turnout': 'Low turnout',
    'No-data': 'No result yet',
  }[cls] ?? (cls || 'Booth');

  let headline;
  if (!cls || cls === 'No-data') {
    headline = 'No Form 20 result recorded for this booth yet.';
  } else {
    headline = `${clsLabel} — ${leader} led with ${pctPts(share)} of the vote here.`;
  }

  // "So what" — the actionable read.
  let detail = '';
  const lowTurnout = turnout > 0 && turnout < 0.6;
  if (cls === 'Swing' || cls === 'Marginal-loss') {
    detail = `Within reach. A focused persuasion push could flip this booth.`;
  } else if (cls === 'Marginal-win') {
    detail = `Won narrowly — worth defending so it doesn't slip.`;
  } else if (cls === 'Safe-win' || cls === 'Stronghold') {
    detail = lowTurnout
      ? `Your base, but turnout was only ${pctPts(turnout)} — GOTV here banks more votes cheaply.`
      : `Solid base. Keep it consolidated.`;
  } else if (cls === 'Safe-loss' || cls === 'Opposition-leaning') {
    detail = `Tough terrain — limit losses rather than over-invest.`;
  } else if (lowTurnout) {
    detail = `Turnout was only ${pctPts(turnout)} of ${nfmt(registered)} voters — room to mobilise.`;
  }

  return { headline, detail, label: clsLabel, turnout };
}
