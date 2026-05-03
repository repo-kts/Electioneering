import { useEffect, useRef } from 'react';

export default function Sparkline({ points, color, className = 'kpi-spark' }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    ctx.beginPath();
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * (w - 2) + 1;
      const y = h - ((p - min) / range) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const lx = (w - 2) + 1;
    const ly =
      h - ((points[points.length - 1] - min) / range) * (h - 6) - 3;
    ctx.beginPath();
    ctx.arc(lx - 1, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [points, color]);

  return <canvas ref={ref} className={className} />;
}
