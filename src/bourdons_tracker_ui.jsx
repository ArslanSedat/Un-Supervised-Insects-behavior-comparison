import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// palette de couleurs
const C = {
  bg: "#ffffff",
  panel: "#f8f9fa",
  border: "#e0e4e8",
  accent: "#2563eb",
  accentDim: "#60a5fa",
  ctrl: "#f0f3f7",
  text: "#1a1d23",
  muted: "#6b7280",
  temoin: "#0ea5e9",
  expose: "#ef4444",
  green: "#10b981",
  orange: "#f59e0b",
};

// structure de UI
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif;font-size:13px}
  ::-webkit-scrollbar{width:6px;height:6px}
  ::-webkit-scrollbar-track{background:${C.bg}}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
  ::-webkit-scrollbar-thumb:hover{background:#d0d8e0}
  .app{display:grid;grid-template-rows:56px 1fr;height:100vh;overflow:hidden}
  .header{background:${C.panel};border-bottom:1px solid ${C.border};display:flex;align-items:center;padding:0 24px;gap:16px}
  .header h1{font-family:'Poppins',sans-serif;font-size:18px;font-weight:800;letter-spacing:-.3px;color:${C.text}}
  .header .sub{color:${C.muted};font-size:11px;margin-top:1px}
  .main{display:grid;grid-template-columns:280px 1fr 260px;overflow:hidden}
  .sidebar{background:${C.panel};border-right:1px solid ${C.border};overflow-y:auto;display:flex;flex-direction:column;gap:0}
  .section{border-bottom:1px solid ${C.border};padding:16px}
  .section-title{font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.text};margin-bottom:12px}
  .bee-list{display:flex;flex-direction:column;gap:4px}
  .bee-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;cursor:pointer;transition:background .15s;border:1px solid transparent;color:${C.text};user-select:none}
  .bee-item:hover{background:${C.ctrl}}
  .bee-item.selected{background:${C.ctrl};border-color:${C.accent};box-shadow:0 0 0 2px rgba(37,99,235,.1)}
  .center{display:flex;flex-direction:column;overflow:hidden}
  .tabs{display:flex;border-bottom:1px solid ${C.border};background:${C.panel}}
  .tab{padding:12px 20px;font-size:11px;cursor:pointer;border-bottom:2px solid transparent;color:${C.muted};transition:all .15s;font-family:'Poppins',sans-serif;font-weight:600;letter-spacing:.3px}
  .tab.active{color:${C.accent};border-bottom-color:${C.accent}}
  .canvas-wrap{flex:1;position:relative;overflow:hidden;background:${C.bg};min-height:550px}
  canvas{position:absolute;top:0;left:0}
  .right-panel{background:${C.panel};border-left:1px solid ${C.border};overflow-y:auto}
  .stat-row{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid ${C.border}20}
  .stat-label{color:${C.muted};font-size:10px;font-weight:500}
  .stat-val{font-size:13px;font-weight:700;font-family:'Poppins',sans-serif;color:${C.text}}
  .bar-track{height:4px;background:${C.ctrl};border-radius:2px;margin-top:4px;overflow:hidden}
  .bar-fill{height:100%;border-radius:2px;transition:width .5s}
  .no-data{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${C.muted};gap:8px}
  .badge-ok{background:rgba(16,185,129,.12);color:${C.green};border:1px solid rgba(16,185,129,.3);border-radius:4px;padding:3px 8px;font-size:10px;font-weight:600;display:inline-block}
  .badge-nok{background:rgba(239,68,68,.12);color:${C.expose};border:1px solid rgba(239,68,68,.3);border-radius:4px;padding:3px 8px;font-size:10px;font-weight:600;display:inline-block}
  .json-input-group{background:${C.ctrl};border:1px solid ${C.border};border-radius:8px;padding:12px;margin-bottom:12px}
  .json-input-label{font-size:10px;font-weight:700;color:${C.text};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .json-input-area{width:100%;min-height:80px;padding:8px;border:1px solid ${C.border};border-radius:6px;font-family:'Inter',monospace;font-size:11px;color:${C.text};background:${C.bg};resize:vertical}
  .json-input-area:focus{outline:none;border-color:${C.accent};box-shadow:0 0 0 2px rgba(37,99,235,.1)}
  .impact-metric{background:${C.bg};border:1px solid ${C.border};border-radius:8px;padding:12px;margin-bottom:10px}
  .impact-metric-title{font-size:10px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:4px}
  .dual-bar{display:flex;flex-direction:column;gap:5px}
  .dual-bar-row{display:flex;align-items:center;gap:8px;font-size:10px}
  .dual-bar-label{width:52px;text-align:right;font-weight:600;flex-shrink:0}
  .dual-bar-track{flex:1;height:10px;background:${C.ctrl};border-radius:5px;overflow:hidden}
  .dual-bar-fill{height:100%;border-radius:5px;transition:width .5s}
  .dual-bar-val{width:52px;font-size:9px;color:${C.muted};font-weight:600}
  .normal-summary-box{background:${C.ctrl};border-radius:8px;padding:12px;border:1px solid ${C.border};margin-bottom:12px}
  .normal-summary-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${C.border}20}
  .normal-summary-row:last-child{border-bottom:none}
