import Sparkline from './Sparkline.jsx';
import { PARTY_COLORS } from '../../data/parties.js';
import {
  CheckCircleIcon,
  PinIcon,
  StarIcon,
  UsersIcon,
} from '../ui/Icon.jsx';

export default function KpiGrid({ totalVotes }) {
  return (
    <section className="kpi-grid">
      <div className="kpi">
        <div className="kpi-label">
          <span className="kpi-icon">
            <UsersIcon />
          </span>
          Total Votes
        </div>
        <div className="kpi-value tnum">{totalVotes.toLocaleString()}</div>
        <div className="kpi-trend up">
          <strong>↑ +6.9%</strong> vs. last refresh
        </div>
        <Sparkline points={[1.4, 1.6, 1.9, 2.1, 2.3, 2.5, 2.7, 2.84]} color={PARTY_COLORS.PNF} />
      </div>

      <div className="kpi">
        <div className="kpi-label">
          <span className="kpi-icon green">
            <CheckCircleIcon />
          </span>
          Voter Turnout
        </div>
        <div className="kpi-value tnum">
          63.4<span className="suffix">%</span>
        </div>
        <div className="kpi-trend up">
          <strong>↑ +2.1pt</strong> vs. 2022 cycle
        </div>
        <Sparkline points={[42, 47, 51, 54, 57, 59, 61, 63.4]} color={PARTY_COLORS.GUP} />
      </div>

      <div className="kpi">
        <div className="kpi-label">
          <span className="kpi-icon amber">
            <PinIcon />
          </span>
          Reporting
        </div>
        <div className="kpi-value tnum">
          437<span className="suffix">/488</span>
        </div>
        <div className="kpi-trend up">
          <strong>89.5%</strong> reporting rate
        </div>
        <Sparkline points={[120, 180, 240, 290, 340, 380, 410, 437]} color={PARTY_COLORS.CDA} />
      </div>

      <div className="kpi">
        <div className="kpi-label">
          <span className="kpi-icon purple">
            <StarIcon />
          </span>
          Leading
        </div>
        <div className="kpi-leader">
          <div className="kpi-leader-glyph">P</div>
          <div>
            <div className="kpi-leader-name">PNF</div>
            <div className="kpi-leader-share tnum">38.7% · ahead by 2.4pt</div>
          </div>
        </div>
      </div>
    </section>
  );
}
