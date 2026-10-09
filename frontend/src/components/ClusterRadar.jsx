import { useEffect, useRef, useState } from 'react';
import { C, FEAT_LABELS } from '../config/theme';
import { clusterColor } from '../utils/groups';

export function ClusterRadar({ clustering, ranking }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 340;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const profiles = clustering?.cluster_profiles || {};
    const clusters = Object.keys(profiles).sort((a, b) => Number(a) - Number(b));
    const topFeats = ranking.slice(0, 8).map(r => r.feature);
    if (!clusters.length || !topFeats.length) return;

    const pad = 56;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) / 2 - pad;
    const N = topFeats.length;
    const ang = i => -Math.PI / 2 + (2 * Math.PI * i) / N;
    ctx.strokeStyle = `${C.border}88`;
    ctx.fillStyle = C.muted;
    ctx.font = "10px 'Segoe UI', sans-serif";
    [0.25, 0.5, 0.75, 1].forEach(r => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = ang(i % N);
        const x = cx + Math.cos(a) * R * r, y = cy + Math.sin(a) * R * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });

    // axes + labels
    topFeats.forEach((f, i) => {
      const a = ang(i);
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      const lx = cx + Math.cos(a) * (R + 16), ly = cy + Math.sin(a) * (R + 16);
      const label = FEAT_LABELS[f] || f;
      ctx.fillStyle = C.text;
      ctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.length > 26 ? label.slice(0, 25) + '…' : label, lx, ly);
    });

    // polygones
    clusters.forEach(cid => {
      const prof = profiles[cid];
      const color = clusterColor(Number(cid));
      ctx.beginPath();
      topFeats.forEach((f, i) => {
        const v = Math.min(1, Math.max(0, Number(prof?.features?.[f]?.median ?? 0.5)));
        const a = ang(i);
        const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = `${color}2e`;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [clustering, ranking]);

  const profiles = clustering?.cluster_profiles || {};
  const clusters = Object.keys(profiles).sort((a, b) => Number(a) - Number(b));

  return (
    <div>
      <canvas ref={ref} style={{ width:'100%', height:340, display:'block', borderRadius:8, border:`1px solid ${C.border}` }} />
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:6, justifyContent:'center' }}>
        {clusters.map(cid => (
          <span key={cid} style={{ fontSize:11, color:C.muted, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:10, height:10, borderRadius:3, background:clusterColor(Number(cid)) }} />
            Cluster {cid} (n={profiles[cid]?.size ?? '?'})
          </span>
        ))}
      </div>
    </div>
  );
}
