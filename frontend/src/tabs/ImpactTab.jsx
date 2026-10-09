import { useEffect, useMemo, useRef, useState } from 'react';
import { C, FEAT_LABELS } from '../config/theme';

const SERIES_COLORS = [C.accent, C.purple, C.teal, C.orange, C.expose, C.green, C.normal];

function idGroupOf(bee) {
  const id = String(bee?.id || 'Inconnu');
  const match = id.match(/^([A-Za-z]+\d+)/);
  return match ? match[1] : id.split(/[-_]/)[0] || 'Inconnu';
}

function clusterOf(bee, mlData) {
  const cluster = mlData?.per_bee?.[bee.id]?.cluster ?? bee.cluster ?? null;
  if (cluster === null || cluster === undefined) return 'Non classé';
  return Number(cluster) === -1 ? 'Outliers' : `Cluster ${cluster}`;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(arr, q) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

function featureValue(bee, feature, mlData) {
  const direct = bee.stats?.[feature];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const ml = mlData?.per_bee?.[bee.id]?.features?.[feature];
  return typeof ml === 'number' && Number.isFinite(ml) ? ml : null;
}

function valuesFor(bees, feature, mlData) {
  return bees.map(b => featureValue(b, feature, mlData)).filter(v => typeof v === 'number' && Number.isFinite(v));
}

function BoxplotCanvas({ boxes, feature }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 170;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const all = boxes.flatMap(b => b.vals);
    if (!all.length || !W) return;
    const lo = Math.min(...all), hi = Math.max(...all);
    const span = (hi - lo) || Math.abs(hi) || 1;
    const pad = { l: 56, r: 10, t: 10, b: 22 };
    const y = v => H - pad.b - ((v - (lo - span * 0.08)) / (span * 1.16)) * (H - pad.t - pad.b);

    ctx.strokeStyle = `${C.border}66`;
    ctx.fillStyle = C.muted;
    ctx.font = "10px 'Segoe UI', sans-serif";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let t = 0; t <= 3; t++) {
      const val = lo - span * 0.08 + (span * 1.16) * t / 3;
      const yy = y(val);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillText(val.toPrecision(3), pad.l - 6, yy);
    }

    const slot = (W - pad.l - pad.r) / boxes.length;
    boxes.forEach((box, i) => {
      if (!box.vals.length) return;
      const cx = pad.l + slot * (i + 0.5);
      const bw = Math.min(46, slot * 0.44);
      const s = [...box.vals].sort((a, b) => a - b);
      const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), med = median(s);
      const iqr = q3 - q1;
      const wLo = Math.min(...s.filter(v => v >= q1 - 1.5 * iqr));
      const wHi = Math.max(...s.filter(v => v <= q3 + 1.5 * iqr));

      // points individuels (jitter)
      ctx.fillStyle = box.color;
      box.vals.forEach((v, j) => {
        const jitter = Math.sin(j * 12.9898 + i * 78.233) * slot * 0.16;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(cx + jitter, y(v), 2, 0, 2 * Math.PI); ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.strokeStyle = box.color;
      ctx.lineWidth = 1.4;
      // moustaches
      ctx.beginPath();
      ctx.moveTo(cx, y(wLo)); ctx.lineTo(cx, y(q1));
      ctx.moveTo(cx, y(q3)); ctx.lineTo(cx, y(wHi));
      ctx.moveTo(cx - bw * 0.35, y(wLo)); ctx.lineTo(cx + bw * 0.35, y(wLo));
      ctx.moveTo(cx - bw * 0.35, y(wHi)); ctx.lineTo(cx + bw * 0.35, y(wHi));
      ctx.stroke();

      // boîte IQR
      ctx.fillStyle = `${box.color}26`;
      ctx.fillRect(cx - bw / 2, y(q3), bw, Math.max(2, y(q1) - y(q3)));
      ctx.strokeRect(cx - bw / 2, y(q3), bw, Math.max(2, y(q1) - y(q3)));

      // médiane
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(cx - bw / 2, y(med)); ctx.lineTo(cx + bw / 2, y(med)); ctx.stroke();

      // label groupe
      ctx.fillStyle = C.text;
      ctx.font = "600 11px 'Segoe UI', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${box.label} (n=${box.vals.length})`, cx, H - 6);
    });
  }, [boxes, feature]);

  return <canvas ref={ref} style={{ width:'100%', height:170, display:'block', borderRadius:6, border:`1px solid ${C.border}` }} />;
}

