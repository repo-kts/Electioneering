import { useEffect, useState } from 'react';
import FilterBar from '../components/analytics/FilterBar.jsx';
import KpiGrid from '../components/analytics/KpiGrid.jsx';
import PartyBarChart from '../components/analytics/PartyBarChart.jsx';
import VoteShareDonut from '../components/analytics/VoteShareDonut.jsx';
import TurnoutLineChart from '../components/analytics/TurnoutLineChart.jsx';
import ConstituencyMap from '../components/analytics/ConstituencyMap.jsx';
import ResultsTable from '../components/analytics/ResultsTable.jsx';
import SurnameChart from '../components/analytics/SurnameChart.jsx';
import GenderChart from '../components/analytics/GenderChart.jsx';
import AgeGroupChart from '../components/analytics/AgeGroupChart.jsx';
import { DownloadIcon, RetryIcon } from '../components/ui/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import PageHead from '../components/ui/PageHead.jsx';

function fmtClock(d = new Date()) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function AnalyticsPage() {
  const [filters, setFilters] = useState({
    date: 'Today · 02 May 2026',
    region: 'All regions',
    source: 'Excel + manual entries',
  });
  const [totalVotes, setTotalVotes] = useState(2847193);
  const [lastRefresh, setLastRefresh] = useState(fmtClock());

  function refresh() {
    setTotalVotes((v) => v + Math.floor(Math.random() * 280 + 60));
    setLastRefresh(fmtClock());
  }

  useEffect(() => {
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="shell">
      <PageHead
        title="Analytics"
        badge={<span className="live-pill">Live</span>}
        subtitle="Real-time vote share, turnout, and constituency results. Updated automatically as new data comes in."
        actions={
          <>
            <Button leadingIcon={<DownloadIcon />}>Export CSV</Button>
            <Button variant="primary" leadingIcon={<RetryIcon />} onClick={refresh}>
              Refresh
            </Button>
          </>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} lastRefresh={lastRefresh} />
      <KpiGrid totalVotes={totalVotes} />

      <div className="chart-row">
        <PartyBarChart />
        <VoteShareDonut />
      </div>

      <div className="section-divider" style={{ marginTop: 16 }}>
        <div className="section-info">
          <h2>Voter Demographics</h2>
          <p>
            Aggregated insights from voter records and Form 20 — total{' '}
            <strong>622 voters</strong> in this view.
          </p>
        </div>
      </div>

      <div className="chart-row single">
        <SurnameChart />
      </div>

      <div className="chart-row">
        <GenderChart />
        <AgeGroupChart />
      </div>

      <TurnoutLineChart />
      <ConstituencyMap />
      <ResultsTable />
    </div>
  );
}
