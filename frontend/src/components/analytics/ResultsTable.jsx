import { topResults } from '../../data/results.js';
import { PARTY_COLORS } from '../../data/parties.js';
import { ChevronDownIcon } from '../ui/Icon.jsx';
import Button from '../ui/Button.jsx';

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function ResultsTable() {
  return (
    <div className="results-card">
      <div className="results-head">
        <div>
          <h2>Top constituencies by margin</h2>
          <p>Sorted by leading candidate's vote share</p>
        </div>
        <Button leadingIcon={<ChevronDownIcon />}>Sort</Button>
      </div>
      <table className="results">
        <thead>
          <tr>
            <th style={{ width: 50 }}>#</th>
            <th>Constituency</th>
            <th>Leader</th>
            <th className="right">Votes</th>
            <th className="right" style={{ width: 170 }}>
              Share
            </th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {topResults.map((r) => (
            <tr key={r.rank}>
              <td>
                <div className={`r-rank ${r.rank === 1 ? 'lead' : ''}`}>{pad(r.rank)}</div>
              </td>
              <td>
                <div className="r-name">{r.name}</div>
                <div className="r-cand">
                  {r.candidate} · {r.stations} stations
                </div>
              </td>
              <td>
                <span className={`party-tag ${r.party.toLowerCase()}`}>{r.party}</span>
              </td>
              <td className="right r-num">{r.votes.toLocaleString()}</td>
              <td className="right">
                <div className="r-num">{r.share}%</div>
                <div className="bar-share">
                  <div
                    className="bar-share-fill"
                    style={{
                      width: r.share + '%',
                      background: PARTY_COLORS[r.party],
                    }}
                  />
                </div>
              </td>
              <td>
                <span className={`lead-pill ${r.tight ? 'tight' : ''}`}>{r.margin}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
