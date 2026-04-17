import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg:       "#f9fafb",
  panel:    "#ffffff",
  border:   "#e5e9ef",
  accent:   "#2563eb",
  text:     "#111827",
  muted:    "#6b7280",
  temoin:   "#0ea5e9",
  expose:   "#ef4444",
  green:    "#10b981",
  orange:   "#f59e0b",
  violet:   "#8b5cf6",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;font-size:13px}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
  .app{display:grid;grid-template-rows:52px 1fr;height:100vh;overflow:hidden}
  .header{background:${C.panel};border-bottom:1px solid ${C.border};display:flex;align-items:center;padding:0 20px;gap:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  .header h1{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;letter-spacing:-.4px;color:${C.text}}
  .header .sub{color:${C.muted};font-size:11px}
  .main{display:grid;grid-template-columns:270px 1fr 250px;overflow:hidden}
  .sidebar{background:${C.panel};border-right:1px solid ${C.border};overflow-y:auto;display:flex;flex-direction:column}
  .section{border-bottom:1px solid ${C.border};padding:14px}
  .section-title{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};margin-bottom:10px}
  .bee-list{display:flex;flex-direction:column;gap:3px}
  .bee-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .12s;border:1px solid transparent;user-select:none}
  .bee-item:hover{background:${C.bg}}
  .bee-item.selected{background:${C.bg};border-color:${C.accent};box-shadow:0 0 0 2px rgba(37,99,235,.08)}
  .center{display:flex;flex-direction:column;overflow:hidden}
  .tabs{display:flex;border-bottom:1px solid ${C.border};background:${C.panel}}
  .tab{padding:11px 18px;font-size:11px;cursor:pointer;border-bottom:2px solid transparent;color:${C.muted};transition:all .15s;font-family:'Syne',sans-serif;font-weight:700;letter-spacing:.2px}
  .tab.active{color:${C.accent};border-bottom-color:${C.accent}}
  .canvas-wrap{flex:1;position:relative;overflow:hidden;background:${C.bg};min-height:300px}
  canvas{position:absolute;top:0;left:0}
  .right-panel{background:${C.panel};border-left:1px solid ${C.border};overflow-y:auto;padding:14px}
  .stat-row{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid ${C.border}20}
  .stat-label{color:${C.muted};font-size:10px;font-weight:500}
  .stat-val{font-size:12px;font-weight:700;font-family:'DM Mono',monospace;color:${C.text}}
  .bar-track{height:4px;background:${C.bg};border-radius:2px;margin-top:4px;overflow:hidden;border:1px solid ${C.border}}
  .bar-fill{height:100%;border-radius:2px;transition:width .5s}
  .no-data{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${C.muted};gap:8px;text-align:center;padding:32px}
  .json-input-group{background:${C.bg};border:1px solid ${C.border};border-radius:8px;padding:10px;margin-bottom:10px}
  .json-input-label{font-size:10px;font-weight:700;color:${C.text};text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;display:flex;align-items:center;gap:6px}
  .json-input-area{width:100%;min-height:60px;padding:7px;border:1px solid ${C.border};border-radius:5px;font-family:'DM Mono',monospace;font-size:10px;color:${C.text};background:${C.panel};resize:vertical}
  .json-input-area:focus{outline:none;border-color:${C.accent}}
  .impact-metric{background:${C.bg};border:1px solid ${C.border};border-radius:8px;padding:11px;margin-bottom:8px}
  .impact-metric-title{font-size:10px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:4px}
  .dual-bar-row{display:flex;align-items:center;gap:8px;font-size:10px;margin-bottom:4px}
  .dual-bar-label{width:50px;text-align:right;font-weight:600;flex-shrink:0;font-family:'DM Mono',monospace;font-size:9px}
  .dual-bar-track{flex:1;height:9px;background:${C.panel};border-radius:5px;overflow:hidden;border:1px solid ${C.border}}
  .dual-bar-fill{height:100%;border-radius:5px;transition:width .5s}
  .dual-bar-val{width:56px;font-size:9px;color:${C.muted};font-weight:600;font-family:'DM Mono',monospace}
  .badge{border-radius:4px;padding:2px 7px;font-size:9px;font-weight:700;display:inline-block}
  .sig-badge{font-size:8px;padding:1px 5px;border-radius:3px;font-weight:700;font-family:'DM Mono',monospace}
