import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, downloadBlob } from '../lib/api.js';

const pct = (n) => `${((n ?? 0) * 100).toFixed(1)}%`;
const num = (n) => (n ?? 0).toLocaleString();

const CLASS_COLOR = {
  'Safe-win': '#15803d', 'Marginal-win': '#65a30d', Swing: '#d97706',
  'Marginal-loss': '#dc6e2e', 'Safe-loss': '#b91c1c', 'No-data': '#94a3b8',
};

function ClassTag({ value }) {
  const c = CLASS_COLOR[value] ?? '#94a3b8';
  return (
    <span className="border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: c + '55', background: c + '12', color: c }}>
      {value}
    </span>
  );
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className="border-l border-slate-300 bg-white px-4 py-3 first:border-l-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold" style={{ color: accent ?? '#0f172a' }}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Panel({ title, children, className = '' }) {
  return (
    <div className={`border border-slate-300 bg-white ${className}`}>
      <div className="border-b border-slate-200 bg-[#fbfaf7] px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function BoothMiniTable({ rows = [], showClass = true }) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-slate-400">None</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1.5">PS</th><th className="py-1.5">Booth</th>
            {showClass && <th className="py-1.5">Class</th>}
            <th className="py-1.5 text-right">Our %</th><th className="py-1.5 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-slate-200">
              <td className="py-1.5">{b.serial}</td>
              <td className="max-w-[160px] truncate py-1.5 text-slate-600" title={b.name ?? ''}>{b.name ?? '—'}</td>
              {showClass && <td className="py-1.5"><ClassTag value={b.classification} /></td>}
              <td className="py-1.5 text-right tabular-nums">{pct(b.ourShare)}</td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: b.margin >= 0 ? '#15803d' : '#b91c1c' }}>
                {pct(b.margin)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CandidateReportPage() {
  const { id, name } = useParams();
  const electionId = Number(id);
  const candidate = decodeURIComponent(name);
  const { show } = useToast();
  const [downloading, setDownloading] = useState(false);

  const q = useQuery({
    queryKey: ['report-card', electionId, candidate],
    queryFn: () => api.reportCard(electionId, candidate),
  });
  const d = q.data;
  const k = d?.kpis;
  const electionName = d ? `${d.election.assemblyName} ${d.election.electionYear ?? ''}`.trim() : 'Election';

  async function download() {
    setDownloading(true);
    try {
      const p = new URLSearchParams({ electionId });
      if (candidate) p.set('candidate', candidate);
      await downloadBlob(`/api/reports/candidate?${p.toString()}`, `report-${candidate}.xlsx`);
      show('Report downloaded', 'success');
    } catch (e) {
      show(e.message || 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Elections', to: '/elections' },
          { label: electionName, to: `/elections/${electionId}` },
          { label: candidate },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-5">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Candidate report</div>
          <h1 className="text-[26px] font-semibold text-slate-950">{candidate}</h1>
          <p className="mt-1 text-sm text-slate-600">{electionName}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/elections/${electionId}/strategy?candidate=${encodeURIComponent(candidate)}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-slate-700">Win plan →</span>
          </Link>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {downloading ? 'Preparing…' : 'Download Excel report'}
          </button>
        </div>
      </div>

      {q.isError && <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{q.error.message}</div>}
      {q.isPending && <div className="h-40 animate-pulse bg-slate-200/70" />}

      {d && (
        <>
          <div className="grid grid-cols-2 border border-slate-300 bg-white md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Result" value={k.result} accent={k.result === 'Won' ? '#16a34a' : k.result === 'Lost' ? '#b91c1c' : '#475569'} />
            <Kpi label="Vote share" value={pct(k.ourShare)} />
            <Kpi label="Votes" value={num(k.ourVotes)} />
            <Kpi label="Rank" value={`${k.rank} / ${k.candidatesCount}`} />
            <Kpi label="Winner" value={k.leader ?? '—'} sub={num(k.leaderVotes)} />
            <Kpi label="Margin vs winner" value={num(k.margin)} accent={k.margin >= 0 ? '#16a34a' : '#b91c1c'} />
          </div>

          {/* Recommendations */}
          <Panel title="Recommended actions" className="mt-6">
            <ul className="space-y-2">
              {d.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-slate-300 bg-[#f7f5f0] text-xs font-semibold text-slate-700">{i + 1}</span>
                  {r}
                </li>
              ))}
            </ul>
          </Panel>

          {/* Booth summary chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(d.boothSummary).map(([cls, n]) => (
              <div key={cls} className="flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 text-sm">
                <span className="inline-block h-3 w-3" style={{ background: CLASS_COLOR[cls] }} />
                <span className="text-slate-600">{cls}</span>
                <strong className="text-slate-800">{n}</strong>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Strongest booths"><BoothMiniTable rows={d.strongBooths.slice(0, 10)} /></Panel>
            <Panel title="Weakest booths"><BoothMiniTable rows={d.weakBooths.slice(0, 10)} /></Panel>
            <Panel title={`Swing booths (${d.swingBooths.length})`}><BoothMiniTable rows={d.swingBooths.slice(0, 10)} /></Panel>
            <Panel title={`GOTV — mobilise here (${d.gotv.length})`}>
              <BoothMiniTable rows={d.gotv.slice(0, 10)} showClass={false} />
            </Panel>
          </div>

          {/* Community leaning */}
          <Panel title="Community leaning (estimate)" className="mt-4">
            <p className="mb-3 text-xs text-slate-500">Statistical / ecological — booth demographics × result, not a vote record.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="py-1.5">Community</th><th className="py-1.5 text-right">Voters</th><th className="py-1.5">Leans to</th><th className="py-1.5 text-right">Est. share</th></tr>
                </thead>
                <tbody>
                  {d.communityLeaning.map((g) => (
                    <tr key={g.group} className="border-t border-slate-200">
                      <td className="py-1.5 font-medium text-slate-700">{g.group}</td>
                      <td className="py-1.5 text-right tabular-nums">{num(g.voters)}</td>
                      <td className="py-1.5">{g.leader ?? '—'}</td>
                      <td className="py-1.5 text-right tabular-nums">{pct(g.leaderShare)}</td>
                    </tr>
                  ))}
                  {d.communityLeaning.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-slate-400">No community data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
