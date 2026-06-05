import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const C = {
  bg:      "#ffffff", panel:  "#f8f9fa", border: "#e0e0e0",
  accent:  "#0066cc", text:   "#1a1a1a", muted:  "#666666",
  temoin:  "#2d9a2d", expose: "#cc3333", green:  "#2d9a2d",
  orange:  "#ff9900", normal: "#0066cc", abnorm: "#cc3333",
  purple:  "#6b3db8", teal:   "#00aa77",
};

const FEAT_LABELS = {
  // Vitesse et Accélération
  vitesse_min:"Vitesse min. (m/s)", vitesse_max:"Vitesse max. (m/s)",
  vitesse_moy:"Vitesse moy. (m/s)", vitesse_std:"Vitesse σ (m/s)", stabilite:"Stabilité",
  acc_rms:"Accél. RMS (m/s²)",
  // Cinématique scalaire
  dvdt_moy:"accélération moyenne (m/s²)", dvdt_std:"accélération σ (m/s²)",
  jerk_max:"Jerk max. (m/s³)", jerk_moy:"Jerk moyen (m/s³)",
  // Géométrie et Trajectoire
  sinuosity:"Sinuosité", dist_totale:"Dist. totale (m)",
  msd_mean:"MSD moyen (m²)",
  rayon_giration:"Rayon giration (m)", aire:"Aire convexe (m²)", z_std:"Variance Z (m)",
  // Angles et direction
  entropie_angles:"Entropie angulaire (bits)", autocorr_dir:"Autocorr. dir.",
  elevation_moy:"Angle d'élévation moy. (rad)", elevation_std:"Angle d'élévation σ (rad)",
  angular_vel_moy:"Vit. angulaire moy. (rad/s)", angular_vel_max:"Vit. angulaire max. (rad/s)",
  // Immobilité / Bouts
  taux_immobilite:"Taux immobilité",
  temps_jusqua_immobilite:"Temps jusqu'à immob. (s)", ratio_mouvement_arret:"Ratio mvt/arrêt (%)",
  nb_bouts:"Nb bouts",
  // Spatial
  dist_ruche_mean:"Dist. ruche moy. (m)", corr_xy_z:"Corr. XY–Z",
  confusion_spatiale:"Confusion spatiale",
  // Altitude
  altitude_moy:"Altitude moy. (m)", altitude_min:"Altitude min. (m)", altitude_max:"Altitude max. (m)",
  // Interactions fleurs
  nb_visites_plantes:"Nb plantes visitées",
  nb_fleurs_distinctes_visitees:"Nb fleurs distinctes visitées",
  time_to_first_visit:"Time to first visit (s)",
  temps_proche_plantes:"Tps près plantes (s)",
  dwell_moy_par_fleur:"Dwell moy./fleur (s)", transitions_fleurs:"Transitions fleurs",
  temps_inter_visites_moy:"Tps inter-visites moyen (s)",
  latence_florale_moy:"Latence florale (s)",
  // Comportement
  indice_grooming:"Indice grooming",
  // Efficacité et Temps
  path_efficiency:"Efficacité vol",
  temps_total_vol:"Durée totale vol (s)", retour_ruche:"Retour ruche",
  // ML
  anomaly_score_IF:"Score anomalie (IF)",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:'Space Grotesk',sans-serif;font-size:12px}
  ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
  .app{display:grid;grid-template-rows:44px 1fr;height:100vh;overflow:hidden}
  .hdr{background:${C.panel};border-bottom:1px solid ${C.border};display:flex;align-items:center;padding:0 16px;gap:10px}
  .hdr-logo{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;letter-spacing:.3px;color:${C.text}}
  .hdr-badge{font-size:9px;padding:2px 7px;border-radius:10px;background:${C.border};color:${C.muted};font-family:'JetBrains Mono',monospace;font-weight:500}
  .main{display:grid;grid-template-columns:236px 1fr 220px;overflow:hidden}
  .side{background:${C.panel};border-right:1px solid ${C.border};overflow-y:auto;display:flex;flex-direction:column}
  .sec{border-bottom:1px solid ${C.border};padding:10px 12px}
  .sec-title{font-family:'Syne',sans-serif;font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-bottom:8px}
  .bee-item{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;cursor:pointer;border:1px solid transparent;transition:all .1s}
  .bee-item:hover{background:${C.border}55}
  .bee-item.sel{background:${C.border};border-color:${C.accent}55}
  .center{display:flex;flex-direction:column;overflow:hidden}
  .tabs{display:flex;border-bottom:1px solid ${C.border};background:${C.panel};overflow-x:auto;flex-shrink:0}
  .tab{padding:8px 13px;font-size:10px;cursor:pointer;border-bottom:2px solid transparent;color:${C.muted};font-family:'Syne',sans-serif;font-weight:800;letter-spacing:.5px;white-space:nowrap;flex-shrink:0;transition:all .15s}
  .tab:hover{color:${C.text}}
  .tab.on{color:${C.accent};border-bottom-color:${C.accent}}
  .cvs-wrap{flex:1;position:relative;overflow:hidden;min-height:0}
  canvas{position:absolute;top:0;left:0;width:100%;height:100%}
  .right{background:${C.panel};border-left:1px solid ${C.border};overflow-y:auto;padding:10px 12px}
  .sr{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid ${C.border}22}
  .sl{color:${C.muted};font-size:10px}
  .sv{font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace}
  .no-data{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${C.muted};gap:8px;text-align:center;padding:32px}
  .chip{font-size:8px;padding:1px 6px;border-radius:8px;font-weight:700;display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace}
  .btn-grp{display:flex;gap:4px;flex-wrap:wrap}
  .btn{font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:700;border:1px solid ${C.border};background:transparent;color:${C.muted};transition:all .1s;font-family:'Space Grotesk',sans-serif}
  .btn:hover{border-color:${C.muted};color:${C.text}}
  .btn.on{border-color:${C.accent}88;background:${C.accent}18;color:${C.accent}}
  .btn:disabled{opacity:.35;cursor:not-allowed}
  .tbl{width:100%;border-collapse:collapse;font-size:10px}
  .tbl th{text-align:left;padding:4px 6px;border-bottom:1px solid ${C.border};font-family:'Syne',sans-serif;font-size:8px;color:${C.muted};text-transform:uppercase;letter-spacing:1px}
  .tbl td{padding:4px 6px;border-bottom:1px solid ${C.border}22;font-family:'JetBrains Mono',monospace}
  .tbl tr:hover td{background:${C.border}33}
  .shap-bar-pos{background:${C.expose};opacity:.8;border-radius:1px;position:absolute;left:50%;height:100%}
  .shap-bar-neg{background:${C.normal};opacity:.8;border-radius:1px;position:absolute;right:50%;height:100%}
  .metric-card{background:${C.bg};border:1px solid ${C.border};border-radius:8px;padding:10px;margin-bottom:8px}
  .metric-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .progress-track{flex:1;height:8px;background:${C.panel};border-radius:3px;border:1px solid ${C.border};overflow:hidden;position:relative}
  .stacked-bar{height:32px;background:${C.border}22;border-radius:6px;display:flex;border:1px solid ${C.border};overflow:hidden;margin-bottom:8px}
  .stacked-segment{display:flex;align-items:center;justify-content:center;color:${C.bg};font-size:9px;font-weight:700;font-family:'JetBrains Mono',monospace;transition:flex .15s}