export default function ImpactTab({ bees, mlData, selIds }) {
  const [mode, setMode] = useState('idGroup');
  const filtered = selIds && selIds.size > 0 ? bees.filter(b => selIds.has(b.id)) : bees;
  const ranking = mlData?.clustering?.feature_ranking || mlData?.clustering?.kruskal || [];
  const keys = ranking.length ? ranking.map(r => r.feature) : Object.keys(FEAT_LABELS);

  const series = useMemo(() => {
    if (!filtered.length) return [];
    const groupOf = mode === 'cluster' ? b => clusterOf(b, mlData)
      : mode === 'idGroup' ? b => idGroupOf(b)
      : () => 'Sélection';
    const groups = new Map();
    filtered.forEach(bee => {
      const key = groupOf(bee);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(bee);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric:true }))
      .map(([label, items], i) => ({ label, items, color:SERIES_COLORS[i % SERIES_COLORS.length] }));
  }, [filtered, mode, mlData]);

  if (!filtered.length) return <div className="no-data"><span style={{ fontSize:28, opacity:.4 }}>◉</span>
      <span>Chargez un JSON.</span></div>;

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ padding:'10px 14px', fontSize:12, color:C.muted, lineHeight:1.5, borderBottom:`1px solid ${C.border}`, background:C.panel, marginBottom:12 }}>
        Boîtes à moustache des features par groupe ou par cluster.
      </div>
      <div className="btn-grp" style={{ marginBottom:14 }}>
        <button className={`btn ${mode === 'idGroup' ? 'on' : ''}`} onClick={() => setMode('idGroup')}>Groupes ID (témoins / exposés)</button>
        <button className={`btn ${mode === 'cluster' ? 'on' : ''}`} onClick={() => setMode('cluster')}>Clusters HDBSCAN</button>
        <button className={`btn ${mode === 'all' ? 'on' : ''}`} onClick={() => setMode('all')}>Agrégé</button>
      </div>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
        {series.map(s => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:C.muted }}>
            <span style={{ width:10, height:10, borderRadius:3, background:s.color, display:'inline-block' }} />
            <span>{s.label} · {s.items.length}</span>
          </div>
        ))}
      </div>

      {keys.slice(0, 36).map(k => {
        const rank = ranking.find(r => r.feature === k);
        const boxes = series.map(s => {
          const vals = valuesFor(s.items, k, mlData);
          return { label:s.label, vals, color:s.color};
        });

        return (
          <div key={k} className="metric-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:7, gap:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{FEAT_LABELS[k] || k}</span>
              <span style={{ fontSize:12, color:C.muted }}>
                ε² {Number(rank?.effect_size ?? 0).toFixed(3)}
                {' · '}Δmed {Number(rank?.median_delta ?? 0).toFixed(4)}
                {' · '}p {rank?.p_value != null && rank.p_value < 0.0001 ? '<0.0001' : Number(rank?.p_value ?? 1).toFixed(4)}
              </span>
            </div>
            <BoxplotCanvas boxes={boxes} feature={k} />
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:6 }}>
              {boxes.map(b => (
                <span key={b.label} style={{ fontSize:11, color:C.muted }} title={`(${b.vals.length} ind.)`}>
                  <span style={{ color:b.color, fontWeight:700 }}>{b.label}</span>
                  {' · '}méd {median(b.vals) != null ? median(b.vals).toPrecision(3) : '-'}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