`;

//PARSER du json
function parseJSON(json) {
  const meta = json.metadonnees || {};
  const pesticide = meta.pesticide || {};
  const cage = meta.cage_experimentale || {};
  const plantes = cage.plantes || [];
  const flowers = plantes.map(p => [p.x, p.y, p.z]);
  const ruche = cage.ruche_position_m
    ? [cage.ruche_position_m.x, cage.ruche_position_m.y, cage.ruche_position_m.z]
    : [0.2, 0.2, 0.2];
  const worldSize = cage.dimensions_m
    ? [cage.dimensions_m.longueur, cage.dimensions_m.largeur, cage.dimensions_m.hauteur]
    : [2.5, 2.5, 1.8];

  const bees = [];
  for (const [key, val] of Object.entries(json)) {
    if (!key.startsWith("bourdon_") && !key.startsWith("bee_")) continue;
    const traj = val.trajectoire || val.trajectory || [];
    if (!traj.length) continue;
    const points = traj.map(p => ({
      x: p.x, y: p.y, z: p.z,
      t: p.t ?? 0,
      v: p.vitesse_ms ?? p.speed ?? 0,
      a: p.acceleration_ms2 ?? p.acceleration ?? 0,
    }));
    const stats = val.statistiques || {};
    const clf = val.classification || null;
    bees.push({
      id: val.id || key,
      key,
      group: val.groupe === "temoin" ? "temoin"
           : val.groupe === "expose" ? "expose"
           : (val.pesticide_type === "none" ? "temoin" : "expose"),
      comportement: stats.comportement || val.comportement || "",
      notes: val.notes || "",
      poids: val.poids_mg,
      age: val.age_jours,
      stats: {
        vitesse_moy:  stats.vitesse_moyenne_ms ?? val.velocity_avg ?? 0,
        vitesse_max:  stats.vitesse_max_ms ?? 0,
        vitesse_min:  stats.vitesse_min_ms ?? 0,
        acc_moy:      stats.acceleration_moyenne_ms2 ?? 0,
        acc_max:      stats.acceleration_max_ms2 ?? 0,
        visites:      stats.visites_plantes ?? val.total_visits ?? 0,
        efficacite:   stats.efficacite_trajet ?? val.efficacite ?? val.path_efficiency ?? 0,
        duree_butinage: stats.duree_butinage_s ?? 0,
        total_flight_time: val.total_flight_time ?? points.length,
      },
      clf: clf ? {
        label:        clf.label,
        confiance:    clf.confiance,
        modele:       clf.modele,
        correct:      clf.correct,
        labelVrai:    clf.label_supervise,
        proba:        clf.probabilites || {},
        importances:  clf.feature_importances || {},
        descripteurs: clf.descripteurs || {},
        cv:           clf.cv || null,
      } : null,
      ml_prediction: val.ml_prediction ?? null,
      ml_confidence: val.ml_confidence ?? null,
      points,
    });
  }
  return { meta, pesticide, flowers, ruche, worldSize, bees };
}

//CALCUL DES DESCRIPTEURS DE TRAJECTOIRE
function computeDescriptors(points) {
  if (points.length < 2) return {};

  // Distances inter-points
  const vels = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    const dz = points[i].z - points[i-1].z;
    vels.push(Math.sqrt(dx*dx + dy*dy + dz*dz));
  }

  // Variations d'accélération (magnitude)
  const accels = [];
  for (let i = 1; i < vels.length; i++) accels.push(Math.abs(vels[i] - vels[i-1]));

  // Vitesse angulaire (changement de cap entre segments successifs)
  const dirs = vels.map((_, i) => {
    const p = points[i+1], pp = points[i];
    return [p.x-pp.x, p.y-pp.y, p.z-pp.z];
  });
  const angVels = [];
  for (let i = 1; i < dirs.length; i++) {
    const a = dirs[i], b = dirs[i-1];
    const num = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const aMag = Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
    const bMag = Math.sqrt(b[0]*b[0]+b[1]*b[1]+b[2]*b[2]);
    angVels.push(aMag*bMag > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, num/(aMag*bMag)))) : 0);
  }

  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;

  const p0 = points[0], pN = points[points.length-1];
  const distDirecte = Math.sqrt((pN.x-p0.x)**2 + (pN.y-p0.y)**2 + (pN.z-p0.z)**2);
  const distTotale = vels.reduce((s,v)=>s+v, 0);
  const linearite = distTotale > 0 ? distDirecte / distTotale : 0;

  const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
  const aire_exploration = (Math.max(...xs)-Math.min(...xs)) * (Math.max(...ys)-Math.min(...ys));

  const pointsLents = points.filter(p => p.v < 0.02).length;
  const ratio_butinage = points.length > 0 ? pointsLents / points.length : 0;

  const acc_rms = Math.sqrt(avg(accels.map(a=>a*a)));

  return {
    vitesse_moyenne:          avg(vels),
    vitesse_max:              max(vels),
    acceleration_moyenne:     avg(accels),
    vitesse_angulaire_moyenne: avg(angVels),
    erraticite:               acc_rms,
    linearite,
    aire_exploration,
    ratio_butinage,
    dist_totale: distTotale,
  };
}

// ─── MOYENNES D'IMPACT POUR UN GROUPE ────────────────────────────────────────
function groupImpactMetrics(bees) {
  if (!bees.length) return null;
  const descs = bees.map(b => computeDescriptors(b.points));
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  return {
    vitesse_moy:      avg(descs.map(d => d.vitesse_moyenne ?? 0)),
    acc_rms:          avg(descs.map(d => d.erraticite ?? 0)),
    ang_moy:          avg(descs.map(d => d.vitesse_angulaire_moyenne ?? 0)),
    linearite:        avg(descs.map(d => d.linearite ?? 0)),
    aire_exploration: avg(descs.map(d => d.aire_exploration ?? 0)),
    ratio_butinage:   avg(descs.map(d => d.ratio_butinage ?? 0)),
    dist_totale:      avg(descs.map(d => d.dist_totale ?? 0)),
    visites:          avg(bees.map(b => b.stats.visites)),
    efficacite:       avg(bees.map(b => b.stats.efficacite)),
  };
}

// heatmap
function renderHeatmap(canvas, bees, flowers, ruche, worldSize, selectedIds) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = canvas.offsetHeight;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const activeBees = selectedIds.size > 0 ? bees.filter(b => selectedIds.has(b.id)) : bees;
  
  if (activeBees.length === 0) {
    ctx.fillStyle = C.muted;
    ctx.font = "11px Inter";
    ctx.fillText("Vue de dessus (X-Y)", 8, 18);
    return;
  }
  
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;
  const density = new Float32Array(W * H);
  
  const sigma = Math.max(W, H) * 0.008;
  
  activeBees.forEach(bee => {
    bee.points.forEach(p => {
      const px = (p.x / worldSize[0]) * W;
      const py = (p.y / worldSize[1]) * H;
      
      const radius = sigma * 2.5;
      const x0 = Math.max(0, Math.floor(px - radius));
      const x1 = Math.min(W, Math.ceil(px + radius));
      const y0 = Math.max(0, Math.floor(py - radius));
      const y1 = Math.min(H, Math.ceil(py + radius));
      
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dx = x - px;
          const dy = y - py;
          const dist2 = dx * dx + dy * dy;
          const gaussian = Math.exp(-dist2 / (2 * sigma * sigma));
          density[y * W + x] += gaussian;
        }
      }
    });
  });
  
  const maxDensity = Math.max(...density);
  
  for (let i = 0; i < W * H; i++) {
    const normalized = maxDensity > 0 ? density[i] / maxDensity : 0;
    const gray = 255 - Math.floor(normalized * 255);
    
    data[i * 4 + 0] = gray;
    data[i * 4 + 1] = gray;
    data[i * 4 + 2] = gray;
    data[i * 4 + 3] = 255;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Ruche
  const ruchePx = (ruche[0] / worldSize[0]) * W;
  const ruchePy = (ruche[1] / worldSize[1]) * H;
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(ruchePx, ruchePy, 8, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🐝", ruchePx, ruchePy);
  
  // Fleurs
  flowers.forEach((f, idx) => {
    const fx = (f[0] / worldSize[0]) * W;
    const fy = (f[1] / worldSize[1]) * H;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.font = "bold 9px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`F${idx+1}`, fx + 8, fy - 8);
  });
  
  ctx.fillStyle = C.text;
  ctx.font = "11px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Vue de dessus (X-Y)", 8, 18);
  
  ctx.fillStyle = C.muted;
  ctx.font = "9px Inter";
  ctx.fillText("Y ↑", 5, 25);
  ctx.fillText("X →", W - 25, H - 5);
}

// graphique
function render3D(canvas, bees, flowers, ruche, worldSize, selectedIds, hoverBee, panX, panY, zoom, rotX, rotY) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = canvas.offsetHeight;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const baseScale = Math.min(W*0.8/(worldSize[0]||2.5), H*0.8/(worldSize[1]||2.5));
  const scale = baseScale * zoom;
  const ox = W/2 + panX;
  const oy = H/2 + panY;
  const center = [worldSize[0]/2, worldSize[1]/2, worldSize[2]/2];

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  const project = ({x, y, z}) => {
    let px = x - center[0];
    let py = y - center[1];
    let pz = z - center[2];
    const xz = px * cosY - py * sinY;
    const yz = px * sinY + py * cosY;
    const yy = yz * cosX - pz * sinX;
    const zz = yz * sinX + pz * cosX;
    const perspective = 1 / (1 - zz * 0.12);
    return {
      x: ox + xz * scale * perspective,
      y: oy + yy * scale * perspective,
      depth: zz,
    };
  };

  // Grille
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const xi = worldSize[0] * i / 10;
    const yi = worldSize[1] * i / 10;
    const p1 = project({x: xi, y: 0, z: 0});
    const p2 = project({x: xi, y: worldSize[1], z: 0});
    const q1 = project({x: 0, y: yi, z: 0});
    const q2 = project({x: worldSize[0], y: yi, z: 0});
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
  }

  // Fleurs
  flowers.forEach((f, idx) => {
    const p = project({x: f[0], y: f[1], z: f[2] ?? 0});
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(p.x, p.y, 6 * Math.max(0.6, 0.9 - p.depth * 0.05), 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 10px Inter";
    ctx.fillText(`F${idx+1}`, p.x + 8, p.y - 4);
  });

  // Ruche
  const rucheP = project({x: ruche[0], y: ruche[1], z: ruche[2] ?? 0});
  ctx.fillStyle = C.accent;
  ctx.beginPath(); ctx.arc(rucheP.x, rucheP.y, 8 * Math.max(0.6, 0.9 - rucheP.depth * 0.05), 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Inter";
  ctx.fillText("🐝", rucheP.x - 4, rucheP.y + 4);

  // Trajectoires
  const hasSel = selectedIds.size > 0;
  bees.forEach(bee => {
    const pts = bee.points;
    if (!pts.length) return;
    const projected = pts.map(p => project(p));
    const isSel = selectedIds.has(bee.id);
    const isHov = hoverBee === bee.id;
    ctx.lineWidth = isSel ? 3 : (isHov ? 2.5 : 1.5);
    ctx.strokeStyle = bee.group === "temoin" ? C.temoin : C.expose;
    ctx.globalAlpha = hasSel ? (isSel ? 1 : 0.12) : (isHov ? 0.85 : 0.5);
    ctx.setLineDash(bee.group === "expose" ? [5, 5] : []);
    ctx.beginPath();
    projected.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const alpha = hasSel ? (isSel ? 1 : 0.12) : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = bee.group === "temoin" ? C.temoin : C.expose;
    ctx.beginPath(); ctx.arc(projected[0].x, projected[0].y, 4, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(projected[projected.length - 1].x, projected[projected.length - 1].y, isSel ? 6 : 4, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ─── COMPOSANT BARRE DUALE COMPARAISON ───────────────────────────────────────
function DualBar({ label, tooltip, temoinVal, exposeVal, maxVal, unit="", decimals=3 }) {
  const tPct = maxVal > 0 ? Math.min((temoinVal??0)/maxVal*100, 100) : 0;
  const ePct = maxVal > 0 ? Math.min((exposeVal??0)/maxVal*100, 100) : 0;
  const fmt = v => (v != null) ? v.toFixed(decimals) : "—";
  return (
    <div className="impact-metric">
      <div className="impact-metric-title">
        {label}
        {tooltip && <span style={{color:C.muted,fontWeight:400,fontSize:9,marginLeft:4}}>— {tooltip}</span>}
      </div>
      <div className="dual-bar">
        <div className="dual-bar-row">
          <span className="dual-bar-label" style={{color:C.temoin}}>Témoin</span>
          <div className="dual-bar-track">
            <div className="dual-bar-fill" style={{width:`${tPct}%`,background:C.temoin}}/>
          </div>
          <span className="dual-bar-val">{fmt(temoinVal)}{unit}</span>
        </div>
        <div className="dual-bar-row">
          <span className="dual-bar-label" style={{color:C.expose}}>Exposé</span>
          <div className="dual-bar-track">
            <div className="dual-bar-fill" style={{width:`${ePct}%`,background:C.expose}}/>
          </div>
          <span className="dual-bar-val">{fmt(exposeVal)}{unit}</span>
        </div>
      </div>
    </div>
  );
}

// Badge delta : rouge si la valeur s'aggrave, vert si elle s'améliore
const DeltaBadge = ({ d, invert=false }) => {
  if (d == null) return null;
  const isWorse = invert ? d > 5 : d < -5;
  const isBetter = invert ? d < -5 : d > 5;
  const col = isWorse ? C.expose : isBetter ? C.green : C.muted;
  return <span style={{fontSize:9,fontWeight:700,color:col,marginLeft:6,padding:"1px 5px",borderRadius:3,
    background: isWorse?"rgba(239,68,68,.1)":isBetter?"rgba(16,185,129,.1)":"rgba(0,0,0,.04)"}}>
    {d>0?"+":""}{d.toFixed(1)}%
  </span>;
};

const SectionHead = ({children}) => (
  <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:12,color:C.text,
    marginBottom:10,marginTop:20,paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>
    {children}
  </div>
);

// ─── ONGLET PROFIL IMPACT ─────────────────────────────────────────────────────
function ImpactProfileTab({ bees, selectedIds }) {
  const activeBees = selectedIds.size > 0 ? bees.filter(b => selectedIds.has(b.id)) : bees;
  const temoins = activeBees.filter(b => b.group === "temoin");
  const exposes = activeBees.filter(b => b.group === "expose");

  const mT = useMemo(() => groupImpactMetrics(temoins), [temoins]);
  const mE = useMemo(() => groupImpactMetrics(exposes), [exposes]);

  if (!mT && !mE) {
    return (
      <div className="no-data" style={{padding:40,textAlign:"center"}}>
        <span style={{fontSize:32}}>📉</span>
        <span>Chargez au moins un fichier JSON pour voir le profil d'impact.</span>
      </div>
    );
  }

  const safeMax = (a, b) => Math.max(a??0, b??0) * 1.15 || 1;

  // Delta relatif exposé vs témoin (en %)
  const delta = (key) => {
    if (!mE || !mT || !mT[key]) return null;
    return ((mE[key] - mT[key]) / mT[key]) * 100;
  };

  return (
    <div style={{padding:20,maxWidth:720,margin:"0 auto"}}>

      {selectedIds.size > 0 && (
        <div style={{marginTop:24,background:C.ctrl,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
          <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:10,color:C.muted,
            marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>
            Individus inclus dans l'analyse
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{textAlign:"center",padding:10,background:C.bg,borderRadius:6,border:`1px solid ${C.temoin}40`}}>
              <div style={{fontSize:9,color:C.temoin,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Témoins</div>
              <div style={{fontFamily:"Poppins",fontWeight:800,fontSize:24,color:C.temoin}}>{temoins.length}</div>
            </div>
            <div style={{textAlign:"center",padding:10,background:C.bg,borderRadius:6,border:`1px solid ${C.expose}40`}}>
              <div style={{fontSize:9,color:C.expose,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Exposés</div>
              <div style={{fontFamily:"Poppins",fontWeight:800,fontSize:24,color:C.expose}}>{exposes.length}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{fontFamily:"Poppins",fontWeight:800,fontSize:16,color:C.text,marginBottom:4}}>
        Profil Impact
      </div>
      <div style={{color:C.muted,fontSize:11,marginBottom:20,lineHeight:1.7}}>
        Métriques comportementales calculées sur les trajectoires 3D
        Les Δ% indiquent l'écart des exposés par rapport aux témoins
      </div>

      {/* ── Cinématique de vol ── */}
      <SectionHead>Cinématique de vol</SectionHead>

      <DualBar
        label={<>Vitesse moyenne<DeltaBadge d={delta("vitesse_moy")} invert={false}/></>}
        tooltip="Vigueur et activité de vol"
        temoinVal={mT?.vitesse_moy} exposeVal={mE?.vitesse_moy}
        maxVal={safeMax(mT?.vitesse_moy, mE?.vitesse_moy)} unit=" m/s"
      />
      <DualBar
        label={<>Accélération RMS<DeltaBadge d={delta("acc_rms")} invert={true}/></>}
        tooltip="Erraticité du vol — élevée = trajectoire chaotique"
        temoinVal={mT?.acc_rms} exposeVal={mE?.acc_rms}
        maxVal={safeMax(mT?.acc_rms, mE?.acc_rms)} unit=" m/s²" decimals={4}
      />
      <DualBar
        label={<>Vitesse angulaire moyenne<DeltaBadge d={delta("ang_moy")} invert={true}/></>}
        tooltip="Fréquence des changements de cap — élevée = désorienté"
        temoinVal={mT?.ang_moy} exposeVal={mE?.ang_moy}
        maxVal={safeMax(mT?.ang_moy, mE?.ang_moy)} unit=" rad"
      />

      {/* ── Structure de trajectoire ── */}
      <SectionHead>Structure de trajectoire</SectionHead>

      <DualBar
        label={<>Linéarité<DeltaBadge d={delta("linearite")} invert={false}/></>}
        tooltip="à refaire : linéarité pca ou tortuosité ?"
        temoinVal={mT?.linearite} exposeVal={mE?.linearite} maxVal={1}
      />
      <DualBar
        label={<>Distance totale parcourue<DeltaBadge d={delta("dist_totale")} invert={true}/></>}
        tooltip="Longueur cumulée de la trajectoire 3D"
        temoinVal={mT?.dist_totale} exposeVal={mE?.dist_totale}
        maxVal={safeMax(mT?.dist_totale, mE?.dist_totale)} unit=" m"
      />
      <DualBar
        label={<>Zone d'exploration (XY)<DeltaBadge d={delta("aire_exploration")} invert={true}/></>}
        tooltip="Surface du bounding box — dispersion spatiale de la trajectoire"
        temoinVal={mT?.aire_exploration} exposeVal={mE?.aire_exploration}
        maxVal={safeMax(mT?.aire_exploration, mE?.aire_exploration)} unit=" m²"
      />

      {/* ── Comportement de butinage ── */}
      <SectionHead>Comportement de butinage</SectionHead>

      <DualBar
        label={<>Ratio temps d'immobilité / vol<DeltaBadge d={delta("ratio_butinage")} invert={false}/></>}
        tooltip="Part du temps avec vitesse < 0.02 m/s (pose sur fleur probable)"
        temoinVal={mT?.ratio_butinage} exposeVal={mE?.ratio_butinage} maxVal={1}
      />
      <DualBar
        label={<>Visites de plantes (moy.)<DeltaBadge d={delta("visites")} invert={false}/></>}
        tooltip="Nombre moyen de plantes visitées par individu"
        temoinVal={mT?.visites} exposeVal={mE?.visites}
        maxVal={safeMax(mT?.visites, mE?.visites)} unit="" decimals={1}
      />

      {/* ── Efficacité globale ── */}
      <SectionHead>Efficacité globale</SectionHead>

      <DualBar
        label={<>Score d'efficacité<DeltaBadge d={delta("efficacite")} invert={false}/></>}
        tooltip="Score composite : linéarité + stabilité vitesse + visites + retour ruche "
        temoinVal={mT?.efficacite} exposeVal={mE?.efficacite} maxVal={1}
      />

    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function BourdonTracker() {
  const [bees, setBees] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [ruche, setRuche] = useState([0.2, 0.2, 0.2]);
  const [worldSize, setWorldSize] = useState([2.5, 2.5, 1.8]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hoverBee, setHoverBee] = useState(null);
  const [tab, setTab] = useState("map");
  const canvasRef = useRef(null);
  const heatmapRef = useRef(null);

  const initialRotX = 0;
  const initialRotY = 0;
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotX, setRotX] = useState(initialRotX);
  const [rotY, setRotY] = useState(initialRotY);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragPanStart, setDragPanStart] = useState({ x: 0, y: 0 });
  const [dragRotStart, setDragRotStart] = useState({ x: 0, y: 0, rotX: initialRotX, rotY: initialRotY });
  const [dragMode, setDragMode] = useState("rotate");

  const [jsonTemoinText, setJsonTemoinText] = useState("");
  const [jsonExposeText, setJsonExposeText] = useState("");
  const [rawJsonTemoin, setRawJsonTemoin] = useState(null);
  const [rawJsonExpose, setRawJsonExpose] = useState(null);
  const [backendProcessed, setBackendProcessed] = useState(false);

  const applyCompareResults = useCallback((beesList, compareResults) => {
    if (!compareResults?.bees_details) return beesList;
    const details = compareResults.bees_details;
    return beesList.map(bee => {
      if (bee.group !== "expose") return bee;
      const info = details[bee.key] || details[bee.id];
      if (!info) return bee;
      const clf = {
        label: info.prediction === 1 ? "normal" : "affecte",
        confiance: info.proba_normal ?? 0,
        modele: "random_forest",
        proba: {
          normal: info.proba_normal ?? 0,
          affected: info.proba_affected ?? 0,
        },
      };
      return {
        ...bee,
        clf,
        stats: {
          ...bee.stats,
          efficacite: info.efficacite ?? bee.stats.efficacite,
          efficacite_ai: info.efficacite_ai ?? bee.stats.efficacite_ai,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!rawJsonTemoin || !rawJsonExpose || backendProcessed) return;

    const uploadJson = async (json, group) => {
      try {
        const formData = new FormData();
        formData.append("file", new Blob([JSON.stringify(json)], { type: "application/json" }), "data.json");
        formData.append("group", group);
        const res = await fetch("http://localhost:5000/upload", { method: "POST", body: formData });
        return res.ok ? await res.json() : json;
      } catch (err) {
        console.warn("Backend Flask non disponible.", err);
        return json;
      }
    };

    const prepareData = async () => {
      setBees([]);
      setFlowers([]);
      setRuche([0.2, 0.2, 0.2]);
      setWorldSize([2.5, 2.5, 1.8]);
      setSelectedIds(new Set());

      const enrichedTemoin = await uploadJson(rawJsonTemoin, "temoin");
      const enrichedExpose = await uploadJson(rawJsonExpose, "expose");
      const temoinData = parseJSON(enrichedTemoin);
      const exposeData = parseJSON(enrichedExpose);
      const temoinBees = temoinData.bees.map(b => ({ ...b, group: "temoin" }));
      const exposeBees = exposeData.bees.map(b => ({ ...b, group: "expose" }));

      setBees([...temoinBees, ...exposeBees]);
      setFlowers(temoinData.flowers.length ? temoinData.flowers : exposeData.flowers);
      setRuche(temoinData.ruche.length ? temoinData.ruche : exposeData.ruche);
      setWorldSize(temoinData.worldSize.length ? temoinData.worldSize : exposeData.worldSize);
      setJsonTemoinText(JSON.stringify(enrichedTemoin, null, 2));
      setJsonExposeText(JSON.stringify(enrichedExpose, null, 2));
      setRawJsonTemoin(enrichedTemoin);
      setRawJsonExpose(enrichedExpose);
      setBackendProcessed(true);
    };

    prepareData();
  }, [rawJsonTemoin, rawJsonExpose, backendProcessed]);

  useEffect(() => {
    if (!rawJsonTemoin || !rawJsonExpose) return;
    const runCompare = async () => {
      try {
        const res = await fetch("http://localhost:5000/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temoin: rawJsonTemoin, expose: rawJsonExpose }),
        });
        if (!res.ok) return;
        const compareResults = await res.json();
        setBees(prev => applyCompareResults(prev, compareResults));
      } catch (err) {
        console.warn("Échec du comparatif /compare", err);
      }
    };
    runCompare();
  }, [rawJsonTemoin, rawJsonExpose, applyCompareResults]);

  // Onglet Analyse : fiche du bourdon (Attention c'est le premier sélectionné)
  const selectedBee = useMemo(() => {
    const firstId = [...selectedIds][0];
    return bees.find(b => b.id === firstId) || null;
  }, [bees, selectedIds]);

  // Sélection : clic simple = exclusif, Ctrl+clic = toggle
  const handleBeeClick = useCallback((bee, e) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) {
        if (next.has(bee.id)) next.delete(bee.id); else next.add(bee.id);
      } else {
        if (next.size === 1 && next.has(bee.id)) next.clear();
        else { next.clear(); next.add(bee.id); }
      }
      return next;
    });
  }, []);

  const processJson = useCallback((json, isTemoin) => {
    const text = JSON.stringify(json, null, 2);
    if (isTemoin) {
      setJsonTemoinText(text);
      setRawJsonTemoin(json);
    } else {
      setJsonExposeText(text);
      setRawJsonExpose(json);
    }
    setBackendProcessed(false);
  }, []);

  const handleFileSelect = (file, isTemoin) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { processJson(JSON.parse(e.target.result), isTemoin); }
      catch (err) { alert("Erreur: " + err.message); }
    };
    reader.readAsText(file);
  };

  const handleJsonPaste = (text, isTemoin) => {
    try { processJson(JSON.parse(text), isTemoin); }
    catch (err) { alert("JSON invalide: " + err.message); }
  };

  useEffect(() => {
    if (canvasRef.current) {
      render3D(canvasRef.current, bees, flowers, ruche, worldSize, selectedIds, hoverBee, panX, panY, zoom, rotX, rotY);
    }
    if (heatmapRef.current) {
      renderHeatmap(heatmapRef.current, bees, flowers, ruche, worldSize, selectedIds);
    }
  }, [bees, flowers, ruche, worldSize, selectedIds, hoverBee, panX, panY, zoom, rotX, rotY]);

  // données pour le panneau résumé
  const temoinBees = bees.filter(b => b.group === "temoin");
  const exposeBees = bees.filter(b => b.group === "expose");
  // "Normal" = ML prediction (0 = temoin, 1 = expose)
  const isNormal = b => b.ml_prediction === 0 ? true : b.ml_prediction === 1 ? false : b.stats.efficacite >= 0.5;
  const temoinNormal = temoinBees.filter(isNormal).length;
  const exposeNormal = exposeBees.filter(isNormal).length;

  const handleMouseDown = e => {
    setIsDragging(true);
    setDragStart({x:e.clientX,y:e.clientY});
    setDragPanStart({x:panX,y:panY});
    setDragRotStart({x:e.clientX,y:e.clientY,rotX,rotY});
    setDragMode(e.shiftKey ? "pan" : "rotate");
  };
  const handleMouseMove = e => {
    if (!isDragging) return;
    if (dragMode === "pan") {
      setPanX(dragPanStart.x + e.clientX - dragStart.x);
      setPanY(dragPanStart.y + e.clientY - dragStart.y);
    } else {
      const dx = e.clientX - dragRotStart.x;
      const dy = e.clientY - dragRotStart.y;
      setRotY(dragRotStart.rotY + dx * 0.006);
      setRotX(Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, dragRotStart.rotX - dy * 0.006)));
    }
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleWheel = e => {
    e.preventDefault();
    setZoom(prev => Math.min(3, Math.max(0.5, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <h1>🐝 BumbleBee</h1>
          <span className="sub">Comparaison des trajectoires de bourdons</span>
        </div>
        <div className="main">

          {/* ── SIDEBAR GAUCHE ────────────────────────────────────────────── */}
          <div className="sidebar">
            <div className="section">
              <div className="section-title">Données</div>
              <div className="json-input-group">
                <div className="json-input-label">Groupe Témoin (JSON)</div>
                <textarea className="json-input-area" placeholder="Collez le JSON témoin ici..."
                  value={jsonTemoinText}
                  onChange={e => setJsonTemoinText(e.target.value)}
                  onBlur={() => jsonTemoinText && handleJsonPaste(jsonTemoinText, true)}
                />
                <input type="file" accept=".json"
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], true)}
                  style={{marginTop:8,cursor:"pointer",fontSize:11}}
                />
              </div>
              <div className="json-input-group">
                <div className="json-input-label">Groupe Exposé (JSON)</div>
                <textarea className="json-input-area" placeholder="Collez le JSON exposé ici..."
                  value={jsonExposeText}
                  onChange={e => setJsonExposeText(e.target.value)}
                  onBlur={() => jsonExposeText && handleJsonPaste(jsonExposeText, false)}
                />
                <input type="file" accept=".json"
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], false)}
                  style={{marginTop:8,cursor:"pointer",fontSize:11}}
                />
              </div>
            </div>

            {/* Liste des bourdons */}
            <div className="section" style={{flex:1,overflowY:"auto"}}>
              <div className="section-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>👥 Individus ({bees.length})</span>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                  <span onClick={() => setSelectedIds(new Set(bees.map(b=>b.id)))}
                    style={{cursor:"pointer",fontSize:"9px",color:C.text,background:C.ctrl,padding:"2px 6px",borderRadius:"4px"}}>
                    Tous
                  </span>
                  <span onClick={() => setSelectedIds(new Set(temoinBees.map(b=>b.id)))}
                    style={{cursor:"pointer",fontSize:"9px",color:C.temoin,background:C.ctrl,padding:"2px 6px",borderRadius:"4px"}}>
                    T ({temoinBees.length})
                  </span>
                  <span onClick={() => setSelectedIds(new Set(exposeBees.map(b=>b.id)))}
                    style={{cursor:"pointer",fontSize:"9px",color:C.expose,background:C.ctrl,padding:"2px 6px",borderRadius:"4px"}}>
                    E ({exposeBees.length})
                  </span>
                </div>
              </div>
              {bees.length > 0 && (
                <div style={{fontSize:9,color:C.muted,marginBottom:8,fontStyle:"italic"}}>
                  Clic = sélection · Ctrl+Clic = multi-sélection
                </div>
              )}
              <div className="bee-list">
                {bees.map(bee => (
                  <div key={bee.id}
                    className={`bee-item ${selectedIds.has(bee.id) ? "selected" : ""}`}
                    onClick={e => handleBeeClick(bee, e)}
                    onMouseEnter={() => setHoverBee(bee.id)}
                    onMouseLeave={() => setHoverBee(null)}
                  >
                    <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,
                      background:bee.group==="temoin"?C.temoin:C.expose}}/>
                    <div style={{flex:1,overflow:"hidden"}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>{bee.id}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                        🌸 {bee.stats.visites} · ⚡ {(bee.stats.efficacite*100).toFixed(0)}%
                      </div>
                    </div>
                    {bee.clf && (
                      <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,fontWeight:700,
                        background:bee.clf.label==="normal"?"rgba(16,185,129,.15)":"rgba(239,68,68,.12)",
                        color:bee.clf.label==="normal"?C.green:C.expose}}>
                        {bee.clf.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CENTRE ─────────────────────────────────────────────────────── */}
          <div className="center">
            <div className="tabs">
              <div className={`tab ${tab==="map"?"active":""}`} onClick={()=>setTab("map")}>Visualisation</div>
              <div className={`tab ${tab==="analysis"?"active":""}`} onClick={()=>setTab("analysis")}>Analyse</div>
              <div className={`tab ${tab==="impact"?"active":""}`} onClick={()=>setTab("impact")}>Profil Impact</div>
            </div>

            {/* Visualisation */}
            {tab === "map" && (
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div className="canvas-wrap" style={{flex:2,minHeight:0}}>
                  <canvas ref={canvasRef}
                    style={{width:"100%",height:"100%",cursor:isDragging?"grabbing":"grab"}}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    onDoubleClick={() => {
                      setPanX(0);
                      setPanY(0);
                      setZoom(1);
                      setRotX(initialRotX);
                      setRotY(initialRotY);
                    }}
                  />
                  <div style={{position:"absolute",bottom:12,left:12,background:"rgba(0,0,0,0.7)",
                    color:"#fff",padding:"6px 12px",borderRadius:6,fontSize:11,
                    fontFamily:"monospace",pointerEvents:"none",zIndex:10}}>
                    Glisser en cliquant = rotation 3D | Glisser la molette = déplacement | Scroll = zoom | Double-clic = reset
                  </div>
                </div>
                <div style={{flex:1,minHeight:0,borderTop:`1px solid ${C.border}`,position:"relative",background:C.bg}}>
                  <canvas ref={heatmapRef}
                    style={{width:"100%",height:"100%"}}
                  />
                </div>
              </div>
            )}

            {/* Analyse individuelle */}
            {tab === "analysis" && (
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                {selectedBee ? (
                  <div style={{display:"flex",flexDirection:"column",gap:16}}>

                    <div>
                      <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>
                        Fiche : {selectedBee.id}
                        {selectedIds.size > 1 &&
                          <span style={{fontSize:10,color:C.muted,fontWeight:400,marginLeft:8}}>
                            (+{selectedIds.size-1} autre{selectedIds.size>2?"s":""}  — voir Profil Impact)
                          </span>}
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Groupe</span>
                        <span style={{fontWeight:700,color:selectedBee.group==="temoin"?C.temoin:C.expose}}>
                          {selectedBee.group.toUpperCase()}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Plantes visitées</span>
                        <span className="stat-val">{selectedBee.stats.visites}</span>
                      </div>
                    </div>

                    <div>
                      <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>Cinématique</div>
                      <div className="stat-row">
                        <span className="stat-label">Vitesse moy.</span>
                        <span className="stat-val">{selectedBee.stats.vitesse_moy.toFixed(3)} m/s</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Vitesse max</span>
                        <span className="stat-val">{selectedBee.stats.vitesse_max.toFixed(3)} m/s</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Accel. moy.</span>
                        <span className="stat-val">{selectedBee.stats.acc_moy.toFixed(3)} m/s²</span>
                      </div>
                    </div>

                    <div>
                      <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>Efficacité de trajectoire</div>
                      <div style={{background:C.ctrl,borderRadius:6,padding:12,border:`1px solid ${C.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:11,color:C.muted}}>Score global</span>
                          <span style={{fontWeight:700,fontFamily:"Poppins",fontSize:13,
                            color:selectedBee.stats.efficacite>0.6?C.green:selectedBee.stats.efficacite>0.35?C.orange:C.expose}}>
                            {(selectedBee.stats.efficacite*100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{
                            width:`${selectedBee.stats.efficacite*100}%`,
                            background:selectedBee.stats.efficacite>0.6?C.green:selectedBee.stats.efficacite>0.35?C.orange:C.expose
                          }}/>
                        </div>
                        <div style={{fontSize:10,color:C.muted,marginTop:8,lineHeight:1.6}}>
                          Linéarité · Stabilité vitesse · Fleurs visitées · Retour ruche
                        </div>
                      </div>
                    </div>

                    {selectedBee.clf && (
                      <div>
                        <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>🤖 Classification IA</div>
                        <div style={{background:C.ctrl,borderRadius:6,padding:12,border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Prédiction</div>
                          <div style={{fontSize:14,fontWeight:700,fontFamily:"Poppins",
                            color:selectedBee.clf.label==="normal"?C.green:C.expose}}>
                            {selectedBee.clf.label.toUpperCase()}
                          </div>
                          <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden",marginTop:8}}>
                            <div style={{height:"100%",borderRadius:3,
                              width:`${selectedBee.clf.confiance*100}%`,
                              background:selectedBee.clf.confiance>0.8?C.green:selectedBee.clf.confiance>0.6?C.orange:C.expose,
                              transition:"width .6s"}}/>
                          </div>
                          <div style={{fontSize:10,color:C.muted,marginTop:6}}>
                            Confiance : {(selectedBee.clf.confiance*100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedBee.ml_prediction !== null && selectedBee.ml_prediction !== undefined && (
                      <div>
                        <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>🤖 Prédiction Random Forest</div>
                        <div style={{background:C.ctrl,borderRadius:6,padding:12,border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Prédiction</div>
                          <div style={{fontSize:14,fontWeight:700,fontFamily:"Poppins",
                            color:selectedBee.ml_prediction===0?C.temoin:C.expose}}>
                            {selectedBee.ml_prediction===0?"TÉMOIN (Normal)":"EXPOSÉ (Anormal)"}
                          </div>
                          <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden",marginTop:8,display:"flex"}}>
                            <div style={{height:"100%",borderRadius:"3px 0 0 3px",
                              width:`${(selectedBee.ml_prediction===0?1-selectedBee.ml_confidence:selectedBee.ml_confidence)*100}%`,
                              background:C.temoin,
                              transition:"width .6s"}}/>
                            <div style={{height:"100%",borderRadius:"0 3px 3px 0",
                              width:`${(selectedBee.ml_prediction===0?selectedBee.ml_confidence:1-selectedBee.ml_confidence)*100}%`,
                              background:C.expose,
                              transition:"width .6s"}}/>
                          </div>
                          <div style={{fontSize:10,color:C.muted,marginTop:6,display:"flex",justifyContent:"space-between"}}>
                            <span>Confiance {selectedBee.ml_prediction===0?"témoin":"exposé"}</span>
                            <span style={{fontWeight:700}}>{(selectedBee.ml_confidence*100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="no-data">
                    <span style={{fontSize:24}}>📊</span>
                    <span style={{color:C.muted}}>Sélectionnez un bourdon pour voir les détails</span>
                  </div>
                )}
              </div>
            )}

            {/* Profil Impact */}
            {tab === "impact" && (
              <div style={{flex:1,overflowY:"auto"}}>
                <ImpactProfileTab bees={bees} selectedIds={selectedIds} />
              </div>
            )}
          </div>

          {/* ── PANNEAU DROIT ──────────────────────────────────────────────── */}
          <div className="right-panel" style={{padding:16}}>
            <div className="section-title">Résumé</div>

            {bees.length > 0 ? (
              <>
                <div style={{marginBottom:16}}>
                  <div className="stat-row">
                    <span className="stat-label">Total bourdons</span>
                    <span className="stat-val">{bees.length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Témoins</span>
                    <span style={{fontWeight:700,color:C.temoin}}>{temoinBees.length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Exposés</span>
                    <span style={{fontWeight:700,color:C.expose}}>{exposeBees.length}</span>
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="stat-row">
                      <span className="stat-label">Sélectionnés</span>
                      <span style={{fontWeight:700,color:C.accent}}>{selectedIds.size}</span>
                    </div>
                  )}
                </div>

                {/* ── Comportement normal par groupe ── */}
                <div style={{fontFamily:"Poppins",fontWeight:700,fontSize:10,color:C.muted,
                  textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
                  Comportement normal
                </div>
                <div className="normal-summary-box">
                  <div className="normal-summary-row">
                    <div>
                      <div style={{fontSize:9,color:C.temoin,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>
                        Témoins normaux
                      </div>
                      <div style={{fontSize:9,color:C.muted,marginTop:2}}>{temoinNormal} / {temoinBees.length}</div>
                    </div>
                    <span className="badge-ok">{temoinNormal}</span>
                  </div>
                  <div className="normal-summary-row">
                    <div>
                      <div style={{fontSize:9,color:C.expose,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>
                        Exposés normaux
                      </div>
                      <div style={{fontSize:9,color:C.muted,marginTop:2}}>{exposeNormal} / {exposeBees.length}</div>
                    </div>
                    <span className="badge-ok">{exposeNormal}</span>
                  </div>

                  {/* Barres de proportion */}
                  <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:2}}>
                        Témoins — {temoinBees.length>0?((temoinNormal/temoinBees.length)*100).toFixed(0):0}% normaux
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{
                          width:`${temoinBees.length>0?(temoinNormal/temoinBees.length)*100:0}%`,
                          background:C.temoin}}/>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:2}}>
                        Exposés — {exposeBees.length>0?((exposeNormal/exposeBees.length)*100).toFixed(0):0}% normaux
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{
                          width:`${exposeBees.length>0?(exposeNormal/exposeBees.length)*100:0}%`,
                          background:C.expose}}/>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{marginTop:4}}>
                  <div className="stat-row">
                    <span className="stat-label">Fleurs en cage</span>
                    <span className="stat-val">{flowers.length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Points/trajectoire</span>
                    <span className="stat-val">{bees[0]?.points.length ?? 0}</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{color:C.muted,fontSize:11,lineHeight:1.7}}>
                Chargez les fichiers JSON pour commencer l'analyse.
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