`;

// ─── PARSER JSON (métriques backend) ─────────────────────────────────────────
function parseJSON(json) {
  const meta   = json.metadonnees || {};
  const cage   = meta.cage_experimentale || {};
  const plantes = cage.plantes || [];
  const flowers = plantes.map(p => [p.x, p.y, p.z ?? 0, p.id]);
  const ruche   = cage.ruche_position_m
    ? [cage.ruche_position_m.x, cage.ruche_position_m.y, cage.ruche_position_m.z ?? 0]
    : [0.1, 0.1, 0];
  const worldSize = cage.dimensions_m
    ? [cage.dimensions_m.longueur, cage.dimensions_m.largeur, cage.dimensions_m.hauteur]
    : [2.5, 2.5, 1.8];

  const bees = [];
  for (const [key, val] of Object.entries(json)) {
    if (!key.startsWith("bourdon_")) continue;
    const traj = val.trajectoire || [];
    const m    = val.metriques   || {};
    const stats= val.statistiques || {};

    const points = traj.map(p => ({ x:p.x, y:p.y, z:p.z, t:p.t??0, v:p.vitesse_ms??0 }));

    bees.push({
      id:    val.id  || key,
      key,
      group: val.groupe === "temoin" ? "temoin" : "expose",
      metriques: m,
      stats: {
        vitesse_moy:    m.vitesse_moy    ?? stats.vitesse_moyenne_ms  ?? 0,
        vitesse_max:    m.vitesse_max    ?? stats.vitesse_max_ms      ?? 0,
        acc_moy:        m.acceleration_moy ?? stats.acceleration_moyenne_ms2 ?? 0,
        visites:        m.total_visites_plantes ?? stats.visites_plantes ?? 0,
        linearite:      m.linearite_pca  ?? stats.linearite_pca       ?? 0,
        tortuosite:     m.tortuosite     ?? 0,
        aire:           m.aire_exploration ?? 0,
        stabilite:      m.stabilite_vitesse ?? 0,
        dist_totale:    m.dist_totale    ?? 0,
        retour_ruche:   m.retour_ruche_score ?? 0,
      },
      ml_prediction: val.ml_prediction ?? null,
      ml_confidence: val.ml_confidence ?? null,
      points,
    });
  }
  return { meta, flowers, ruche, worldSize, bees };
}

// ─── RENDU 3D ─────────────────────────────────────────────────────────────────
function render3D(canvas, bees, flowers, rucheTemoin, rucheExpose, worldSize, selectedIds, hoverBee, panX, panY, zoom, rotX, rotY) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width  = canvas.offsetWidth;
  const H = canvas.height = canvas.offsetHeight;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const baseScale = Math.min(W * 0.75 / (worldSize[0] || 2.5), H * 0.75 / (worldSize[1] || 2.5));
  const scale = baseScale * zoom;
  const ox = W / 2 + panX;
  const oy = H / 2 + panY;
  const center = [worldSize[0]/2, worldSize[1]/2, worldSize[2]/2];
  const cX = Math.cos(rotX), sX = Math.sin(rotX);
  const cY = Math.cos(rotY), sY = Math.sin(rotY);

  const project = ({x, y, z}) => {
    let px = x - center[0], py = y - center[1], pz = z - center[2];
    const xz = px*cY - py*sY;
    const yz = px*sY + py*cY;
    const yy = yz*cX - pz*sX;
    const zz = yz*sX + pz*cX;
    const persp = 1 / (1 - zz * 0.1);
    return { x: ox + xz*scale*persp, y: oy + yy*scale*persp, depth: zz };
  };

  // Grille
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const xi = worldSize[0]*i/10, yi = worldSize[1]*i/10;
    const p1 = project({x:xi,y:0,z:0}), p2 = project({x:xi,y:worldSize[1],z:0});
    const q1 = project({x:0,y:yi,z:0}), q2 = project({x:worldSize[0],y:yi,z:0});
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(q1.x,q1.y); ctx.lineTo(q2.x,q2.y); ctx.stroke();
  }

  // Fleurs (labellisées T/E selon le groupe du JSON chargé)
  const flowerColors = { temoin: "#fbbf24", expose: "#f97316" };
  flowers.forEach(([fx, fy, fz, fid, group]) => {
    const p = project({x:fx, y:fy, z:fz});
    const col = group === "expose" ? flowerColors.expose : flowerColors.temoin;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px DM Sans"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`F${fid+1}`, p.x, p.y);
    ctx.fillStyle = col;
    ctx.font = "bold 9px DM Sans"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(group === "expose" ? "(E)" : "(T)", p.x+9, p.y-2);
  });

  // Ruche témoin
  const drawRuche = (pos, col, label) => {
    if (!pos) return;
    const p = project({x:pos[0], y:pos[1], z:pos[2]});
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px DM Sans"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🏠", p.x, p.y);
    ctx.fillStyle = col;
    ctx.font = "bold 9px DM Sans"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(label, p.x+11, p.y-2);
  };
  drawRuche(rucheTemoin, C.temoin, "Ruche T");
  drawRuche(rucheExpose, C.expose, "Ruche E");

  // Trajectoires
  const hasSel = selectedIds.size > 0;
  bees.forEach(bee => {
    if (!bee.points.length) return;
    const proj = bee.points.map(p => project(p));
    const isSel = selectedIds.has(bee.id);
    const isHov = hoverBee === bee.id;
    ctx.lineWidth = isSel ? 2.5 : isHov ? 2 : 1.2;
    ctx.strokeStyle = bee.group === "temoin" ? C.temoin : C.expose;
    ctx.globalAlpha = hasSel ? (isSel ? 0.9 : 0.08) : (isHov ? 0.8 : 0.45);
    ctx.setLineDash(bee.group === "expose" ? [4,4] : []);
    ctx.beginPath();
    proj.forEach((p,i) => i === 0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = hasSel ? (isSel ? 1 : 0.1) : 1;
    ctx.fillStyle = bee.group === "temoin" ? C.temoin : C.expose;
    ctx.beginPath(); ctx.arc(proj[0].x,proj[0].y,3,0,2*Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(proj[proj.length-1].x,proj[proj.length-1].y,isSel?5:3,0,2*Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────
function renderHeatmap(canvas, bees, flowers, rucheTemoin, rucheExpose, worldSize, selectedIds) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width  = canvas.offsetWidth;
  const H = canvas.height = canvas.offsetHeight;
  ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0,0,W,H);

  const active = selectedIds.size > 0 ? bees.filter(b=>selectedIds.has(b.id)) : bees;
  if (!active.length) return;

  const density = new Float32Array(W*H);
  const sigma = Math.max(W,H)*0.018;

  active.forEach(bee => bee.points.forEach(p => {
    const px = (p.x/worldSize[0])*W, py = (p.y/worldSize[1])*H;
    const r = sigma*2.5;
    const x0=Math.max(0,Math.floor(px-r)), x1=Math.min(W,Math.ceil(px+r));
    const y0=Math.max(0,Math.floor(py-r)), y1=Math.min(H,Math.ceil(py+r));
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
      const d = ((x-px)**2+(y-py)**2)/(2*sigma*sigma);
      density[y*W+x] += Math.exp(-d);
    }
  }));

  const maxD = Math.max(...density)||1;
  const img  = ctx.createImageData(W,H);
  for (let i=0;i<W*H;i++) {
    const n = Math.sqrt(density[i]/maxD);
    let r,g,b;
    if (n<0.25)      { const t=n/0.25;    r=0;           g=Math.floor(80+t*120); b=255; }
    else if (n<0.5)  { const t=(n-.25)/.25; r=0;         g=255;                  b=Math.floor(255*(1-t)); }
    else if (n<0.75) { const t=(n-.5)/.25;  r=Math.floor(t*255); g=255;         b=0; }
    else             { const t=(n-.75)/.25; r=255; g=Math.floor(255*(1-t*.6));  b=0; }
    img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=200;
  }
  ctx.putImageData(img,0,0);

  const drawFlower = ([fx,fy,fz,fid,group]) => {
    const px=(fx/worldSize[0])*W, py=(fy/worldSize[1])*H;
    ctx.fillStyle= group==="expose"?"#f97316":"#fbbf24";
    ctx.beginPath(); ctx.arc(px,py,6,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle="#000"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#000"; ctx.font="bold 8px DM Sans"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(`F${fid+1}`,px,py);
  };
  flowers.forEach(drawFlower);

  const drawRucheHM = (pos, col, label) => {
    if (!pos) return;
    const px=(pos[0]/worldSize[0])*W, py=(pos[1]/worldSize[1])*H;
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(px,py,9,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#fff"; ctx.font="bold 10px DM Sans"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🏠",px,py);
    ctx.fillStyle=col; ctx.font="bold 9px DM Sans"; ctx.textAlign="left"; ctx.textBaseline="bottom";
    ctx.fillText(label,px+11,py-2);
  };
  drawRucheHM(rucheTemoin, C.temoin, "Ruche T");
  drawRucheHM(rucheExpose, C.expose, "Ruche E");
}

// ─── COMPOSANTS UI ────────────────────────────────────────────────────────────
function DualBar({ label, temoinVal, exposeVal, maxVal, unit="", decimals=3, tooltip, sig }) {
  const tPct = maxVal>0 ? Math.min((temoinVal??0)/maxVal*100,100) : 0;
  const ePct = maxVal>0 ? Math.min((exposeVal??0)/maxVal*100,100) : 0;
  const fmt  = v => v!=null ? v.toFixed(decimals) : "—";
  const sigCol = sig!=null ? (sig<0.05 ? C.expose : sig<0.1 ? C.orange : C.muted) : C.muted;
  return (
    <div className="impact-metric">
      <div className="impact-metric-title">
        {label}
        {sig!=null && (
          <span className="sig-badge" style={{background:sig<0.05?"rgba(239,68,68,.1)":sig<0.1?"rgba(245,158,11,.1)":"rgba(0,0,0,.05)",color:sigCol,marginLeft:6}}>
            p≈{sig}
          </span>
        )}
        {tooltip && <span style={{color:C.muted,fontWeight:400,fontSize:9,marginLeft:4}}>— {tooltip}</span>}
      </div>
      <div className="dual-bar-row">
        <span className="dual-bar-label" style={{color:C.temoin}}>Témoin</span>
        <div className="dual-bar-track"><div className="dual-bar-fill" style={{width:`${tPct}%`,background:C.temoin}}/></div>
        <span className="dual-bar-val">{fmt(temoinVal)}{unit}</span>
      </div>
      <div className="dual-bar-row">
        <span className="dual-bar-label" style={{color:C.expose}}>Exposé</span>
        <div className="dual-bar-track"><div className="dual-bar-fill" style={{width:`${ePct}%`,background:C.expose}}/></div>
        <span className="dual-bar-val">{fmt(exposeVal)}{unit}</span>
      </div>
    </div>
  );
}

const DeltaBadge = ({ d, invert=false }) => {
  if (d==null) return null;
  const isWorse  = invert ? d>5  : d<-5;
  const isBetter = invert ? d<-5 : d>5;
  const col = isWorse ? C.expose : isBetter ? C.green : C.muted;
  return <span style={{fontSize:9,fontWeight:700,color:col,marginLeft:5,padding:"1px 5px",borderRadius:3,
    background:isWorse?"rgba(239,68,68,.1)":isBetter?"rgba(16,185,129,.1)":"rgba(0,0,0,.04)"}}>
    {d>0?"+":""}{d.toFixed(1)}%
  </span>;
};

const SHead = ({children}) => (
  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:11,color:C.text,margin:"18px 0 10px",paddingBottom:5,borderBottom:`1px solid ${C.border}`}}>
    {children}
  </div>
);

// ─── ONGLET PROFIL IMPACT ─────────────────────────────────────────────────────
function ImpactTab({ bees, selectedIds, compareData }) {
  const active   = selectedIds.size>0 ? bees.filter(b=>selectedIds.has(b.id)) : bees;
  const temoins  = active.filter(b=>b.group==="temoin");
  const exposes  = active.filter(b=>b.group==="expose");

  const avg = (arr, key) => {
    const vals = arr.map(b=>b.stats[key]).filter(v=>v!=null);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  };
  const safeMax = (a,b) => Math.max(a??0,b??0)*1.15||1;

  const mT = { vitesse_moy:avg(temoins,"vitesse_moy"), vitesse_max:avg(temoins,"vitesse_max"),
    acc_moy:avg(temoins,"acc_moy"), linearite:avg(temoins,"linearite"), tortuosite:avg(temoins,"tortuosite"),
    aire:avg(temoins,"aire"), stabilite:avg(temoins,"stabilite"), dist_totale:avg(temoins,"dist_totale"),
    visites:avg(temoins,"visites"), retour_ruche:avg(temoins,"retour_ruche") };
  const mE = { vitesse_moy:avg(exposes,"vitesse_moy"), vitesse_max:avg(exposes,"vitesse_max"),
    acc_moy:avg(exposes,"acc_moy"), linearite:avg(exposes,"linearite"), tortuosite:avg(exposes,"tortuosite"),
    aire:avg(exposes,"aire"), stabilite:avg(exposes,"stabilite"), dist_totale:avg(exposes,"dist_totale"),
    visites:avg(exposes,"visites"), retour_ruche:avg(exposes,"retour_ruche") };

  const delta = (tVal, eVal) => (tVal && eVal!=null && tVal>0) ? ((eVal-tVal)/tVal*100) : null;
  const sig   = (key) => compareData?.significance?.[key];
  const hasBees = temoins.length>0 || exposes.length>0;

  if (!hasBees) return (
    <div className="no-data"><span style={{fontSize:32}}>📉</span><span>Chargez les deux fichiers JSON pour voir les métriques.</span></div>
  );

  return (
    <div style={{padding:20,maxWidth:700,margin:"0 auto"}}>
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:16,marginBottom:4}}>Profil Impact</div>
      <div style={{color:C.muted,fontSize:11,marginBottom:20,lineHeight:1.7}}>
        Métriques calculées côté serveur · p-values : test Mann-Whitney approx.
      </div>

      <SHead>Cinématique de vol</SHead>
      <DualBar label={<>Vitesse moyenne<DeltaBadge d={delta(mT.vitesse_moy,mE.vitesse_moy)}/></>}
        tooltip="Activité de vol" sig={sig("vitesse_moy")}
        temoinVal={mT.vitesse_moy} exposeVal={mE.vitesse_moy}
        maxVal={safeMax(mT.vitesse_moy,mE.vitesse_moy)} unit=" m/s"/>
      <DualBar label={<>Stabilité vitesse<DeltaBadge d={delta(mT.stabilite,mE.stabilite)}/></>}
        tooltip="1 = vitesse très stable" sig={sig("stabilite_vitesse")}
        temoinVal={mT.stabilite} exposeVal={mE.stabilite} maxVal={1}/>
      <DualBar label={<>Accélération moyenne<DeltaBadge d={delta(mT.acc_moy,mE.acc_moy)} invert/></>}
        tooltip="Erraticité instantanée" sig={sig("acceleration_moy")}
        temoinVal={mT.acc_moy} exposeVal={mE.acc_moy}
        maxVal={safeMax(mT.acc_moy,mE.acc_moy)} unit=" m/s²" decimals={4}/>

      <SHead>Structure de trajectoire</SHead>
      <DualBar label={<>Linéarité PCA<DeltaBadge d={delta(mT.linearite,mE.linearite)}/></>}
        tooltip="Proche de 1 = vol rectiligne" sig={sig("linearite_pca")}
        temoinVal={mT.linearite} exposeVal={mE.linearite} maxVal={1}/>
      <DualBar label={<>Tortuosité<DeltaBadge d={delta(mT.tortuosite,mE.tortuosite)}/></>}
        tooltip="dist. directe / dist. totale · proche 1 = ligne droite" sig={sig("tortuosite")}
        temoinVal={mT.tortuosite} exposeVal={mE.tortuosite} maxVal={1}/>
      <DualBar label={<>Distance totale<DeltaBadge d={delta(mT.dist_totale,mE.dist_totale)} invert/></>}
        sig={sig("dist_totale")}
        temoinVal={mT.dist_totale} exposeVal={mE.dist_totale}
        maxVal={safeMax(mT.dist_totale,mE.dist_totale)} unit=" m" decimals={1}/>
      <DualBar label={<>Aire exploration<DeltaBadge d={delta(mT.aire,mE.aire)} invert/></>}
        tooltip="Enveloppe convexe XY" sig={sig("aire_exploration")}
        temoinVal={mT.aire} exposeVal={mE.aire}
        maxVal={safeMax(mT.aire,mE.aire)} unit=" m²"/>

      <SHead>Comportement de butinage</SHead>
      <DualBar label={<>Visites plantes<DeltaBadge d={delta(mT.visites,mE.visites)}/></>}
        sig={sig("total_visites_plantes")}
        temoinVal={mT.visites} exposeVal={mE.visites}
        maxVal={safeMax(mT.visites,mE.visites)} decimals={1}/>
      <DualBar label={<>Retour ruche<DeltaBadge d={delta(mT.retour_ruche,mE.retour_ruche)}/></>}
        tooltip="Score 0→1 basé sur distance finale à la ruche" sig={sig("retour_ruche_score")}
        temoinVal={mT.retour_ruche} exposeVal={mE.retour_ruche} maxVal={1}/>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function BourdonTracker() {
  const [bees,       setBees]       = useState([]);
  const [flowersT,   setFlowersT]   = useState([]);  // fleurs du fichier témoin
  const [flowersE,   setFlowersE]   = useState([]);  // fleurs du fichier exposé
  const [rucheT,     setRucheT]     = useState(null);
  const [rucheE,     setRucheE]     = useState(null);
  const [worldSize,  setWorldSize]  = useState([2.5,2.5,1.8]);
  const [selectedIds,setSelectedIds]= useState(new Set());
  const [hoverBee,   setHoverBee]   = useState(null);
  const [tab,        setTab]        = useState("map");
  const [compareData,setCompareData]= useState(null);

  const canvasRef   = useRef(null);
  const heatmapRef  = useRef(null);

  const [panX,setPanX]=useState(0), [panY,setPanY]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [rotX,setRotX]=useState(0), [rotY,setRotY]=useState(0);
  const [isDragging,setIsDragging]=useState(false);
  const [dragState,setDragState]=useState(null);

  const [jsonTText,setJsonTText]=useState("");
  const [jsonEText,setJsonEText]=useState("");
  const [rawT,setRawT]=useState(null);
  const [rawE,setRawE]=useState(null);
  const [processed,setProcessed]=useState(false);
  const [loading,setLoading]=useState(false);

  // Toutes les fleurs annotées avec leur groupe
  const allFlowers = useMemo(() => [
    ...flowersT.map(f=>[...f,"temoin"]),
    ...flowersE.map(f=>[...f,"expose"]),
  ], [flowersT, flowersE]);

  // ── Upload vers backend ──────────────────────────────────────────────────
  const uploadJson = useCallback(async (json, group) => {
    try {
      const fd = new FormData();
      fd.append("file", new Blob([JSON.stringify(json)],{type:"application/json"}), "data.json");
      fd.append("group", group);
      const res = await fetch("http://localhost:5000/upload", { method:"POST", body:fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("Backend indisponible, données brutes utilisées:", err);
      return json;
    }
  }, []);

  useEffect(() => {
    if (!rawT || !rawE || processed) return;
    setLoading(true);
    (async () => {
      setBees([]); setSelectedIds(new Set());
      const [enrichedT, enrichedE] = await Promise.all([
        uploadJson(rawT, "temoin"),
        uploadJson(rawE, "expose"),
      ]);
      const dataT = parseJSON(enrichedT);
      const dataE = parseJSON(enrichedE);

      const tBees = dataT.bees.map(b=>({...b,group:"temoin"}));
      const eBees = dataE.bees.map(b=>({...b,group:"expose"}));

      setBees([...tBees,...eBees]);
      setFlowersT(dataT.flowers);
      setFlowersE(dataE.flowers);
      setRucheT(dataT.ruche);
      setRucheE(dataE.ruche);
      setWorldSize(dataT.worldSize);
      setJsonTText(JSON.stringify(enrichedT,null,2));
      setJsonEText(JSON.stringify(enrichedE,null,2));
      setProcessed(true);
      setLoading(false);
    })();
  }, [rawT, rawE, processed, uploadJson]);

  // ── Rendu canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (canvasRef.current)
      render3D(canvasRef.current, bees, allFlowers, rucheT, rucheE, worldSize, selectedIds, hoverBee, panX, panY, zoom, rotX, rotY);
    if (heatmapRef.current)
      renderHeatmap(heatmapRef.current, bees, allFlowers, rucheT, rucheE, worldSize, selectedIds);
  }, [bees, allFlowers, rucheT, rucheE, worldSize, selectedIds, hoverBee, panX, panY, zoom, rotX, rotY]);

  // ── Sélection ────────────────────────────────────────────────────────────
  const handleBeeClick = useCallback((bee,e) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (e.ctrlKey||e.metaKey) { if(n.has(bee.id))n.delete(bee.id); else n.add(bee.id); }
      else { if(n.size===1&&n.has(bee.id)) n.clear(); else{n.clear();n.add(bee.id);} }
      return n;
    });
  },[]);

  const processJson = useCallback((json, isTemoin) => {
    const text = JSON.stringify(json,null,2);
    if (isTemoin) { setJsonTText(text); setRawT(json); }
    else          { setJsonEText(text); setRawE(json); }
    setProcessed(false);
  },[]);

  const handleFile = (file, isTemoin) => {
    const r = new FileReader();
    r.onload = e => { try { processJson(JSON.parse(e.target.result),isTemoin); } catch(err){ alert("Erreur: "+err.message); } };
    r.readAsText(file);
  };

  // ── Interactions canvas ───────────────────────────────────────────────────
  const handleMouseDown = e => {
    setIsDragging(true);
    setDragState({ x:e.clientX, y:e.clientY, panX, panY, rotX, rotY, mode:e.shiftKey?"pan":"rotate" });
  };
  const handleMouseMove = e => {
    if (!isDragging||!dragState) return;
    if (dragState.mode==="pan") {
      setPanX(dragState.panX + e.clientX - dragState.x);
      setPanY(dragState.panY + e.clientY - dragState.y);
    } else {
      setRotY(dragState.rotY + (e.clientX-dragState.x)*0.006);
      setRotX(Math.max(-Math.PI/2+.1,Math.min(Math.PI/2-.1, dragState.rotX-(e.clientY-dragState.y)*0.006)));
    }
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleWheel   = e => { e.preventDefault(); setZoom(p=>Math.min(3,Math.max(.4,p*(e.deltaY>0?.9:1.1)))); };

  // ── Données résumé ────────────────────────────────────────────────────────
  const temoinBees = bees.filter(b=>b.group==="temoin");
  const exposeBees = bees.filter(b=>b.group==="expose");
  const isNormal   = b => b.ml_prediction===0 || b.ml_prediction===null ? false : b.ml_prediction===1;
  const tNorm = temoinBees.filter(isNormal).length;
  const eNorm = exposeBees.filter(isNormal).length;

  const selectedBee = useMemo(() => {
    const id = [...selectedIds][0];
    return bees.find(b=>b.id===id)||null;
  },[bees,selectedIds]);

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <h1>BumbleBee</h1>
          {loading && <span style={{marginLeft:"auto",fontSize:11,color:C.accent,fontWeight:600,
            fontFamily:"DM Mono",animation:"pulse 1s infinite"}}>⟳ Calcul en cours…</span>}
        </div>
        <div className="main">

          {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
          <div className="sidebar">
            <div className="section">
              <div className="section-title">Données</div>

              {/* Témoin */}
              <div className="json-input-group">
                <div className="json-input-label">
                  <span style={{width:8,height:8,borderRadius:"50%",background:C.temoin,display:"inline-block"}}/>
                  Groupe Témoin (JSON)
                </div>
                <input type="file" accept=".json"
                  onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0],true)}
                  style={{cursor:"pointer",fontSize:11,width:"100%"}}/>
              </div>

              {/* Exposé */}
              <div className="json-input-group">
                <div className="json-input-label">
                  <span style={{width:8,height:8,borderRadius:"50%",background:C.expose,display:"inline-block"}}/>
                  Groupe Exposé (JSON)
                </div>
                <input type="file" accept=".json"
                  onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0],false)}
                  style={{cursor:"pointer",fontSize:11,width:"100%"}}/>
              </div>
            </div>

            {/* Liste bourdons */}
            <div className="section" style={{flex:1,overflowY:"auto"}}>
              <div className="section-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>Individus ({bees.length})</span>
                <div style={{display:"flex",gap:4}}>
                  {[["Tous",()=>bees.map(b=>b.id)],[`T(${temoinBees.length})`,()=>temoinBees.map(b=>b.id)],[`E(${exposeBees.length})`,()=>exposeBees.map(b=>b.id)]].map(([lbl,fn],i)=>(
                    <span key={i} onClick={()=>setSelectedIds(new Set(fn()))}
                      style={{cursor:"pointer",fontSize:9,color:i===1?C.temoin:i===2?C.expose:C.text,
                        background:C.bg,padding:"2px 5px",borderRadius:4,border:`1px solid ${C.border}`}}>
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
              {bees.length>0 && <div style={{fontSize:9,color:C.muted,marginBottom:6,fontStyle:"italic"}}>Clic = sélection · Ctrl+Clic = multi</div>}
              <div className="bee-list">
                {bees.map(bee=>(
                  <div key={bee.id} className={`bee-item ${selectedIds.has(bee.id)?"selected":""}`}
                    onClick={e=>handleBeeClick(bee,e)}
                    onMouseEnter={()=>setHoverBee(bee.id)} onMouseLeave={()=>setHoverBee(null)}>
                    <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                      background:bee.group==="temoin"?C.temoin:C.expose}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600}}>{bee.id}</div>
                    </div>
                    {bee.ml_confidence!=null && (
                      <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,fontWeight:700,
                        background:bee.ml_prediction===0?"rgba(16,185,129,.12)":"rgba(239,68,68,.10)",
                        color:bee.ml_prediction===0?C.green:C.expose}}>
                        {(bee.ml_confidence*100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CENTRE ──────────────────────────────────────────────────── */}
          <div className="center">
            <div className="tabs">
              {[["map","Visualisation"],["analysis","Analyse"],["impact","Impact"]].map(([k,lbl])=>(
                <div key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{lbl}</div>
              ))}
            </div>

            {/* Visualisation 3D + heatmap */}
            {tab==="map" && (
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div className="canvas-wrap" style={{flex:2,minHeight:0}}>
                  <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:isDragging?"grabbing":"grab"}}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
                    onDoubleClick={()=>{setPanX(0);setPanY(0);setZoom(1);setRotX(0);setRotY(0);}}/>
                  <div style={{position:"absolute",bottom:10,left:10,background:"rgba(0,0,0,.65)",
                    color:"#fff",padding:"5px 10px",borderRadius:5,fontSize:10,fontFamily:"DM Mono",pointerEvents:"none"}}>
                    Glisser = rotation · Shift+Glisser = déplacement · Scroll = zoom · Double-clic = reset
                    {" · "}<span style={{color:C.temoin}}>━</span> Témoin
                    {" · "}<span style={{color:C.expose}}>╌</span> Exposé
                    {" · "}<span style={{color:"#fbbf24"}}>●</span> Plantes T
                    {" · "}<span style={{color:"#f97316"}}>●</span> Plantes E
                  </div>
                </div>
                <div style={{flex:1,minHeight:0,borderTop:`1px solid ${C.border}`,position:"relative"}}>
                  <canvas ref={heatmapRef} style={{width:"100%",height:"100%"}}/>
                </div>
              </div>
            )}

            {/* Analyse individuelle */}
            {tab==="analysis" && (
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                {selectedBee ? (
                  <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:520}}>
                    <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14}}>
                      {selectedBee.id}
                      <span style={{marginLeft:8,fontSize:11,fontWeight:600,
                        color:selectedBee.group==="temoin"?C.temoin:C.expose}}>
                        {selectedBee.group.toUpperCase()}
                      </span>
                    </div>

                    {/* Cinématique */}
                    <div>
                      <div style={{fontFamily:"Syne",fontWeight:700,fontSize:11,color:C.muted,
                        textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Cinématique</div>
                      {[
                        ["Vitesse moy.",     selectedBee.stats.vitesse_moy?.toFixed(4)+" m/s"],
                        ["Vitesse max",      selectedBee.stats.vitesse_max?.toFixed(4)+" m/s"],
                        ["Accel. moy.",      selectedBee.stats.acc_moy?.toFixed(4)+" m/s²"],
                        ["Stabilité vitesse",selectedBee.stats.stabilite?.toFixed(3)],
                        ["Accél. RMS",       selectedBee.metriques?.acceleration_rms?.toFixed(4)+" m/s²"],
                        ["Angle moy. dir.",  selectedBee.metriques?.angle_moy?.toFixed(4)+" rad"],
                        ["Virages brusques", selectedBee.metriques?.nb_virages_brusques],
                      ].map(([l,v])=>(
                        <div key={l} className="stat-row">
                          <span className="stat-label">{l}</span>
                          <span className="stat-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Trajectoire */}
                    <div>
                      <div style={{fontFamily:"Syne",fontWeight:700,fontSize:11,color:C.muted,
                        textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Trajectoire</div>
                      {[
                        ["Linéarité PCA",  selectedBee.stats.linearite?.toFixed(4)],
                        ["Tortuosité",     selectedBee.stats.tortuosite?.toFixed(4)],
                        ["Distance totale",selectedBee.stats.dist_totale?.toFixed(2)+" m"],
                        ["Aire exploration",selectedBee.stats.aire?.toFixed(4)+" m²"],
                        ["Altitude moy.",  selectedBee.metriques?.altitude_moy?.toFixed(3)+" m"],
                        ["Altitude std.",  selectedBee.metriques?.altitude_std?.toFixed(3)+" m"],
                      ].map(([l,v])=>(
                        <div key={l} className="stat-row">
                          <span className="stat-label">{l}</span>
                          <span className="stat-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Butinage */}
                    <div>
                      <div style={{fontFamily:"Syne",fontWeight:700,fontSize:11,color:C.muted,
                        textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Butinage</div>
                      {[
                        ["Visites plantes",  selectedBee.stats.visites],
                        ["Visites ruche",    selectedBee.metriques?.nb_visites_ruche],
                        ["Ratio butinage",   selectedBee.metriques?.ratio_butinage?.toFixed(4)],
                        ["Ratio t° plantes", selectedBee.metriques?.ratio_temps_plantes?.toFixed(4)],
                        ["Retour ruche (score)", selectedBee.stats.retour_ruche?.toFixed(3)],
                        ["Dist. ruche fin",  selectedBee.metriques?.dist_ruche_fin?.toFixed(3)+" m"],
                        ["Δt visite→ruche",  selectedBee.metriques?.delta_t_visite_retour?.toFixed(0)+" s"],
                      ].map(([l,v])=>(
                        <div key={l} className="stat-row">
                          <span className="stat-label">{l}</span>
                          <span className="stat-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Visites par plante */}
                    {selectedBee.metriques?.visites_par_plante?.length>0 && (
                      <div>
                        <div style={{fontFamily:"Syne",fontWeight:700,fontSize:11,color:C.muted,
                          textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Visites par plante</div>
                        {selectedBee.metriques.visites_par_plante.map(v=>(
                          <div key={v.plante_id} className="stat-row">
                            <span className="stat-label">Plante {v.plante_id+1}</span>
                            <span className="stat-val">{v.nb_visites}</span>
                          </div>
                        ))}
                      </div>
                    )}


                  </div>
                ) : (
                  <div className="no-data">
                    <span style={{fontSize:24}}>📊</span>
                    <span style={{color:C.muted}}>Sélectionnez un bourdon dans la liste</span>
                  </div>
                )}
              </div>
            )}

            {tab==="impact" && (
              <div style={{flex:1,overflowY:"auto"}}>
                <ImpactTab bees={bees} selectedIds={selectedIds} compareData={compareData}/>
              </div>
            )}
          </div>

          {/* ── PANNEAU DROIT ──────────────────────────────────────────── */}
          <div className="right-panel">
            <div className="section-title">Résumé</div>
            {bees.length>0 ? (
              <>
                {[["Total bourdons",bees.length,C.text],["Témoins",temoinBees.length,C.temoin],["Exposés",exposeBees.length,C.expose],
                  ...(selectedIds.size>0?[["Sélectionnés",selectedIds.size,C.accent]]:[])
                ].map(([l,v,col])=>(
                  <div key={l} className="stat-row">
                    <span className="stat-label">{l}</span>
                    <span style={{fontWeight:700,color:col,fontFamily:"DM Mono",fontSize:12}}>{v}</span>
                  </div>
                ))}

                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:10,color:C.muted,
                  textTransform:"uppercase",letterSpacing:1,margin:"14px 0 8px"}}>
                  Comportement normal
                </div>
                {[[`Témoins`,tNorm,temoinBees.length,C.temoin],[`Exposés`,eNorm,exposeBees.length,C.expose]].map(([lbl,n,tot,col])=>(
                  <div key={lbl} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                      <span style={{color:col,fontWeight:700}}>{lbl}</span>
                      <span style={{color:C.muted,fontFamily:"DM Mono"}}>{n}/{tot}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{width:`${tot>0?(n/tot)*100:0}%`,background:col}}/>
                    </div>
                  </div>
                ))}

                <div style={{marginTop:12}}>
                  {[["Fleurs T",flowersT.length],["Fleurs E",flowersE.length]
                  ].map(([l,v])=>(
                    <div key={l} className="stat-row">
                      <span className="stat-label">{l}</span>
                      <span className="stat-val">{v}</span>
                    </div>
                  ))}
                </div>

                {compareData && (
                  <div style={{marginTop:14,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:10}}>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:9,color:C.muted,
                      textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
                      Significativité
                    </div>
                    {Object.entries(compareData.significance||{}).slice(0,8).map(([k,p])=>{
                      const col = p<0.05?C.expose:p<0.1?C.orange:C.muted;
                      return (
                        <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",
                          borderBottom:`1px solid ${C.border}20`,fontSize:9}}>
                          <span style={{color:C.muted,fontFamily:"DM Mono"}}>{k.replace(/_/g," ")}</span>
                          <span style={{fontWeight:700,color:col,fontFamily:"DM Mono"}}>{p}</span>
                        </div>
                      );
                    })}

                  </div>
                )}
              </>
            ) : (
              <div style={{color:C.muted,fontSize:11,lineHeight:1.7}}>
                Chargez les deux fichiers JSON pour démarrer l'analyse.
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}