import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import PageHead from '../components/ui/PageHead.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import { RetryIcon } from '../components/ui/Icon.jsx';
import { Spinner, ErrorState, SkeletonRows } from '../components/ui/Loader.jsx';
import { api } from '../lib/api.js';

// Stable color from a string (candidate / community / etc.)
function colorFor(s) {
  if (!s) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 65% 50%)`;
}

const PALETTE = ['#2563EB', '#F97316', '#16A34A', '#8B5CF6', '#EC4899', '#0EA5E9', '#EAB308', '#EF4444'];

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}
function num(n) {
  return (n ?? 0).toLocaleString();
}

export default function AnalyticsPage() {
  const [electionId, setElectionId] = useState(null);
  const overview = useQuery({
    queryKey: ['analytics', 'overview', electionId],
    queryFn: () => api.analyticsOverview(electionId),
    placeholderData: (prev) => prev, // keep showing previous data while refetching
  });
  const data = overview.data;
  const election = data?.election;
  const voters = data?.voters;
  const elections = data?.electionsList ?? [];
  const turnoutHistory = data?.turnoutHistory ?? [];

  // Effective picker value: explicit state > backend-resolved election > none
  const pickerValue = electionId ?? overview.data?.election?.id ?? '';

  const candidateBars = useMemo(() => {
    if (!election?.candidates) return [];
    return election.candidates.map((c) => ({
      name: c.name,
      votes: c.votes,
      share: c.share,
    }));
  }, [election]);

  const donutData = useMemo(() => {
    if (!election?.candidates) return [];
    return election.candidates.slice(0, 6).map((c) => ({
      name: c.name,
      value: c.votes,
    }));
  }, [election]);

  const turnoutLine = useMemo(() => {
    return turnoutHistory.map((t) => ({
      year: String(t.electionYear ?? t.electionId),
      voted: t.voted,
      registered: t.registered,
      turnoutPct: Number((t.pct * 100).toFixed(1)),
    }));
  }, [turnoutHistory]);

  return (
    <div className="shell">
      <PageHead
        title="Analytics"
        badge={
          overview.isFetching ? (
            <span className="live-pill"><Spinner size={10} /> Refreshing</span>
          ) : (
            <span className="live-pill">Live</span>
          )
        }
        subtitle="Real numbers from voter records and Form 20. Pick an election to switch the scope."
        actions={
          <>
            <Link to="/segment" style={{ textDecoration: 'none' }}>
              <Button>Open Segment</Button>
            </Link>
            <Button
              variant="primary"
              leadingIcon={<RetryIcon />}
              onClick={() => overview.refetch()}
              disabled={overview.isFetching}
            >
              {overview.isFetching ? 'Loading…' : 'Refresh'}
            </Button>
          </>
        }
      />

      {overview.isError && (
        <ErrorState
          error={overview.error}
          onRetry={() => overview.refetch()}
          title="Couldn't load analytics"
        />
      )}

      {overview.isPending && !data && (
        <Card>
          <Card.Body>
            <SkeletonRows rows={6} cols={6} />
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Election:</label>
            <select
              value={pickerValue}
              onChange={(e) => setElectionId(e.target.value ? Number(e.target.value) : null)}
              className="field"
            >
              {elections.length === 0 && <option value="">— no elections —</option>}
              {elections.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.assemblyNo}-{e.assemblyName} {e.electionYear ?? ''} ({e.state})
                </option>
              ))}
            </select>
            {election && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Total electors: <strong>{num(election.totalElectors)}</strong>
              </span>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* KPI tiles */}
      <div style={{ marginTop: 16 }}>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Kpi label="Total voters" value={num(voters?.total)} />
          <Kpi label="Turnout" value={election ? pct(election.turnout.pct) : '—'} sub={election ? `${num(election.turnout.voted)} / ${num(election.turnout.registered)}` : ''} />
          <Kpi label="Total valid votes" value={num(election?.totalValid)} />
          <Kpi label="NOTA" value={num(election?.totalNota)} sub={election && election.totalCast ? pct(election.totalNota / election.totalCast) : ''} />
          <Kpi label="Leading candidate" value={election?.leader?.name ?? '—'} sub={election?.leader ? `${pct(election.leader.share)} · ${num(election.leader.votes)} votes` : ''} />
          <Kpi label="Margin over runner-up" value={election && election.leader && election.runnerUp ? num(election.leader.votes - election.runnerUp.votes) : '—'} sub={election?.runnerUp?.name} />
        </div>
      </div>

      {/* Candidate vote bar + share donut */}
      <div className="chart-row" style={{ marginTop: 16 }}>
        <Card>
          <Card.Head title="Candidate votes (Form 20)" subtitle={election ? `${num(election.totalValid)} valid votes counted` : 'Select an election'} />
          <Card.Body>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={candidateBars} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => num(v)} />
                <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                  {candidateBars.map((c) => (
                    <Cell key={c.name} fill={colorFor(c.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
        <Card>
          <Card.Head title="Vote share" subtitle="Top 6 candidates by share of valid votes" />
          <Card.Body>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={colorFor(d.name)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [num(v), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </div>

      {/* Turnout history line */}
      {turnoutLine.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <Card.Head title="Turnout history" subtitle={`Across ${turnoutLine.length} election${turnoutLine.length === 1 ? '' : 's'} in this assembly`} />
            <Card.Body>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={turnoutLine} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#eef2f7" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="pct" tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                  <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="pct" dataKey="turnoutPct" stroke="#2563EB" strokeWidth={2} dot />
                  <Line yAxisId="count" dataKey="voted" stroke="#16A34A" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* Demographics — 4 charts */}
      <div style={{ marginTop: 16 }}>
        <div className="chart-row">
          <DistroCard title="Community" data={voters?.byCommunity} />
          <DistroCard title="Religion" data={voters?.byReligion} />
        </div>
        <div className="chart-row" style={{ marginTop: 16 }}>
          <DistroCard title="Age bucket" data={voters?.byAgeBucket} />
          <DistroCard title="Gender" data={voters?.byGender} />
        </div>
        <div className="chart-row" style={{ marginTop: 16 }}>
          <DistroCard title="Occupation" data={voters?.byOccupation} />
          <DistroCard title="Language" data={voters?.byLanguage} />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: 22 }}>{value}</div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>{sub}</div>
      )}
    </div>
  );
}

function DistroCard({ title, data = [] }) {
  const top = data.slice(0, 8).map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }));
  return (
    <Card>
      <Card.Head title={title} subtitle={`Top ${Math.min(top.length, 8)} of ${data.length}`} />
      <Card.Body>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid stroke="#eef2f7" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="key" tick={{ fontSize: 11 }} width={110} />
            <Tooltip formatter={(v) => num(v)} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {top.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
}
