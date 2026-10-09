import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../config/theme';
import { clusterColor, colorForGroup, idGroupOfId } from '../utils/groups';
import { HIVE_NEAR_RADIUS, FLOWER_RADIUS, trajectoryTimeline } from '../utils/data';

function dist3(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0), (a?.z || 0) - (b?.z || 0));
}

function distHive(p, ctx) {
  return Math.hypot((p?.x || 0) - ctx.ruche[0], (p?.y || 0) - ctx.ruche[1]);
}

function distNearestFlower(p, ctx) {
  if (!ctx.flowers.length) return 0;
  return Math.min(...ctx.flowers.map(([fx, fy]) => Math.hypot((p?.x || 0) - fx, (p?.y || 0) - fy)));
}

function stepLength(points, i) {
  if (i <= 0) return 0;
  return dist3(points[i], points[i - 1]);
}

function acceleration(points, i) {
  const p = points[i];
  if (Number.isFinite(p?.acc)) return Number(p.acc);
  if (i <= 0) return 0;
  return Math.abs((points[i]?.v || 0) - (points[i - 1]?.v || 0));
}

function jerk(points, i) {
  if (i <= 1) return 0;
  return Math.abs(acceleration(points, i) - acceleration(points, i - 1));
}

function wrapPi(angle) {
  return ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

function turningAngle(points, i) {
  if (i <= 1) return 0;
  const a = points[i - 2], b = points[i - 1], c = points[i];
  const v1x = (b.x || 0) - (a.x || 0), v1y = (b.y || 0) - (a.y || 0);
  const v2x = (c.x || 0) - (b.x || 0), v2y = (c.y || 0) - (b.y || 0);
  const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
  if (n1 <= 1e-10 || n2 <= 1e-10) return 0;
  const h1 = Math.atan2(v1y, v1x);
  const h2 = Math.atan2(v2y, v2x);
  return Math.abs(wrapPi(h2 - h1));
}

function localSinuosity(points, i, windowSize = 12) {
  const start = Math.max(0, i - windowSize);
  let path = 0;
  for (let j = start + 1; j <= i; j++) path += dist3(points[j], points[j - 1]);
  const direct = dist3(points[i], points[start]);
  return direct > 1e-9 ? path / direct : 1;
}

function msdFromStart(points, i) {
  if (!points.length) return 0;
  const d = dist3(points[i], points[0]);
  return d * d;
}

// Cumulative sum in a single pass (O(n)): `cumulative()` used to resum from
// scratch at every point (O(n) per point, so O(n²) over the whole
// trajectory), which froze the UI on long trajectories.
function cumulativeSeries(n, valueAtIndex) {
  const out = new Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += valueAtIndex(i);
    out[i] = sum;
  }
  return out;
}

