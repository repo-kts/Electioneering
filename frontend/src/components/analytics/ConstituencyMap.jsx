import { constituencies } from '../../data/constituencies.js';
import { PARTY_COLORS } from '../../data/parties.js';
import { seatsBreakdown } from '../../data/results.js';

export default function ConstituencyMap() {
  return (
    <div className="map-card">
      <div className="chart-card-head" style={{ marginBottom: 22 }}>
        <div>
          <div className="chart-title">Constituency outlook</div>
          <div className="chart-sub">
            96 seats shown · coloured by leading party · hover for details
          </div>
        </div>
        <span className="chart-tag">96 seats</span>
      </div>

      <div className="map-grid-wrap">
        <div className="map-grid">
          {constituencies.map(([name, party, share]) => {
            const t = Math.max(0, Math.min(1, (share - 35) / 22));
            const opacity = 0.45 + t * 0.55;
            return (
              <div
                key={name}
                className="cell"
                style={{ background: PARTY_COLORS[party], opacity }}
              >
                {party}
                <div className="cell-tooltip">
                  <strong>{name}</strong>
                  {party} leading · <span className="pct-line">{share}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="map-legend">
          <h4>Lead by party</h4>
          {seatsBreakdown.map((p) => (
            <div className="map-legend-item" key={p.code}>
              <div
                className="map-legend-swatch"
                style={{ background: PARTY_COLORS[p.code] }}
              />
              <div className="map-legend-name">{p.name}</div>
              <div className="map-legend-count">{p.seats} seats</div>
            </div>
          ))}

          <div className="map-legend-divider" />
          <h4 style={{ marginBottom: 8 }}>Margin shading</h4>
          <div style={{ display: 'flex', gap: 3, height: 12, marginBottom: 6 }}>
            {[0.35, 0.55, 0.75, 1].map((o) => (
              <div
                key={o}
                style={{
                  flex: 1,
                  background: PARTY_COLORS.PNF,
                  opacity: o,
                  borderRadius: 3,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--text-3)',
            }}
          >
            <span>Tight</span>
            <span>Safe</span>
          </div>

          <div className="map-legend-divider" />
          <div className="map-legend-row">
            <span>Total seats</span>
            <strong>96</strong>
          </div>
          <div className="map-legend-row">
            <span>Tight (≤ 2%)</span>
            <strong>11</strong>
          </div>
          <div className="map-legend-row">
            <span>Yet to report</span>
            <strong style={{ color: 'var(--danger)' }}>12</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