`;

//SEGMENTATION DE TRAJECTOIRE POUR BUDGET D'ACTIVITÉ
function segmentTrajectory(bee, flowers, ruche) {
  const states = { immobile: 0, fleur: 0, lent: 0, rapide: 0, transit: 0 };
  const FLOWER_RADIUS = 0.15;
  const HIVE_TRANSIT_RADIUS = 0.4;

  bee.points.forEach(p => {
    const v = p.v || 0;
    let state = "lent";

    let nearFlower = false;
    for (const [fx, fy] of flowers) {
      const d = Math.hypot(p.x - fx, p.y - fy);
      if (d < FLOWER_RADIUS) {
        nearFlower = true;
        break;
      }
    }

    if (nearFlower && v < 0.15) {
      state = "fleur";
    } else if (v < 0.05) {
      state = "immobile";
    } else if (v < 0.25) {
      const distToHive = Math.hypot(p.x - ruche[0], p.y - ruche[1]);
      if (distToHive < HIVE_TRANSIT_RADIUS && v > 0.08) {
        state = "transit";
      } else {
        state = "lent";
      }
    } else {
      const distToHive = Math.hypot(p.x - ruche[0], p.y - ruche[1]);
      if (distToHive < HIVE_TRANSIT_RADIUS + 0.3) {
        state = "transit";
      } else {
        state = "rapide";
      }
    }

    states[state]++;
  });

  return states;
}

//COMPOSANT BUDGET D'ACTIVITÉ
function ActivityBudgetTab({ bees, flowers, rucheT, rucheE, selIds }) {
  const STATE_COLORS = {
    immobile: "#cc3333",
    fleur: "#d29922",
    lent: "#2d9a2d",
    rapide: "#0066cc",
    transit: "#6b3db8",
  };
  const STATE_LABELS = {
    immobile: "Immobile",
    fleur: "Près d'une fleur",
    lent: "Déplacement lent",
    rapide: "Déplacement rapide",
    transit: "En transit vers ruche",
  };

  const filtered = selIds && selIds.size > 0 ? bees.filter(b=>selIds.has(b.id)) : bees;
  if (!filtered.length) {
    return <div className="no-data"><span>Chargez les deux fichiers.</span></div>;
  }

  const tBees = filtered.filter(b=>b.group==="temoin");
  const eBees = filtered.filter(b=>b.group==="expose");

  const computeBudget = (beeList, ruche) => {
    const agg = { immobile: 0, fleur: 0, lent: 0, rapide: 0, transit: 0 };
    beeList.forEach(bee => {
      const seg = segmentTrajectory(bee, flowers, ruche);
      Object.entries(seg).forEach(([k,v]) => agg[k] += v);
    });
    const total = Object.values(agg).reduce((a,b)=>a+b,0);
    const pct = {};
    Object.entries(agg).forEach(([k,v]) => pct[k] = total ? (v/total*100) : 0);
    return { counts: agg, pct, total };
  };

  const tBudget = tBees.length > 0 ? computeBudget(tBees, rucheT || [0.1, 0.1, 0]) : null;
  const eBudget = eBees.length > 0 ? computeBudget(eBees, rucheE || [0.1, 0.1, 0]) : null;

  const BudgetBar = ({ budget, label, count, color }) => (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:6}}>
        {label} <span style={{fontSize:9,color:C.muted}}>({count} bourdons)</span>
      </div>
      <div className="stacked-bar">
        {["immobile","fleur","lent","rapide","transit"].map(state=>(
          budget.pct[state] > 0 && (
            <div
              key={state}
              className="stacked-segment"
              style={{flex:budget.pct[state],background:STATE_COLORS[state]}}
              title={`${STATE_LABELS[state]}: ${budget.pct[state].toFixed(1)}%`}
            >
              {budget.pct[state]>8 && `${budget.pct[state].toFixed(0)}%`}
            </div>
          )
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
        {["immobile","fleur","lent","rapide","transit"].map(state=>(
          <div key={state} style={{display:"flex",alignItems:"center",gap:4,fontSize:9}}>
            <div style={{width:10,height:10,borderRadius:3,background:STATE_COLORS[state],flexShrink:0}}/>
            <span style={{color:C.text,flex:1}}>{STATE_LABELS[state]}</span>
            <span style={{color:C.muted,fontFamily:"JetBrains Mono",textAlign:"right",width:36}}>
              {budget.pct[state].toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{padding:16,overflowY:"auto",height:"100%"}}>
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,marginBottom:4}}>Budget d'activité</div>
      <div style={{color:C.muted,fontSize:11,marginBottom:16,lineHeight:1.6}}>
        Segmentation automatique basée sur vitesse et proximité spatiale. Révèle les différences comportementales majeures.
      </div>

      {tBudget && <BudgetBar budget={tBudget} label="Groupe Témoin" count={tBees.length} color={C.temoin}/>}
      {eBudget && <BudgetBar budget={eBudget} label="Groupe Exposé" count={eBees.length} color={C.expose}/>}

      {tBudget && eBudget && (
        <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:10}}>Différences principales (Exposés p/r aux Témoins)</div>
          {["immobile","fleur","lent","rapide","transit"].map(state=>{
            const tVal = tBudget.pct[state];
            const eVal = eBudget.pct[state];
            const diff = eVal - tVal;
            const sign = diff>0?"+":"";
            return (
              <div key={state} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:10,borderBottom:`1px solid ${C.border}22`}}>
                <span style={{color:C.text,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:8,height:8,borderRadius:2,background:STATE_COLORS[state]}}/>
                  {STATE_LABELS[state]}
                </span>
                <span style={{color:Math.abs(diff)>5?C.abnorm:C.muted,fontFamily:"JetBrains Mono",fontWeight:Math.abs(diff)>5?700:400}}>
                  {sign}{diff.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

//json
function parseJSON(json, groupOverride) {
  const cage      = json.metadonnees?.cage_experimentale || {};
  const ruche     = cage.ruche_position_m
    ? [cage.ruche_position_m.x, cage.ruche_position_m.y, cage.ruche_position_m.z ?? 0]
    : [0.1, 0.1, 0];
  const worldSize = cage.dimensions_m
    ? [cage.dimensions_m.longueur, cage.dimensions_m.largeur, cage.dimensions_m.hauteur]
    : [2.5, 2.5, 1.8];
  const flowers   = (cage.plantes || []).map(p => [p.x, p.y, p.z ?? 0, p.id]);
  const commentaires = json.metadonnees?.Commentaires || null;

  const bees = [];
  for (const [key, val] of Object.entries(json)) {
    if (!key.startsWith("bourdon_")) continue;
    const group  = groupOverride || (val.groupe === "temoin" ? "temoin" : "expose");
    const metr   = val.metriques || {};
    const stats  = val.statistiques || {};
    const points = (val.trajectoire || []).map(p => ({ x:p.x, y:p.y, z:p.z, v:p.vitesse_ms??0 }));
    bees.push({
      id: val.id || key, key, group, metriques: metr, points,
      stats: {
        vitesse_min:     metr.vitesse_min     ?? 0,
        vitesse_max:     metr.vitesse_max     ?? 0,
        vitesse_moy:     metr.vitesse_moy     ?? stats.vitesse_moyenne_ms ?? 0,
        vitesse_std:     metr.vitesse_std     ?? 0,
        stabilite:       metr.stabilite       ?? 0,
        acc_rms:         metr.acc_rms         ?? 0,
        dvdt_moy:        metr.dvdt_moy        ?? 0,
        dvdt_std:        metr.dvdt_std        ?? 0,
        jerk_max:        metr.jerk_max        ?? 0,
        jerk_moy:        metr.jerk_moy        ?? 0,
        sinuosity:       metr.sinuosity       ?? 0,
        dist_totale:     metr.dist_totale     ?? 0,
        msd_mean:        metr.msd_mean        ?? 0,
        rayon_giration:  metr.rayon_giration  ?? 0,
        aire:            metr.aire            ?? 0,
        z_std:           metr.z_std           ?? 0,
        entropie_angles: metr.entropie_angles ?? 0,
        autocorr_dir:    metr.autocorr_dir    ?? 0,
        elevation_moy:   metr.elevation_moy   ?? 0,
        elevation_std:   metr.elevation_std   ?? 0,
        angular_vel_moy: metr.angular_vel_moy ?? 0,
        angular_vel_max: metr.angular_vel_max ?? 0,
        taux_immobilite: metr.taux_immobilite ?? 0,
        temps_jusqua_immobilite: metr.temps_jusqua_immobilite ?? 0,
        ratio_mouvement_arret:   metr.ratio_mouvement_arret   ?? 0,
        nb_bouts:                metr.nb_bouts                ?? 0,
        dist_ruche_mean:         metr.dist_ruche_mean         ?? 0,
        corr_xy_z:        metr.corr_xy_z        ?? 0,
        confusion_spatiale: metr.confusion_spatiale ?? 0,
        altitude_moy:     metr.altitude_moy     ?? 0,
        altitude_min:     metr.altitude_min     ?? 0,
        altitude_max:     metr.altitude_max     ?? 0,
        nb_visites_plantes:            metr.nb_visites_plantes            ?? 0,
        nb_fleurs_distinctes_visitees: metr.nb_fleurs_distinctes_visitees ?? 0,
        time_to_first_visit:           metr.time_to_first_visit           ?? 0,
        temps_proche_plantes:          metr.temps_proche_plantes          ?? 0,
        dwell_moy_par_fleur:     metr.dwell_moy_par_fleur     ?? 0,
        transitions_fleurs:      metr.transitions_fleurs      ?? 0,
        temps_inter_visites_moy: metr.temps_inter_visites_moy ?? 0,
        latence_florale_moy:     metr.latence_florale_moy     ?? 0,
        indice_grooming:         metr.indice_grooming         ?? 0,
        path_efficiency:         metr.path_efficiency         ?? 0,
        temps_total_vol:         metr.temps_total_vol         ?? 0,
        retour_ruche:            metr.retour_ruche            ?? 0,
      },
    });
  }
  return { flowers, ruche, worldSize, bees, commentaires };
}

//3d
function render3D(canvas, bees, flowers, rucheT, rucheE, worldSize, selIds, hoverBee, panX, panY, zoom, rotX, rotY, colorMode, mlData) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.offsetWidth, H = canvas.height = canvas.offsetHeight;
  ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
  const bs = Math.min(W*.75/(worldSize[0]||2.5), H*.75/(worldSize[1]||2.5));
  const sc = bs * zoom, ox = W/2+panX, oy = H/2+panY;
  const ctr = [worldSize[0]/2, worldSize[1]/2, worldSize[2]/2];
  const cX=Math.cos(rotX),sX=Math.sin(rotX),cY=Math.cos(rotY),sY=Math.sin(rotY);
  const proj = ({x,y,z}) => {
    let px=x-ctr[0],py=y-ctr[1],pz=z-ctr[2];
    const xz=px*cY-py*sY, yz=px*sY+py*cY;
    const yy=yz*cX-pz*sX, zz=yz*sX+pz*cX;
    const p=1/(1-zz*.1);
    return {x:ox+xz*sc*p, y:oy+yy*sc*p};
  };
  ctx.strokeStyle=C.border+"88"; ctx.lineWidth=.4;
  for(let i=0;i<=8;i++){
    const xi=worldSize[0]*i/8, yi=worldSize[1]*i/8;
    const p1=proj({x:xi,y:0,z:0}),p2=proj({x:xi,y:worldSize[1],z:0});
    const q1=proj({x:0,y:yi,z:0}),q2=proj({x:worldSize[0],y:yi,z:0});
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(q1.x,q1.y);ctx.lineTo(q2.x,q2.y);ctx.stroke();
  }
  flowers.forEach(([fx,fy,fz,fid])=>{
    const p=proj({x:fx,y:fy,z:fz});
    ctx.fillStyle="#d29922"; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle=C.bg; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle=C.bg; ctx.font="bold 7px JetBrains Mono"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(`F${fid+1}`,p.x,p.y);
  });
  [[rucheT,C.temoin,"T"],[rucheE,C.expose,"E"]].forEach(([r,col,lbl])=>{
    if(!r) return;
    const p=proj({x:r[0],y:r[1],z:r[2]});
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle=C.bg; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=C.bg; ctx.font="bold 8px Space Grotesk"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🏠",p.x,p.y);
  });
  const hasSel = selIds.size > 0;
  bees.forEach(bee => {
    if (!bee.points.length) return;
    const pr = bee.points.map(p => proj(p));
    const isSel = selIds.has(bee.id), isHov = hoverBee===bee.id;
    let col;
    const pbee = mlData?.per_bee?.[bee.id];
    if (colorMode === "normal" && pbee) {
      col = pbee.is_normal ? C.normal : C.abnorm;
    } else if (colorMode === "anomaly" && pbee) {
      const s = pbee.anomaly_score ?? 0;
      const r = Math.floor(s * 248), g = Math.floor((1-s) * 185);
      col = `rgb(${r},${g},60)`;
    } else {
      col = bee.group === "temoin" ? C.temoin : C.expose;
    }
    ctx.lineWidth = isSel?2.5:isHov?2:.8;
    ctx.strokeStyle = col;
    ctx.globalAlpha = hasSel?(isSel?.9:.06):(isHov?.85:.35);
    ctx.setLineDash(bee.group==="expose"?[4,3]:[]);
    ctx.beginPath(); pr.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = hasSel?(isSel?1:.08):1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(pr[0].x,pr[0].y,2.5,0,2*Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(pr[pr.length-1].x,pr[pr.length-1].y,isSel?5:2.5,0,2*Math.PI); ctx.fill();
    ctx.globalAlpha=1;
  });
}

//PCA
function PcaCanvas({ mlData, colorMode, selIds, onClickBee }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !mlData?.per_bee) return;
    try {
      const canvas = ref.current;
      const ctx = canvas.getContext("2d");
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);

      const per_bee = mlData.per_bee;
      const bees_data = Object.entries(per_bee);
      const xs = bees_data.map(([,b]) => b.pca_x);
      const ys = bees_data.map(([,b]) => b.pca_y);
      const xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
      const pad = {l:52, r:16, t:20, b:48};
      const toX = v => pad.l + (v-xmin)/(xmax-xmin)*(W-pad.l-pad.r);
      const toY = v => H-pad.b - (v-ymin)/(ymax-ymin)*(H-pad.t-pad.b);

      ctx.strokeStyle=C.border; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,H-pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l,H-pad.b); ctx.lineTo(W-pad.r,H-pad.b); ctx.stroke();

      const varE = mlData.pca?.variance_explained || [0,0];
      ctx.fillStyle=C.muted; ctx.font="10px Space Grotesk"; ctx.textAlign="center";
      ctx.fillText(`PC1 (${(varE[0]*100).toFixed(1)}%)`, (pad.l+W-pad.r)/2, H-12);
      ctx.save(); ctx.translate(14, (pad.t+H-pad.b)/2); ctx.rotate(-Math.PI/2);
      ctx.fillText(`PC2 (${(varE[1]*100).toFixed(1)}%)`, 0, 0); ctx.restore();

      bees_data.forEach(([id, b]) => {
        const px = toX(b.pca_x), py = toY(b.pca_y);
        const isSel = selIds?.has(id);
        let col;
        if (colorMode === "normal") {
          col = b.is_normal ? C.normal : C.abnorm;
        } else if (colorMode === "anomaly") {
          const s = b.anomaly_score ?? 0;
          col = `rgb(${Math.floor(s*248)},${Math.floor((1-s)*185)},60)`;
        } else {
          col = b.group === 0 ? C.temoin : C.expose;
        }
        ctx.fillStyle = col;
        ctx.strokeStyle = isSel ? "#fff" : C.bg;
        ctx.lineWidth = isSel ? 2.5 : 1.2;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        if (b.group === 0) {
          ctx.arc(px, py, isSel?9:6.5, 0, 2*Math.PI);
        } else {
          const s=isSel?9:6.5;
          ctx.moveTo(px,py-s); ctx.lineTo(px+s*.9,py+s*.7); ctx.lineTo(px-s*.9,py+s*.7);
          ctx.closePath();
        }
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha=1;
        ctx.fillStyle = C.text; ctx.font="bold 8px JetBrains Mono"; ctx.textAlign="center";
        ctx.fillText(id.replace("BE-","BE-").replace("bourdon_",""), px, py-13);
      });
    } catch(err) { console.error("PCA canvas error:", err); }
  }, [mlData, colorMode, selIds]);

  const handleClick = useCallback(e => {
    if (!ref.current || !mlData?.per_bee) return;
    try {
      const rect = ref.current.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const W = ref.current.offsetWidth, H = ref.current.offsetHeight;
      const per_bee = mlData.per_bee;
      const bees_data = Object.entries(per_bee);
      const xs = bees_data.map(([,b]) => b.pca_x);
      const ys = bees_data.map(([,b]) => b.pca_y);
      const xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
      const pad = {l:52, r:16, t:20, b:48};
      const toX = v => pad.l + (v-xmin)/(xmax-xmin)*(W-pad.l-pad.r);
      const toY = v => H-pad.b - (v-ymin)/(ymax-ymin)*(H-pad.t-pad.b);
      let best=null, bestD=18;
      Object.entries(mlData.per_bee).forEach(([id,b]) => {
        const d=Math.hypot(toX(b.pca_x)-mx, toY(b.pca_y)-my);
        if(d<bestD){bestD=d;best=id;}
      });
      if(best) onClickBee(best, e);
    } catch(err) { console.error("PCA click error:", err); }
  }, [mlData, onClickBee]);

  if (!mlData?.per_bee) return (
    <div className="no-data">
      <span style={{fontSize:28,opacity:.4}}>◉</span>
      <span>Chargez les deux groupes pour voir<br/>la projection PCA.</span>
    </div>
  );
  return <canvas ref={ref} style={{width:"100%",height:"100%",position:"absolute",top:0,left:0,cursor:"crosshair"}} onClick={handleClick}/>;
}

//HEATMAP
function HeatmapTab({ bees, allFlowers, rucheT, rucheE, worldSize, selIds, heatRef }) {
  const jetColor = (value) => {
    const clamp = (v) => Math.max(0, Math.min(1, v));
    value = clamp(value);
    const fourValue = 4 * value;
    const r = Math.min(255, Math.max(0, 255 * Math.min(fourValue - 1.5, -fourValue + 4.5)));
    const g = Math.min(255, Math.max(0, 255 * Math.min(fourValue - 0.5, -fourValue + 3.5)));
    const b = Math.min(255, Math.max(0, 255 * Math.min(fourValue + 0.5, -fourValue + 2.5)));
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  };

  const jetColorArray = (value) => {
    const clamp = (v) => Math.max(0, Math.min(1, v));
    value = clamp(value);
    const fourValue = 4 * value;
    const r = Math.min(255, Math.max(0, 255 * Math.min(fourValue - 1.5, -fourValue + 4.5)));
    const g = Math.min(255, Math.max(0, 255 * Math.min(fourValue - 0.5, -fourValue + 3.5)));
    const b = Math.min(255, Math.max(0, 255 * Math.min(fourValue + 0.5, -fourValue + 2.5)));
    return [Math.floor(r), Math.floor(g), Math.floor(b)];
  };

  const gaussian2D = (sigma, size) => {
    const kernel = [];
    const mean = size / 2;
    let sum = 0;
    for (let x = 0; x < size; x++) {
      kernel[x] = [];
      for (let y = 0; y < size; y++) {
        const dx = x - mean;
        const dy = y - mean;
        const val = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[x][y] = val;
        sum += val;
      }
    }
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        kernel[x][y] /= sum;
      }
    }
    return kernel;
  };

  useEffect(() => {
    if (!heatRef.current) return;
    const canvas = heatRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const pad = { l: 60, r: 80, t: 40, b: 60 };
    const mapW = W - pad.l - pad.r;
    const mapH = H - pad.t - pad.b;

    ctx.fillStyle = "#e3f2fd";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad.l, pad.t, mapW, mapH);

    const active = selIds.size > 0 ? bees.filter(b => selIds.has(b.id)) : bees;
    
    if (active.length > 0) {
      const bins = 150;
      const binsW = bins;
      const binsH = bins;
      const histogram = Array(binsW * binsH).fill(0);

      active.forEach(bee => {
        bee.points.forEach(p => {
          const bx = Math.floor((p.x / worldSize[0]) * binsW);
          const by = Math.floor((p.y / worldSize[1]) * binsH);
          if (bx >= 0 && bx < binsW && by >= 0 && by < binsH) {
            histogram[by * binsW + bx]++;
          }
        });
      });

      const kernel = gaussian2D(2.5, 5);
      const kernelSize = 5;
      const kernelRadius = Math.floor(kernelSize / 2);
      const smoothed = Array(binsW * binsH).fill(0);

      for (let y = 0; y < binsH; y++) {
        for (let x = 0; x < binsW; x++) {
          let sum = 0;
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const sy = y + ky - kernelRadius;
              const sx = x + kx - kernelRadius;
              if (sx >= 0 && sx < binsW && sy >= 0 && sy < binsH) {
                sum += histogram[sy * binsW + sx] * kernel[kx][ky];
              }
            }
          }
          smoothed[y * binsW + x] = sum;
        }
      }

      const maxD = Math.max(...smoothed) || 1;
      const normalized = smoothed.map(v => v / maxD);
      const threshold = 0.02;

      const cellW = mapW / binsW;
      const cellH = mapH / binsH;

      for (let by = 0; by < binsH; by++) {
        for (let bx = 0; bx < binsW; bx++) {
          const n = normalized[by * binsW + bx];
          
          let fillStyle;
          if (n < threshold) {
            fillStyle = "#f5f5f5";
          } else {
            fillStyle = jetColor(n);
          }

          ctx.fillStyle = fillStyle;
          ctx.fillRect(
            pad.l + bx * cellW,
            pad.t + by * cellH,
            cellW,
            cellH
          );
        }
      }
    }

    const colorBarX = pad.l + mapW + 20;
    const colorBarW = 20;
    const colorBarH = mapH;
    
    for (let i = 0; i < colorBarH; i++) {
      const value = 1 - (i / colorBarH);
      ctx.fillStyle = jetColor(value);
      ctx.fillRect(colorBarX, pad.t + i, colorBarW, 1);
    }

    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.strokeRect(colorBarX, pad.t, colorBarW, colorBarH);

    ctx.fillStyle = "#666";
    ctx.font = "11px Space Grotesk";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Max", colorBarX + colorBarW + 5, pad.t);
    ctx.fillText("Min", colorBarX + colorBarW + 5, pad.t + colorBarH);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + mapH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + mapH);
    ctx.lineTo(pad.l + mapW, pad.t + mapH);
    ctx.stroke();

    ctx.fillStyle = "#333";
    ctx.font = "12px Space Grotesk";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`X (${worldSize[0]} m)`, pad.l + mapW / 2, H - 15);
    
    ctx.save();
    ctx.translate(20, pad.t + mapH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Y (${worldSize[1]} m)`, 0, 0);
    ctx.restore();

    allFlowers.forEach(([fx, fy, fz, fid]) => {
      const px = pad.l + (fx / worldSize[0]) * mapW;
      const py = pad.t + (fy / worldSize[1]) * mapH;
      ctx.fillStyle = "#d29922";
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#333333";
      ctx.font = "bold 8px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`F${fid + 1}`, px, py);
    });

    [[rucheT, C.temoin, "T"], [rucheE, C.expose, "E"]].forEach(([r, col, label]) => {
      if (!r) return;
      const px = pad.l + (r[0] / worldSize[0]) * mapW;
      const py = pad.t + (r[1] / worldSize[1]) * mapH;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Space Grotesk";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🏠", px, py);
    });
  }, [bees, allFlowers, rucheT, rucheE, worldSize, selIds, heatRef]);

  return (
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: "20px"}}>
      <canvas ref={heatRef} style={{ width: "100%", height: "100%", maxWidth: "800px", maxHeight: "600px" }} />
    </div>
  );
}