const METRICS = {
  speed: { label:'Vitesse instantanée', unit:'m/s', get:(points, i) => points[i]?.v || 0 },
  acceleration: { label:'Accélération', unit:'m/s²', get:(points, i) => acceleration(points, i) },
  jerk: { label:'Jerk local', unit:'m/s³', get:(points, i) => jerk(points, i) },
  altitude: { label:'Altitude', unit:'m', get:(points, i) => points[i]?.z || 0 },
  elevationStep: { label:'Variation altitude |Δz|', unit:'m', get:(points, i) => i > 0 ? Math.abs((points[i]?.z || 0) - (points[i - 1]?.z || 0)) : 0 },
  hiveDist: { label:'Distance ruche', unit:'m', get:(points, i, ctx) => distHive(points[i], ctx) },
  flowerDist: { label:'Distance fleur la plus proche', unit:'m', get:(points, i, ctx) => distNearestFlower(points[i], ctx) },
  stepLength: { label:'Longueur de pas', unit:'m', get:(points, i) => stepLength(points, i) },
  msd: { label:'MSD depuis départ', unit:'m²', get:(points, i) => msdFromStart(points, i) },
  turningAngle: { label:'Angle de virage', unit:'rad', get:(points, i) => turningAngle(points, i) },
  angularVelocity: { label:'Vitesse angulaire', unit:'rad/pas', get:(points, i) => turningAngle(points, i) },
  localSinuosity: { label:'Sinuosité locale', unit:'ratio', get:(points, i) => localSinuosity(points, i) },
  immobile01: { label:'Immobile', unit:'', get:(points, i, ctx, states) => states[i]?.state === 'immobile' ? 1 : 0 },
  nearHive01: { label:'Proche ruche', unit:'', get:(points, i, ctx) => distHive(points[i], ctx) < HIVE_NEAR_RADIUS ? 1 : 0 },
  nearFlower01: { label:'Proche fleur', unit:'', get:(points, i, ctx) => distNearestFlower(points[i], ctx) < FLOWER_RADIUS ? 1 : 0 },

  // Les métriques "cumulé" ci-dessous fournissent `series` (tout le tableau
  // calculé en une passe, O(n)) plutôt que `get` point par point, pour éviter
  // de resommer depuis le départ à chaque point.
  cumDist: { label:'Distance cumulée', unit:'m', series:(points) => cumulativeSeries(points.length, j => stepLength(points, j)) },
  cumImmobile: { label:'Temps cumulé immobile', unit:'points', series:(points, ctx, states) => cumulativeSeries(points.length, j => states[j]?.state === 'immobile' ? 1 : 0) },
  cumNearHive: { label:'Temps cumulé proche ruche', unit:'points', series:(points, ctx) => cumulativeSeries(points.length, j => distHive(points[j], ctx) < HIVE_NEAR_RADIUS ? 1 : 0) },
  cumNearFlower: { label:'Temps cumulé proche fleurs', unit:'points', series:(points, ctx) => cumulativeSeries(points.length, j => distNearestFlower(points[j], ctx) < FLOWER_RADIUS ? 1 : 0) },
  cumMovingRatio: { label:'Ratio mouvement cumulé', unit:'ratio', series:(points, ctx, states) => {
    const cumImmobile = cumulativeSeries(points.length, j => states[j]?.state === 'immobile' ? 1 : 0);
    return cumImmobile.map((nbImmobile, i) => { const n = i + 1; return (n - nbImmobile) / n; });
  }},
};

function median(vals) {
  const clean = vals.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function seriesForBee(bee, metricKey, ctx) {
  const points = bee.points || [];
  const states = trajectoryTimeline(bee, ctx.flowers, ctx.ruche);
  const metric = METRICS[metricKey] || METRICS.speed;
  if (metric.series) return metric.series(points, ctx, states);
  return points.map((_, i) => metric.get(points, i, ctx, states));
}

function makeGroups(bees, mlData, mode) {
  const groups = new Map();
  bees.forEach(bee => {
    let key = 'Sélection';
    if (mode === 'cluster') {
      const cluster = mlData?.per_bee?.[bee.id]?.cluster ?? -1;
      key = cluster === -1 ? 'Outliers' : `Cluster ${cluster}`;
    } else if (mode === 'id_group') {
      key = idGroupOfId(bee.id);
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bee);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric:true }));
}

function aggregate(bees, metricKey, ctx) {
  const series = bees.map(bee => seriesForBee(bee, metricKey, ctx));
  const len = Math.max(0, ...series.map(s => s.length));
  const med = [], q1 = [], q3 = [];
  for (let i = 0; i < len; i++) {
    const vals = series.map(s => s[i]).filter(v => v != null);
    med.push(median(vals));
    q1.push(quantile(vals, 0.25));
    q3.push(quantile(vals, 0.75));
  }
  return { med, q1, q3 };
}

function quantile(arr, q) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

function colorForKey(key, mode) {
  if (mode === 'cluster') {
    if (key === 'Outliers') return C.muted;
    const m = String(key).match(/(-?\d+)/);
    return clusterColor(m ? Number(m[1]) : -1);
  }
  if (mode === 'id_group') return colorForGroup(key);
  return C.accent;
}

