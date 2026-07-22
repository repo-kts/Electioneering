import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// Share the app-wide palette/formatters so the map matches every other chart.
import { colorFor, pct, num, boothName, boothTag } from '../elections/helpers.js';

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36] });
  }, [points, map]);
  return null;
}

export default function BoothMap({ items = [], electionId, linkFor }) {
  // Where a booth's popup link points. Defaults to the per-election booth page;
  // the booth-wise flow passes its own (the cross-election station history).
  const hrefFor = linkFor ?? ((b) => `/elections/${electionId}/booth/${b.id}`);
  const placed = useMemo(
    () => items.filter((b) => b.latitude != null && b.longitude != null),
    [items],
  );
  const points = useMemo(() => placed.map((b) => [b.latitude, b.longitude]), [placed]);
  const center = points[0] ?? [20.59, 78.96]; // India fallback

  if (placed.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-400">
        No booth coordinates yet. Click “Geocode booths” to place them on the map.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: 460, width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {placed.map((b) => {
          const reported = (b.totalValid ?? 0) > 0;
          const c = colorFor(b.leader);
          const r = 8 + Math.min((b.totalValid ?? 0) / 200, 14);
          return (
            <CircleMarker
              key={b.id}
              center={[b.latitude, b.longitude]}
              radius={reported ? r : 7}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: reported ? c : '#cbd5e1', fillOpacity: 0.85 }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <span className="font-semibold">{boothName(b)}</span>
                {reported && <> · {b.leader} {pct(b.leaderShare)}</>}
              </Tooltip>
              <Popup>
                <div className="min-w-[160px]">
                  <div className="text-sm font-semibold text-slate-800">{boothName(b)}</div>
                  {boothTag(b) && <div className="text-xs text-slate-500">{boothTag(b)}</div>}
                  {reported ? (
                    <div className="mt-1 text-xs">
                      <span className="font-medium" style={{ color: c }}>{b.leader}</span> leading · {pct(b.leaderShare)}
                      <br />
                      {num(b.totalValid)} valid · {num(b.registeredVoters)} voters mapped
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-slate-400">No Form 20 data</div>
                  )}
                  <Link to={hrefFor(b)} className="mt-1.5 inline-block text-xs font-medium text-accent-600">
                    Open booth →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