//SHAP
function ShapTab({ mlData }) {
  if (!mlData?.shap?.plot_img) return (
    <div className="no-data">
      <span style={{fontSize:28,opacity:.4}}>⬡</span>
      <span>Chargez les deux groupes pour<br/>voir l'analyse SHAP.</span>
    </div>
  );

  return (
    <div style={{padding:16,overflowY:"auto",height:"100%",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <img src={mlData.shap.plot_img} style={{maxWidth:"100%",height:"auto",borderRadius:8,marginBottom:16}} />
      <div style={{fontSize:11,color:C.muted,lineHeight:1.6,maxWidth:600}}>
        <strong style={{color:C.text}}>Beeswarm SHAP :</strong> Chaque point représente un échantillon. <br/>
        L'axe horizontal = SHAP value (contribution de la variable à la décision du modèle) <br/> Couleur = valeur de la feature (tend vers le rouge = valeur de la feature plus élevée).
      </div>
    </div>
  );
}


//IMPACT
function ImpactTab({ bees, mlData, selIds }) {
  const filtered = selIds && selIds.size > 0 ? bees.filter(b=>selIds.has(b.id)) : bees;
  const tBees = filtered.filter(b=>b.group==="temoin");
  const eBees = filtered.filter(b=>b.group==="expose");
  const nBees = filtered.filter(b=>mlData?.per_bee?.[b.id]?.is_normal===true);
  const aBees = filtered.filter(b=>mlData?.per_bee?.[b.id]?.is_normal===false);
  const avg=(arr,k)=>{const v=arr.map(b=>b.stats[k]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
  const disc = mlData?.feature_discrimination || {};
  const keys = Object.keys(FEAT_LABELS).filter(k=>k!=="anomaly_score_IF");
  const sortedKeys = [...keys].sort((a,b)=>Math.abs(disc[b]?.effect_size_rb||0)-Math.abs(disc[a]?.effect_size_rb||0));

  if(!tBees.length&&!eBees.length) return <div className="no-data"><span>Chargez les deux fichiers.</span></div>;

  return (
    <div style={{padding:16,overflowY:"auto",height:"100%"}}>
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,marginBottom:4}}>Profil comparatif</div>
      {sortedKeys.map(k=>{
        const tV=avg(tBees,k), eV=avg(eBees,k), nV=avg(nBees,k), aV=avg(aBees,k);
        const mx=Math.max(tV??0,eV??0,nV??0,aV??0)*1.2||1;
        return (
          <div key={k} className="metric-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:600,color:C.text}}>{FEAT_LABELS[k]}</span>
            </div>
            {[["T",tV,C.temoin],["E",eV,C.expose],["N",nV,C.normal],["A",aV,C.expose]].map(([lbl,v,col])=>(
              <div key={lbl} className="metric-row">
                <span style={{width:16,fontSize:9,color:col,fontWeight:700,fontFamily:"JetBrains Mono"}}>{lbl}</span>
                <div className="progress-track">
                  <div style={{width:`${mx>0?(v??0)/mx*100:0}%`,height:"100%",background:col,opacity:.8,borderRadius:3}}/>
                </div>
                <span style={{width:56,fontSize:9,color:C.muted,fontFamily:"JetBrains Mono",textAlign:"right"}}>
                  {v!=null?v.toFixed(4):"—"}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

//INDIVIDU
function BeeTab({ selBee, mlData }) {
  if (!selBee) return (
    <div className="no-data">
      <span style={{fontSize:28,opacity:.4}}>⬡</span>
      <span>Sélectionnez un bourdon dans la liste.</span>
    </div>
  );

  const pb = mlData?.per_bee?.[selBee.id];
  const rfData = mlData?.rf_shap?.per_bee?.[selBee.id];
  const shapVals = pb?.shap_values || rfData?.shap_values || {};
  const top8Shap = Object.entries(shapVals)
    .map(([f,v])=>({feat:f,val:v,label:FEAT_LABELS[f]||f}))
    .sort((a,b)=>Math.abs(b.val)-Math.abs(a.val))
    .slice(0,8);
  const maxShap = top8Shap.length ? Math.abs(top8Shap[0].val) : 1;

  return (
    <div style={{padding:16,overflowY:"auto",height:"100%",maxWidth:520}}>
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
        {selBee.id}
        <span style={{fontSize:11,color:selBee.group==="temoin"?C.temoin:C.expose,fontWeight:400}}>
          {selBee.group.toUpperCase()}
        </span>
        {pb&&<span className="chip" style={{
          background:pb.is_normal?`${C.green}22`:`${C.expose}22`,
          color:pb.is_normal?C.green:C.expose
        }}>{pb.is_normal?"NORMAL":"ANORMAL"}</span>}
      </div>

      {pb&&(
        <div className="metric-card" style={{marginBottom:10,marginTop:8}}>
          <div className="sec-title" style={{marginBottom:6}}>XGBoost</div>
          {[
            ["Prédiction",pb.is_normal?"Normal (0)":"Anormal (1)"],
            ["Probabilité exposé",((pb.xgb_proba_loo??0)*100).toFixed(1)+"%"],
            ["Score anomalie IF",(pb.anomaly_score??0).toFixed(4)],
            ["IF : anomalie détectée",pb.if_is_anomaly?"Oui":"Non"],
            ["PC1",pb.pca_x?.toFixed(4)],["PC2",pb.pca_y?.toFixed(4)],
          ].map(([l,v])=>v!=null&&(
            <div key={l} className="sr"><span className="sl">{l}</span>
            <span className="sv" style={{color:l.includes("Prob")?((pb.xgb_proba_loo??0)>.5?C.expose:C.green):C.text}}>{v}</span></div>
          ))}
          {pb.shap_top3&&(
            <div style={{marginTop:8,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:4,fontFamily:"Syne",fontWeight:700,letterSpacing:1}}>TOP 3 SHAP</div>
              {pb.shap_top3.map(({feature,shap:sv,direction})=>(
                <div key={feature} style={{display:"flex",justifyContent:"space-between",fontSize:9,padding:"2px 0",color:C.muted}}>
                  <span style={{color:C.text}}>{FEAT_LABELS[feature]||feature}</span>
                  <span style={{fontFamily:"JetBrains Mono",color:sv>0?C.expose:C.green}}>
                    {sv>=0?"+":""}{sv.toFixed(4)} {direction}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {top8Shap.length>0&&(
        <div className="metric-card" style={{marginBottom:10}}>
          <div className="sec-title" style={{marginBottom:6}}>SHAP — Contribution individuelle</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:8}}>+ = pousse vers "anormal", − = pousse vers "normal"</div>
          {top8Shap.map(({feat,val,label})=>(
            <div key={feat} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <span style={{width:108,fontSize:9,color:C.text,textAlign:"right",fontFamily:"JetBrains Mono",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
              <div style={{flex:1,height:7,background:C.bg,borderRadius:2,border:`1px solid ${C.border}`,overflow:"hidden",position:"relative"}}>
                <div style={{
                  position:"absolute",top:0,bottom:0,
                  width:`${Math.min(Math.abs(val)/maxShap*50,50)}%`,
                  background:val>=0?C.expose:C.normal,
                  opacity:.8,borderRadius:1,
                  left:val>=0?"50%":undefined,right:val<0?"50%":undefined,
                }}/>
                <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:C.border}}/>
              </div>
              <span style={{width:52,fontSize:8,fontFamily:"JetBrains Mono",color:val>=0?C.expose:C.normal,textAlign:"right"}}>
                {val>=0?"+":""}{val.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="sec-title" style={{marginBottom:6}}>Features calculées</div>
      {Object.entries(FEAT_LABELS).filter(([k])=>k!=="anomaly_score_IF").map(([k,lbl])=>{
        const v = selBee.stats[k];
        return (
          <div key={k} className="sr">
            <span className="sl">{lbl}</span>
            <span className="sv">{typeof v==="number"?v.toFixed(5):v??"-"}</span>
          </div>
        );
      })}
    </div>
  );
}

//COMPOSANT PRINCIPAL
export default function BourdonTracker() {
  const [bees,setbees]           = useState([]);
  const [flowersT,setFlowersT]   = useState([]);
  const [flowersE,setFlowersE]   = useState([]);
  const [rucheT,setRucheT]       = useState(null);
  const [rucheE,setRucheE]       = useState(null);
  const [worldSize,setWorldSize] = useState([2.5,2.5,1.8]);
  const [selIds,setSelIds]       = useState(new Set());
  const [hoverBee,setHoverBee]   = useState(null);
  const [tab,setTab]             = useState("map");
  const [mlData,setMlData]       = useState(null);
  const [colorMode,setColorMode] = useState("group");
  const [pcaColor,setPcaColor]   = useState("group");
  const [commentsT,setCommentsT] = useState(null);
  const [commentsE,setCommentsE] = useState(null);

  const [panX,setPanX]=useState(0),[panY,setPanY]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [rotX,setRotX]=useState(0),[rotY,setRotY]=useState(0);
  const [isDrag,setIsDrag]=useState(false),[dSt,setDSt]=useState(null);
  const [rawT,setRawT]=useState(null),[rawE,setRawE]=useState(null);
  const [processed,setProcessed]=useState(false),[loading,setLoading]=useState(false);
  const [hoveredCommentT,setHoveredCommentT]=useState(false),[hoveredCommentE,setHoveredCommentE]=useState(false);

  const cvRef   = useRef(null);
  const heatRef = useRef(null);
  const allFlowers = useMemo(()=>[...flowersT,...flowersE],[flowersT,flowersE]);

  const uploadJson = useCallback(async (json, group) => {
    try {
      const fd = new FormData();
      fd.append("file", new Blob([JSON.stringify(json)],{type:"application/json"}), "data.json");
      fd.append("group", group);
      const r = await fetch("http://localhost:5000/upload",{method:"POST",body:fd});
      if (!r.ok) throw new Error();
      return await r.json();
    } catch { return json; }
  },[]);

  useEffect(()=>{
    if(!rawT||!rawE||processed) return;
    setLoading(true);
    (async()=>{
      setbees([]); setSelIds(new Set()); setMlData(null);
      try { await fetch("http://localhost:5000/reset",{method:"POST"}); } catch{}
      const [eT,eE] = await Promise.all([uploadJson(rawT,"temoin"),uploadJson(rawE,"expose")]);
      let ml = null;
      try {
        const mlRes = await fetch("http://localhost:5000/compute-ml",{method:"POST"});
        ml = (await mlRes.json())._ml;
      } catch{}
      if(ml) setMlData(ml);
      const dT=parseJSON(eT,"temoin"), dE=parseJSON(eE,"expose");
      setbees([...dT.bees,...dE.bees]);
      setFlowersT(dT.flowers); setFlowersE(dE.flowers);
      setRucheT(dT.ruche); setRucheE(dE.ruche);
      setWorldSize(dT.worldSize);
      setCommentsT(dT.commentaires); setCommentsE(dE.commentaires);
      setProcessed(true); setLoading(false);
    })();
  },[rawT,rawE,processed,uploadJson]);

  useEffect(()=>{
    if(cvRef.current) render3D(cvRef.current,bees,allFlowers,rucheT,rucheE,worldSize,selIds,hoverBee,panX,panY,zoom,rotX,rotY,colorMode,mlData);
  },[bees,allFlowers,rucheT,rucheE,worldSize,selIds,hoverBee,panX,panY,zoom,rotX,rotY,colorMode,mlData]);

  const selectBee = useCallback((id, e) => {
    setSelIds(prev=>{
      const n=new Set(prev);
      if(e?.ctrlKey||e?.metaKey){if(n.has(id))n.delete(id);else n.add(id);}
      else{if(n.size===1&&n.has(id))n.clear();else{n.clear();n.add(id);}}
      return n;
    });
  },[]);

  const handleFile = (file, isT) => {
    const r=new FileReader();
    r.onload=e=>{try{const j=JSON.parse(e.target.result);if(isT)setRawT(j);else setRawE(j);setProcessed(false);}catch(err){alert(err.message);}};
    r.readAsText(file);
  };

  const handleMouseDown=e=>{setIsDrag(true);setDSt({x:e.clientX,y:e.clientY,panX,panY,rotX,rotY,mode:e.shiftKey?"pan":"rotate"});};
  const handleMouseMove=e=>{if(!isDrag||!dSt)return;if(dSt.mode==="pan"){setPanX(dSt.panX+e.clientX-dSt.x);setPanY(dSt.panY+e.clientY-dSt.y);}else{setRotY(dSt.rotY+(e.clientX-dSt.x)*.006);setRotX(Math.max(-Math.PI/2+.1,Math.min(Math.PI/2-.1,dSt.rotX-(e.clientY-dSt.y)*.006)));}};
  const handleWheel=e=>{e.preventDefault();setZoom(p=>Math.min(3,Math.max(.4,p*(e.deltaY>0?.9:1.1))));};

  const tBees = bees.filter(b=>b.group==="temoin");
  const eBees = bees.filter(b=>b.group==="expose");
  const normalBees  = bees.filter(b=>mlData?.per_bee?.[b.id]?.is_normal===true);
  const abnormBees  = bees.filter(b=>mlData?.per_bee?.[b.id]?.is_normal===false);
  const selBee = useMemo(()=>{const id=[...selIds][0];return bees.find(b=>b.id===id)||null;},[bees,selIds]);

  const TABS = [
    ["map","3D"],["heatmap","HeatMap"],["pca","PCA"],["shap","SHAP"],
    ["activity","Budget d'activité"],["impact","Impact"],["bee","Individu"],
  ];

  const selGroups = [
    ["Tous",()=>new Set(bees.map(b=>b.id)),C.muted],
    [`T (${tBees.length})`,()=>new Set(tBees.map(b=>b.id)),C.temoin],
    [`E (${eBees.length})`,()=>new Set(eBees.map(b=>b.id)),C.expose],
    ...(mlData?[
      [`N (${normalBees.length})`,()=>new Set(normalBees.map(b=>b.id)),C.normal],
      [`A (${abnormBees.length})`,()=>new Set(abnormBees.map(b=>b.id)),C.abnorm],
    ]:[]),
  ];

  const xgb = mlData?.xgboost;
  const IF  = mlData?.isolation_forest;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="hdr">
          <span className="hdr-logo">BOURDONS</span>
          {loading&&<span style={{marginLeft:"auto",fontSize:10,color:C.accent,fontFamily:"JetBrains Mono",fontWeight:700}}>
            ⟳ calcul ML…
          </span>}
        </div>

        <div className="main">
          {/* ─ SIDEBAR ─ */}
          <div className="side">
            <div className="sec">
              <div className="sec-title">Données</div>
              {[["Témoin",true,C.temoin,hoveredCommentT,setHoveredCommentT,commentsT],["Exposé",false,C.expose,hoveredCommentE,setHoveredCommentE,commentsE]].map(([lbl,isT,col,hoveredComment,setHoveredComment,comment])=>(
                <div key={lbl} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:8,marginBottom:7}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:col,display:"inline-block"}}/>
                    <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:col}}>{lbl}</span>
                    {comment && !["null","None",""].includes(comment) && (
                      <div style={{position:"relative",marginLeft:"auto"}}>
                        <span 
                          style={{fontSize:10,fontWeight:700,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",background:col+"22",color:col,borderRadius:"50%",cursor:"pointer",userSelect:"none"}}
                          onMouseEnter={()=>setHoveredComment(true)}
                          onMouseLeave={()=>setHoveredComment(false)}
                        >
                          i
                        </span>
                        {hoveredComment && (
                          <div style={{position:"absolute",bottom:"calc(100% + 8px)",right:0,background:"rgba(0,0,0,0.85)",color:"white",padding:"8px 12px",borderRadius:4,fontSize:9,width:220,whiteSpace:"normal",wordWrap:"break-word",zIndex:1000,boxShadow:"0 2px 8px rgba(0,0,0,0.3)",lineHeight:"1.4"}}>
                            {comment}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0],isT)}
                    style={{fontSize:10,width:"100%",cursor:"pointer",color:C.muted}}/>
                </div>
              ))}
            </div>

            <div className="sec">
              <div className="sec-title">Sélection</div>
              <div className="btn-grp">
                {selGroups.map(([lbl,fn,col])=>(
                  <button key={lbl} className="btn" onClick={()=>setSelIds(fn())} style={{borderColor:col+"55",color:col}}>{lbl}</button>
                ))}
                {selIds.size>0&&<button className="btn" onClick={()=>setSelIds(new Set())}>✕</button>}
              </div>
              {selIds.size>0&&<div style={{fontSize:9,color:C.muted,marginTop:5,fontFamily:"JetBrains Mono"}}>{selIds.size} sélectionné(s)</div>}
            </div>

            <div className="sec" style={{flex:1,overflowY:"auto"}}>
              <div className="sec-title">Individus ({bees.length})</div>
              {bees.map(bee=>{
                const pb=mlData?.per_bee?.[bee.id];
                const anomScore = pb?.anomaly_score;
                return (
                  <div key={bee.id} className={`bee-item ${selIds.has(bee.id)?"sel":""}`}
                    onClick={e=>selectBee(bee.id,e)}
                    onMouseEnter={()=>setHoverBee(bee.id)} onMouseLeave={()=>setHoverBee(null)}>
                    <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
                      background:colorMode==="normal"&&pb?(pb.is_normal?C.normal:C.abnorm)
                               :bee.group==="temoin"?C.temoin:C.expose}}/>
                    <span style={{flex:1,fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bee.id}</span>
                    {pb&&<span className="chip" style={{
                      background:pb.is_normal?`${C.green}22`:`${C.expose}22`,
                      color:pb.is_normal?C.green:C.expose,fontSize:7
                    }}>{pb.is_normal?"N":"A"}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─ CENTER ─ */}
          <div className="center">
            <div className="tabs">
              {TABS.map(([k,lbl])=>(
                <div key={k} className={`tab ${tab===k?"on":""}`} onClick={()=>setTab(k)}>{lbl}</div>
              ))}
            </div>

            {tab==="map"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div style={{padding:"6px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:8,alignItems:"center",flexShrink:0,background:C.panel}}>
                  <span style={{fontSize:10,color:C.muted}}>Couleur :</span>
                  <div className="btn-grp">
                    <button className={`btn ${colorMode==="group"?"on":""}`} onClick={()=>setColorMode("group")}>Témoin / Exposé</button>
                    <button className={`btn ${colorMode==="normal"?"on":""}`} onClick={()=>setColorMode("normal")} disabled={!mlData}>Normal / Anormal</button>
                  </div>
                </div>
                <div className="cvs-wrap">
                  <canvas ref={cvRef} style={{cursor:isDrag?"grabbing":"grab"}}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={()=>setIsDrag(false)} onMouseLeave={()=>setIsDrag(false)}
                    onWheel={handleWheel}
                    onDoubleClick={()=>{setPanX(0);setPanY(0);setZoom(1);setRotX(0);setRotY(0);}}/>
                  <div style={{position:"absolute",bottom:8,left:8,background:"rgba(0,0,0,.65)",color:C.bg,
                    padding:"4px 8px",borderRadius:4,fontSize:8,fontFamily:"JetBrains Mono",pointerEvents:"none"}}>
                    Glisser=rotation · Shift+Glisser=déplacement · Scroll=zoom · Double-clic=reset
                  </div>
                </div>
              </div>
            )}

            {tab==="heatmap"&&(
              <div className="cvs-wrap">
                <HeatmapTab bees={bees} allFlowers={allFlowers} rucheT={rucheT} rucheE={rucheE} worldSize={worldSize} selIds={selIds} heatRef={heatRef}/>
              </div>
            )}

            {tab==="pca"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div style={{padding:"6px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:8,alignItems:"center",flexShrink:0,background:C.panel}}>
                  <span style={{fontSize:10,color:C.muted}}>Couleur :</span>
                  <div className="btn-grp">
                    <button className={`btn ${pcaColor==="group"?"on":""}`} onClick={()=>setPcaColor("group")}>Témoin / Exposé</button>
                    <button className={`btn ${pcaColor==="normal"?"on":""}`} onClick={()=>setPcaColor("normal")}>Normal / Anormal</button>
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:9,color:C.muted}}>
                    <span style={{color:C.temoin}}>● Témoin</span>
                    <span style={{color:C.expose}}>▲ Exposé</span>
                  </div>
                </div>
                <div className="cvs-wrap" style={{flex:1}}>
                  <PcaCanvas mlData={mlData} colorMode={pcaColor} selIds={selIds} onClickBee={selectBee}/>
                </div>
                {xgb&&(
                  <div style={{padding:"6px 14px",borderTop:`1px solid ${C.border}`,display:"flex",gap:16,fontSize:10,color:C.muted,flexShrink:0,flexWrap:"wrap",background:C.panel}}>
                    <span style={{color:C.normal}}> Normaux {mlData.n_normal}</span>
                    <span style={{color:C.abnorm}}> Anormaux {mlData.n_abnormal}</span>
                  </div>
                )}
              </div>
            )}

            {tab==="shap"&&<div style={{flex:1,overflowY:"auto"}}><ShapTab mlData={mlData}/></div>}
            {tab==="activity"&&<div style={{flex:1,overflowY:"auto"}}><ActivityBudgetTab bees={bees} flowers={allFlowers} rucheT={rucheT} rucheE={rucheE} selIds={selIds}/></div>}
            {tab==="impact"&&<div style={{flex:1,overflowY:"auto"}}><ImpactTab bees={bees} mlData={mlData} selIds={selIds}/></div>}
            {tab==="bee"&&<div style={{flex:1,overflowY:"auto"}}><BeeTab selBee={selBee} mlData={mlData}/></div>}
          </div>

          {/* ─ RIGHT PANEL ─ */}
          <div className="right">
            <div className="sec-title" style={{marginBottom:8}}>Résumé</div>
            {[["Total",bees.length,C.text],["Témoins",tBees.length,C.temoin],["Exposés",eBees.length,C.expose]].map(([l,v,c])=>(
              <div key={l} className="sr"><span className="sl">{l}</span><span className="sv" style={{color:c}}>{v}</span></div>
            ))}

            {xgb&&(
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
                <div className="sec-title" style={{marginBottom:6}}>XGBoost</div>
                {[
                  ["Normaux",    mlData.n_normal,   C.normal],
                  ["Anormaux",   mlData.n_abnormal, C.abnorm],
                ].map(([l,v,c])=>(
                  <div key={l} className="sr"><span className="sl">{l}</span><span className="sv" style={{color:c}}>{v}</span></div>
                ))}
                
                {xgb.confusion_matrix&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}22`}}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:6,fontWeight:600}}>Confusion Matrix</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,fontSize:8,fontFamily:"JetBrains Mono"}}>
                      <div style={{textAlign:"center",color:C.muted}}></div>
                      <div style={{textAlign:"center",color:C.muted,fontWeight:600}}>Normal</div>
                      <div style={{textAlign:"center",color:C.muted,fontWeight:600}}>Anormal</div>
                      
                      <div style={{color:C.muted,fontWeight:600}}>Témoin</div>
                      <div style={{background:`${C.normal}22`,padding:4,borderRadius:3,textAlign:"center",fontWeight:700,color:C.normal}}>
                        {xgb.confusion_matrix.tn}
                      </div>
                      <div style={{background:`${C.expose}22`,padding:4,borderRadius:3,textAlign:"center",fontWeight:700,color:C.expose}}>
                        {xgb.confusion_matrix.fp}
                      </div>
                      
                      <div style={{color:C.muted,fontWeight:600}}>Exposé</div>
                      <div style={{background:`${C.expose}22`,padding:4,borderRadius:3,textAlign:"center",fontWeight:700,color:C.expose}}>
                        {xgb.confusion_matrix.fn}
                      </div>
                      <div style={{background:`${C.normal}22`,padding:4,borderRadius:3,textAlign:"center",fontWeight:700,color:C.normal}}>
                        {xgb.confusion_matrix.tp}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mlData?.shap?.top_features?.length>0&&(
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
                <div className="sec-title" style={{marginBottom:6}}>Top SHAP</div>
                {mlData.shap.top_features.slice(0,5).map((f,i)=>(
                  <div key={f} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:9,borderBottom:`1px solid ${C.border}22`}}>
                    <span style={{color:C.muted}}>#{i+1}</span>
                    <span style={{color:C.text,flex:1,padding:"0 6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {FEAT_LABELS[f]||f}
                    </span>
                    <span style={{color:C.purple,fontFamily:"JetBrains Mono",fontWeight:700}}>
                      {(mlData.shap.global_importance[f]||0).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {mlData?.model_agreement&&(
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
                <div className="sec-title" style={{marginBottom:6}}>"Cohérence ML"</div>
                <div className="sr">
                  <span className="sl">IF ↔ XGB</span>
                  <span className="sv" style={{color:mlData.model_agreement.pct_agree>.8?C.green:C.orange}}>
                    {(mlData.model_agreement.pct_agree*100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {!mlData&&<div style={{color:C.muted,fontSize:11,lineHeight:1.7,marginTop:8}}>Chargez les deux fichiers JSON pour démarrer l'analyse.</div>}
          </div>
        </div>
      </div>
    </>
  );
}