function DynamicsCanvas({ grouped, metricKey, mode }) {
  const ref = useRef(null);
  const metric = METRICS[metricKey] || METRICS.speed;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const pad = { l:64, r:24, t:28, b:46 };
    const all = grouped.flatMap(g => [...g.values.med, ...g.values.q1, ...g.values.q3].filter(v => v != null));
    const yMin0 = Math.min(...all, 0);
    const yMax0 = Math.max(...all, 1e-9);
    const margin = (yMax0 - yMin0 || 1) * 0.08;
    const yMin = Math.min(0, yMin0 - margin);
    const yMax = yMax0 + margin;
    const maxLen = Math.max(1, ...grouped.map(g => g.values.med.length));
    const x = i => pad.l + (i / Math.max(1, maxLen - 1)) * (W - pad.l - pad.r);
    const y = v => H - pad.b - ((v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();

    ctx.fillStyle = C.muted;
    ctx.font = "12px 'Times New Roman'";
    ctx.textAlign = 'center';
    ctx.fillText('Temps / index trajectoire', (pad.l + W - pad.r) / 2, H - 14);
    ctx.save();
    ctx.translate(16, (pad.t + H - pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${metric.label}${metric.unit ? ` (${metric.unit})` : ''}`, 0, 0);
    ctx.restore();

    for (let t = 0; t <= 4; t++) {
      const yy = pad.t + t * (H - pad.t - pad.b) / 4;
      const val = yMax - t * (yMax - yMin) / 4;
      ctx.strokeStyle = `${C.border}55`;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.font = "12px 'Times New Roman'"; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(yMax < 2 ? 3 : 2), pad.l - 8, yy);
    }

    grouped.forEach(group => {
      const color = colorForKey(group.key, mode);

      // bande IQR (q25-q75)
      const band = [];
      for (let i = 0; i < group.values.med.length; i++) {
        if (group.values.med[i] == null) continue;
        band.push(i);
      }
      if (band.length > 1) {
        ctx.beginPath();
        band.forEach((i, k) => { const v = group.values.q3[i]; if (v != null) k ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); });
        for (let k = band.length - 1; k >= 0; k--) {
          const i = band[k], v = group.values.q1[i];
          if (v != null) ctx.lineTo(x(i), y(v));
        }
        ctx.closePath();
        ctx.fillStyle = `${color}26`;
        ctx.fill();
      }

      // médiane
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      group.values.med.forEach((v, i) => {
        if (v == null) return;
        if (i === 0) ctx.moveTo(x(i), y(v));
        else ctx.lineTo(x(i), y(v));
      });
      ctx.stroke();
    });
  }, [grouped, metricKey, mode, metric.label, metric.unit]);

  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

export default function DynamicsTab({ bees, flowers = [], ruche = [0.1, 0.1, 0], selIds, mlData }) {
  const [mode, setMode] = useState('cluster');
  const [metricKey, setMetricKey] = useState('speed');

  const subset = useMemo(() => {
    if (selIds?.size) return bees.filter(bee => selIds.has(bee.id));
    return bees;
  }, [bees, selIds]);

  const grouped = useMemo(() => {
    const ctx = { flowers, ruche };
    return makeGroups(subset, mlData, mode).map(([key, groupBees]) => ({
      key,
      n: groupBees.length,
      values: aggregate(groupBees, metricKey, ctx),
    }));
  }, [subset, mlData, mode, metricKey, flowers, ruche]);

  if (!bees.length) return <div className="no-data"><span style={{ fontSize:28, opacity:.4 }}>◉</span>
      <span>Chargez un JSON.</span></div>;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', fontSize:12, color:C.muted, lineHeight:1.5, borderBottom:`1px solid ${C.border}`, background:C.panel, marginBottom:0 }}>
        Évolution temporelle d'une métrique (vitesse, distance ruche, etc.).
      </div>
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', background:C.panel }}>
        <span style={{ fontSize:12, color:C.muted }}>Afficher :</span>
        <button className={`btn ${mode === 'cluster' ? 'on' : ''}`} onClick={() => setMode('cluster')}>par clusters</button>
        <button className={`btn ${mode === 'id_group' ? 'on' : ''}`} onClick={() => setMode('id_group')}>par groupes ID</button>
        <button className={`btn ${mode === 'all' ? 'on' : ''}`} onClick={() => setMode('all')}>agrégé</button>
        <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>Courbe :</span>
        <select value={metricKey} onChange={e => setMetricKey(e.target.value)} style={{ background:C.bg, color:C.text, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 8px', fontSize:12, maxWidth:260 }}>
          {Object.entries(METRICS).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
        </select>
      </div>

      <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 260px', overflow:'hidden' }}>
        <div style={{ position:'relative', minHeight:0 }}>
          <DynamicsCanvas grouped={grouped} metricKey={metricKey} mode={mode} />
        </div>
        <aside style={{ borderLeft:`1px solid ${C.border}`, padding:12, overflowY:'auto', background:C.panel }}>
          <div className="sec-title">Séries</div>
          {grouped.map(group => (
            <div key={group.key} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8, padding:'7px 8px', border:`1px solid ${C.border}`, borderRadius:8, background:C.bg }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:colorForKey(group.key, mode), flexShrink:0 }} />
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{group.key}</div>
                <div style={{ fontSize:12, color:C.muted }}>{group.n} bourdons</div>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
