import { useState, useEffect, useRef, useCallback, useMemo } from "react";

//PALETTE
const C = {
  bg:      "#f9fafb", panel:  "#ffffff", border: "#e5e9ef",
  accent:  "#2563eb", text:   "#111827", muted:  "#6b7280",
  temoin:  "#0ea5e9", expose: "#ef4444", green:  "#10b981",
  orange:  "#f59e0b", normal: "#0c09c4", abnorm: "#ff0000",
};

const FEAT_LABELS = {
  vitesse_moy:"Vitesse moy.", vitesse_std:"Vitesse std", stabilite:"Stabilité",
  acc_rms:"Accél. RMS", tortuosite:"Tortuosité", dist_totale:"Dist. totale",
  msd_mean:"MSD moyen", msd_slope:"MSD pente", katz_fd:"Dim. fractale (Katz)",
  rayon_giration:"Rayon giration", aire:"Aire convexe", z_std:"Variance Z",
  entropie_angles:"Entropie angulaire", autocorr_dir:"Autocorr. direction",
  taux_immobilite:"Taux immobilité", linearite:"Linéarité PCA",
  temps_jusqua_immobilite:"Tps jusqu'à immobilité", ratio_mouvement_arret:"Ratio mouvement/arrêt",
  nb_bouts:"Nb bouts", dist_ruche_mean:"Dist. ruche moy.", nb_visites_plantes:"Visites plantes",
  temps_proche_plantes:"Tps près plantes", retour_ruche:"Retour ruche",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;font-size:13px}
  ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
  .app{display:grid;grid-template-rows:48px 1fr;height:100vh;overflow:hidden}
  .hdr{background:${C.panel};border-bottom:1px solid ${C.border};display:flex;align-items:center;padding:0 18px;gap:12px}
  .hdr h1{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;letter-spacing:-.3px}
  .main{display:grid;grid-template-columns:248px 1fr 232px;overflow:hidden}
  .side{background:${C.panel};border-right:1px solid ${C.border};overflow-y:auto;display:flex;flex-direction:column}
  .sec{border-bottom:1px solid ${C.border};padding:12px}
  .sec-title{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};margin-bottom:8px}
  .bee-item{display:flex;align-items:center;gap:7px;padding:5px 7px;border-radius:6px;cursor:pointer;border:1px solid transparent;user-select:none;transition:background .1s}
  .bee-item:hover{background:${C.bg}}
  .bee-item.sel{background:${C.bg};border-color:${C.accent}}
  .center{display:flex;flex-direction:column;overflow:hidden}
  .tabs{display:flex;border-bottom:1px solid ${C.border};background:${C.panel};overflow-x:auto;flex-shrink:0}
  .tab{padding:9px 14px;font-size:10px;cursor:pointer;border-bottom:2px solid transparent;color:${C.muted};font-family:'Syne',sans-serif;font-weight:700;letter-spacing:.3px;white-space:nowrap;flex-shrink:0}
  .tab.on{color:${C.accent};border-bottom-color:${C.accent}}
  .cvs-wrap{flex:1;position:relative;overflow:hidden;min-height:0}
  canvas{position:absolute;top:0;left:0;width:100%;height:100%}
  .right{background:${C.panel};border-left:1px solid ${C.border};overflow-y:auto;padding:12px}
  .sr{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid ${C.border}18}
  .sl{color:${C.muted};font-size:10px}
  .sv{font-size:11px;font-weight:700;font-family:'DM Mono',monospace}
  .no-data{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${C.muted};gap:8px;text-align:center;padding:32px}
  .chip{font-size:8px;padding:1px 6px;border-radius:10px;font-weight:700;display:inline-flex;align-items:center}
  .btn-grp{display:flex;gap:4px;flex-wrap:wrap}
  .btn{font-size:9px;padding:3px 9px;border-radius:4px;cursor:pointer;font-weight:700;border:1px solid ${C.border};background:${C.panel};color:${C.muted};transition:all .1s}
  .btn.on{border-color:${C.accent};background:rgba(37,99,235,.07);color:${C.accent}}
  .bar-wrap{display:flex;align-items:center;gap:6px;margin-bottom:5px}
  .bar-lbl{width:116px;font-size:10px;color:${C.muted};text-align:right;flex-shrink:0;font-family:'DM Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bar-trk{flex:1;height:10px;background:${C.bg};border-radius:3px;overflow:hidden;border:1px solid ${C.border};position:relative}
  .bar-val{width:44px;font-size:9px;color:${C.muted};font-family:'DM Mono',monospace;text-align:right}
  .tbl{width:100%;border-collapse:collapse;font-size:10px}
  .tbl th{text-align:left;padding:4px 6px;border-bottom:1px solid ${C.border};font-family:'Syne',sans-serif;font-size:9px;color:${C.muted};text-transform:uppercase;letter-spacing:.8px}
  .tbl td{padding:4px 6px;border-bottom:1px solid ${C.border}18;font-family:'DM Mono',monospace}
  .tbl tr:hover td{background:${C.bg}}
`;

//PARSE JSON
function parseJSON(json, groupOverride) {
  const cage = json.metadonnees?.cage_experimentale || {};
  const ruche = cage.ruche_position_m
    ? [cage.ruche_position_m.x, cage.ruche_position_m.y, cage.ruche_position_m.z ?? 0]
    : [0.1, 0.1, 0];
  const worldSize = cage.dimensions_m
    ? [cage.dimensions_m.longueur, cage.dimensions_m.largeur, cage.dimensions_m.hauteur]
    : [2.5, 2.5, 1.8];
  const flowers = (cage.plantes || []).map(p => [p.x, p.y, p.z ?? 0, p.id]);

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
        vitesse_moy:     metr.vitesse_moy     ?? stats.vitesse_moyenne_ms ?? 0,
        vitesse_std:     metr.vitesse_std     ?? 0,
        stabilite:       metr.stabilite       ?? 0,
        acc_rms:         metr.acc_rms         ?? 0,
        tortuosite:      metr.tortuosite      ?? 0,
        dist_totale:     metr.dist_totale     ?? 0,
        msd_mean:        metr.msd_mean        ?? 0,
        msd_slope:       metr.msd_slope       ?? 0,
        katz_fd:         metr.katz_fd         ?? 0,
        rayon_giration:  metr.rayon_giration  ?? 0,
        aire:            metr.aire            ?? 0,
        z_std:           metr.z_std           ?? 0,
        entropie_angles: metr.entropie_angles ?? 0,
        autocorr_dir:    metr.autocorr_dir    ?? 0,
        taux_immobilite: metr.taux_immobilite ?? 0,
        linearite:       metr.linearite       ?? 0,
        temps_jusqua_immobilite: metr.temps_jusqua_immobilite ?? 0,
        ratio_mouvement_arret:   metr.ratio_mouvement_arret ?? 0,
        nb_bouts:                metr.nb_bouts ?? 0,
        dist_ruche_mean:         metr.dist_ruche_mean ?? 0,
        nb_visites_plantes:      metr.nb_visites_plantes ?? 0,
        temps_proche_plantes:    metr.temps_proche_plantes ?? 0,
        retour_ruche:            metr.retour_ruche ?? 0,
      },
    });
  }
  return { flowers, ruche, worldSize, bees };
}

//RENDU 3D
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
  //Grille
  ctx.strokeStyle=C.border; ctx.lineWidth=.5;
  for(let i=0;i<=8;i++){
    const xi=worldSize[0]*i/8, yi=worldSize[1]*i/8;
    const p1=proj({x:xi,y:0,z:0}),p2=proj({x:xi,y:worldSize[1],z:0});
    const q1=proj({x:0,y:yi,z:0}),q2=proj({x:worldSize[0],y:yi,z:0});
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(q1.x,q1.y);ctx.lineTo(q2.x,q2.y);ctx.stroke();
  }
  //Plantes
  flowers.forEach(([fx,fy,fz,fid])=>{
    const p=proj({x:fx,y:fy,z:fz});
    ctx.fillStyle="#fbbf24"; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle="#000"; ctx.font="bold 7px DM Sans"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(`F${fid+1}`,p.x,p.y);
  });
  //Ruches
  [[rucheT,C.temoin,"T"],[rucheE,C.expose,"E"]].forEach(([r,col,lbl])=>{
    if(!r) return;
    const p=proj({x:r[0],y:r[1],z:r[2]});
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#fff"; ctx.font="bold 8px DM Sans"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🏠",p.x,p.y);
    ctx.fillStyle=col; ctx.font="bold 8px DM Sans"; ctx.textAlign="left"; ctx.textBaseline="bottom";
    ctx.fillText("Ruche "+lbl,p.x+9,p.y-2);
  });
  //Trajectoires
  const hasSel = selIds.size > 0;
  bees.forEach(bee => {
    if (!bee.points.length) return;
    const pr = bee.points.map(p => proj(p));
    const isSel = selIds.has(bee.id), isHov = hoverBee===bee.id;

    //couleur selon mode
    let col;
    const pbee = mlData?.svm?.per_bee?.[bee.id];
    if (colorMode === "normal" && pbee) {
      col = pbee.is_normal ? C.normal : C.abnorm;
    } else {
      col = bee.group === "temoin" ? C.temoin : C.expose;
    }

    ctx.lineWidth = isSel?2.5:isHov?2:1;
    ctx.strokeStyle = col;
    ctx.globalAlpha = hasSel?(isSel?.9:.07):(isHov?.8:.4);
    ctx.setLineDash(bee.group==="expose"?[4,4]:[]);
    ctx.beginPath(); pr.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = hasSel?(isSel?1:.1):1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(pr[0].x,pr[0].y,3,0,2*Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(pr[pr.length-1].x,pr[pr.length-1].y,isSel?5:3,0,2*Math.PI); ctx.fill();
    ctx.globalAlpha=1;
  });
}

//CANVA PCA + SVM
function PcaSvmCanvas({ mlData, colorMode, selIds, onClickBee }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !mlData?.svm?.per_bee) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    ctx.fillStyle = C.panel; ctx.fillRect(0,0,W,H);

    const per_bee = mlData.svm.per_bee;
    const bees_data = Object.entries(per_bee);
    const xs = bees_data.map(([,b])=>b.pca_x);
    const ys = bees_data.map(([,b])=>b.pca_y);
    const { xx, yy, Z_prob, x1_range, x2_range } = mlData.svm.boundary;

    const pad = {l:48, r:16, t:20, b:44};
    const toX = v => pad.l + (v-x1_range[0])/(x1_range[1]-x1_range[0])*(W-pad.l-pad.r);
    const toY = v => H-pad.b - (v-x2_range[0])/(x2_range[1]-x2_range[0])*(H-pad.t-pad.b);

    const res = Z_prob.length;
    const cw = (W-pad.l-pad.r)/res, ch = (H-pad.t-pad.b)/res;
    Z_prob.forEach((row, ri) => row.forEach((p, ci) => {
      const px = pad.l + ci*cw, py = H-pad.b - (ri+1)*ch;
      const r = Math.floor(p*220), g = Math.floor((1-p)*180);
      ctx.fillStyle = `rgba(${r},${g},60,0.18)`;
      ctx.fillRect(px, py, cw+1, ch+1);
    }));

    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.setLineDash([5,3]);
    for (let ri=0; ri<res-1; ri++) for (let ci=0; ci<res-1; ci++) {
      const p00=Z_prob[ri][ci], p10=Z_prob[ri+1][ci];
      if ((p00<.5&&p10>=.5)||(p00>=.5&&p10<.5)) {
        const px1=pad.l+ci*cw+cw/2, py1=H-pad.b-(ri)*ch-ch/2;
        const px2=pad.l+ci*cw+cw/2, py2=H-pad.b-(ri+1)*ch-ch/2;
        ctx.beginPath();ctx.moveTo(px1,py1);ctx.lineTo(px2,py2);ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    ctx.strokeStyle=C.border; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,H-pad.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l,H-pad.b); ctx.lineTo(W-pad.r,H-pad.b); ctx.stroke();

    //Labels axes
    const varE = mlData.pca.variance_explained;
    ctx.fillStyle=C.muted; ctx.font="10px DM Sans"; ctx.textAlign="center";
    ctx.fillText(`PC1 (${(varE[0]*100).toFixed(1)}%)`, (pad.l+W-pad.r)/2, H-10);
    ctx.save(); ctx.translate(12, (pad.t+H-pad.b)/2); ctx.rotate(-Math.PI/2);
    ctx.fillText(`PC2 (${(varE[1]*100).toFixed(1)}%)`, 0, 0); ctx.restore();

    //Points
    bees_data.forEach(([id, b]) => {
      const px = toX(b.pca_x), py = toY(b.pca_y);
      const isSel = selIds?.has(id);

      let col;
      if (colorMode === "normal") {
        col = b.is_normal ? C.normal : C.abnorm;
      } else if (colorMode === "group") {
        col = b.group === 0 ? C.temoin : C.expose;
      } else {
        col = b.group === 0 ? C.temoin : C.expose;
      }

      ctx.fillStyle = col;
      ctx.strokeStyle = isSel ? C.accent : "#fff";
      ctx.lineWidth = isSel ? 2.5 : 1.2;
      ctx.globalAlpha = 0.9;

      //cercle=témoin et triangle=exposé
      ctx.beginPath();
      if (b.group === 0) {
        ctx.arc(px, py, isSel?8:6, 0, 2*Math.PI);
      } else {
        const s=isSel?8:6;
        ctx.moveTo(px,py-s); ctx.lineTo(px+s,py+s); ctx.lineTo(px-s,py+s);
        ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha=1;

      ctx.fillStyle = C.text; ctx.font="bold 9px DM Mono"; ctx.textAlign="center";
      ctx.fillText(id.replace("BE-",""), px, py-11);
    });
  }, [mlData, colorMode, selIds]);

  const handleClick = useCallback(e => {
    if (!ref.current || !mlData?.svm?.per_bee) return;
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const W = ref.current.offsetWidth, H = ref.current.offsetHeight;
    const { x1_range, x2_range } = mlData.svm.boundary;
    const pad = {l:48, r:16, t:20, b:44};
    const toX = v => pad.l + (v-x1_range[0])/(x1_range[1]-x1_range[0])*(W-pad.l-pad.r);
    const toY = v => H-pad.b - (v-x2_range[0])/(x2_range[1]-x2_range[0])*(H-pad.t-pad.b);
    let best=null, bestD=16;
    Object.entries(mlData.svm.per_bee).forEach(([id,b]) => {
      const d=Math.hypot(toX(b.pca_x)-mx, toY(b.pca_y)-my);
      if(d<bestD){bestD=d;best=id;}
    });
    if(best) onClickBee(best, e);
  }, [mlData, onClickBee]);

  if (!mlData?.svm?.per_bee) return (
    <div className="no-data"><span style={{fontSize:26}}>📊</span><span>Chargez les deux fichiers JSON<br/>pour voir le graphe PCA + SVM.</span></div>
  );
  return <canvas ref={ref} style={{width:"100%",height:"100%",position:"absolute",top:0,left:0,cursor:"crosshair"}} onClick={handleClick}/>;
}

//ONGLET FEATURES
function FeatDiscTab({ mlData }) {
  const [sort, setSort] = useState("effect");
  if (!mlData?.feature_discrimination) return (
    <div className="no-data"><span style={{fontSize:26}}>🔬</span><span>Chargez les deux groupes pour<br/>voir la discrimination des features.</span></div>
  );
  const disc = mlData.feature_discrimination;
  const items = Object.entries(disc).map(([k,v])=>({k,...v}))
    .sort((a,b)=> sort==="effect" ? Math.abs(b.effect_size_rb)-Math.abs(a.effect_size_rb)
                 : sort==="pval"  ? a.p_mannwhitney-b.p_mannwhitney
                 : Math.abs(b.pc1_loading)-Math.abs(a.pc1_loading));
  const maxRB = Math.max(...items.map(i=>Math.abs(i.effect_size_rb)), 0.01);

  return (
    <div style={{padding:16, overflowY:"auto", height:"100%"}}>
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,marginBottom:4}}>Discrimination des features</div>
      <div style={{color:C.muted,fontSize:11,marginBottom:12,lineHeight:1.6}}>
        Quelles features distinguent le mieux les comportements normal/exposé ?<br/>
        Basé sur Mann-Whitney U, rank-biserial correlation, et loadings PCA.
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
        <span style={{fontSize:10,color:C.muted}}>Trier par :</span>
        {[["effect","Effect size"],["pval","p-value"],["pc1","PC1 loading"]].map(([v,lbl])=>(
          <button key={v} className={`btn ${sort===v?"on":""}`} onClick={()=>setSort(v)}>{lbl}</button>
        ))}
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Effect size</th>
            <th>p (Mann-W)</th>
            <th>PC1</th>
            <th>Moy T</th>
            <th>Moy E</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({k,effect_size_rb,p_mannwhitney,pc1_loading,mean_temoin,mean_expose})=>{
            const sigCol = p_mannwhitney<.05?C.expose:p_mannwhitney<.1?C.orange:C.muted;
            const rb = effect_size_rb;
            const rbW = Math.abs(rb)/maxRB*60;
            return (
              <tr key={k}>
                <td style={{color:C.text,fontFamily:"DM Sans",fontWeight:500,fontSize:10}}>{FEAT_LABELS[k]||k}</td>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:60,height:8,background:C.bg,borderRadius:2,border:`1px solid ${C.border}`,overflow:"hidden",position:"relative"}}>
                      <div style={{width:`${rbW}px`,height:"100%",background:rb>=0?C.expose:C.temoin,position:"absolute",left:rb>=0?"50%":undefined,right:rb<0?"50%":undefined,borderRadius:1}}/>
                      <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:C.border}}/>
                    </div>
                    <span style={{fontSize:9,fontFamily:"DM Mono",color:Math.abs(rb)>.3?C.text:C.muted}}>
                      {rb>=0?"+":""}{rb.toFixed(2)}
                    </span>
                  </div>
                </td>
                <td><span style={{color:sigCol,fontWeight:p_mannwhitney<.05?700:400,fontSize:10}}>{p_mannwhitney<.001?"<0.001":p_mannwhitney.toFixed(3)}</span></td>
                <td><span style={{color:Math.abs(pc1_loading)>.2?C.accent:C.muted,fontWeight:Math.abs(pc1_loading)>.2?700:400}}>{pc1_loading>=0?"+":""}{pc1_loading.toFixed(3)}</span></td>
                <td style={{color:C.temoin}}>{mean_temoin.toFixed(4)}</td>
                <td style={{color:C.expose}}>{mean_expose.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{marginTop:16,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:10,fontSize:10,color:C.muted,lineHeight:1.7}}>
        <strong style={{color:C.text}}>Lecture :</strong> Effect size (rank-biserial) : &gt;0 = feature plus élevée chez les exposés.
        |rb| &gt; 0.5 = effet large, &gt; 0.3 = moyen, &lt; 0.1 = faible.
        PC1 loading : contribution de cette feature au premier axe PCA.
      </div>
    </div>
  );
}

//ONGLET IMPACT
function ImpactTab({ bees, mlData }) {
  const tBees = bees.filter(b=>b.group==="temoin");
  const eBees = bees.filter(b=>b.group==="expose");
  const avg=(arr,k)=>{const v=arr.map(b=>b.stats[k]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
  const sm=(a,b)=>Math.max(a??0,b??0)*1.2||1;
  const disc = mlData?.feature_discrimination || {};
  if(!tBees.length&&!eBees.length) return <div className="no-data"><span>Chargez les deux fichiers.</span></div>;

  const keys = Object.keys(FEAT_LABELS);
  const mT={}, mE={};
  keys.forEach(k=>{mT[k]=avg(tBees,k);mE[k]=avg(eBees,k);});

  const sortedKeys = [...keys].sort((a,b)=>
    Math.abs(disc[b]?.effect_size_rb||0)-Math.abs(disc[a]?.effect_size_rb||0));

  return (
    <div style={{padding:16,overflowY:"auto",height:"100%"}}>
      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,marginBottom:4}}>Profil comparatif</div>
      <div style={{color:C.muted,fontSize:11,marginBottom:16,lineHeight:1.6}}>Triées par effect size (plus discriminantes en premier)</div>
      {sortedKeys.map(k=>{
        const tV=mT[k], eV=mE[k], mx=sm(tV,eV);
        const fd=disc[k];
        const p=fd?.p_mannwhitney, rb=fd?.effect_size_rb;
        const sigCol=p!=null?(p<.05?C.expose:p<.1?C.orange:C.muted):C.muted;
        return (
          <div key={k} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px",marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:500,color:C.text}}>{FEAT_LABELS[k]}</span>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {rb!=null&&<span style={{fontSize:9,fontFamily:"DM Mono",color:C.muted}}>rb={rb>=0?"+":""}{rb.toFixed(2)}</span>}
                {p!=null&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,fontWeight:700,
                  background:p<.05?"rgba(239,68,68,.1)":p<.1?"rgba(245,158,11,.1)":"rgba(0,0,0,.04)",color:sigCol}}>
                  {p<.001?"p<0.001":"p="+p.toFixed(3)}
                </span>}
              </div>
            </div>
            {[["Témoin",tV,C.temoin],[" Exposé",eV,C.expose]].map(([lbl,v,col])=>(
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{width:52,fontSize:9,color:col,fontWeight:700,textAlign:"right",fontFamily:"DM Mono"}}>{lbl}</span>
                <div style={{flex:1,height:8,background:C.panel,borderRadius:3,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                  <div style={{width:`${mx>0?(v??0)/mx*100:0}%`,height:"100%",background:col,opacity:.8,borderRadius:3}}/>
                </div>
                <span style={{width:52,fontSize:9,color:C.muted,fontFamily:"DM Mono"}}>{v!=null?v.toFixed(4):"—"}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

//COMPOSANTE PRINCIPALE
export default function BourdonTracker() {
  const [bees,       setBees]       = useState([]);
  const [flowersT,   setFlowersT]   = useState([]);
  const [flowersE,   setFlowersE]   = useState([]);
  const [rucheT,     setRucheT]     = useState(null);
  const [rucheE,     setRucheE]     = useState(null);
  const [worldSize,  setWorldSize]  = useState([2.5,2.5,1.8]);
  const [selIds,     setSelIds]     = useState(new Set());
  const [hoverBee,   setHoverBee]   = useState(null);
  const [tab,        setTab]        = useState("map");
  const [mlData,     setMlData]     = useState(null);
  const [colorMode,  setColorMode]  = useState("group"); // "group" | "normal"
  const [pcaColor,   setPcaColor]   = useState("group");

  const [panX,setPanX]=useState(0),[panY,setPanY]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [rotX,setRotX]=useState(0),[rotY,setRotY]=useState(0);
  const [isDrag,setIsDrag]=useState(false),[dSt,setDSt]=useState(null);
  const [rawT,setRawT]=useState(null),[rawE,setRawE]=useState(null);
  const [processed,setProcessed]=useState(false),[loading,setLoading]=useState(false);

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
      setBees([]); setSelIds(new Set()); setMlData(null);
      try { await fetch("http://localhost:5000/reset",{method:"POST"}); } catch{}
      const [eT,eE] = await Promise.all([uploadJson(rawT,"temoin"),uploadJson(rawE,"expose")]);
      const ml = eT._ml || eE._ml || null;
      if(ml) setMlData(ml);
      const dT=parseJSON(eT,"temoin"), dE=parseJSON(eE,"expose");
      setBees([...dT.bees,...dE.bees]);
      setFlowersT(dT.flowers); setFlowersE(dE.flowers);
      setRucheT(dT.ruche); setRucheE(dE.ruche);
      setWorldSize(dT.worldSize);
      setProcessed(true); setLoading(false);
    })();
  },[rawT,rawE,processed,uploadJson]);

  useEffect(()=>{
    if(cvRef.current) render3D(cvRef.current,bees,allFlowers,rucheT,rucheE,worldSize,selIds,hoverBee,panX,panY,zoom,rotX,rotY,colorMode,mlData);
  },[bees,allFlowers,rucheT,rucheE,worldSize,selIds,hoverBee,panX,panY,zoom,rotX,rotY,colorMode,mlData]);

  useEffect(()=>{
    if(!heatRef.current) return;
    const canvas=heatRef.current;
    const ctx=canvas.getContext("2d");
    const W=canvas.width=canvas.offsetWidth, H=canvas.height=canvas.offsetHeight;
    ctx.fillStyle="#1a1a2e"; ctx.fillRect(0,0,W,H);
    const active=selIds.size>0?bees.filter(b=>selIds.has(b.id)):bees;
    if(!active.length) return;
    const density=new Float32Array(W*H), sigma=Math.max(W,H)*.016;
    active.forEach(bee=>bee.points.forEach(p=>{
      const px=(p.x/worldSize[0])*W, py=(p.y/worldSize[1])*H;
      const r=sigma*2.5;
      const x0=Math.max(0,Math.floor(px-r)),x1=Math.min(W,Math.ceil(px+r));
      const y0=Math.max(0,Math.floor(py-r)),y1=Math.min(H,Math.ceil(py+r));
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
        density[y*W+x]+=Math.exp(-((x-px)**2+(y-py)**2)/(2*sigma*sigma));
      }
    }));
    const maxD=Math.max(...density)||1;
    const img=ctx.createImageData(W,H);
    for(let i=0;i<W*H;i++){
      const n=Math.sqrt(density[i]/maxD);
      let r,g,b;
      if(n<.25){const t=n/.25;r=0;g=Math.floor(80+t*120);b=255;}
      else if(n<.5){const t=(n-.25)/.25;r=0;g=255;b=Math.floor(255*(1-t));}
      else if(n<.75){const t=(n-.5)/.25;r=Math.floor(t*255);g=255;b=0;}
      else{const t=(n-.75)/.25;r=255;g=Math.floor(255*(1-t*.6));b=0;}
      img.data[i*4]=r;img.data[i*4+1]=g;img.data[i*4+2]=b;img.data[i*4+3]=200;
    }
    ctx.putImageData(img,0,0);
  },[bees,allFlowers,worldSize,selIds]);

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

  const tBees=bees.filter(b=>b.group==="temoin");
  const eBees=bees.filter(b=>b.group==="expose");
  const normalBees =bees.filter(b=>mlData?.svm?.per_bee?.[b.id]?.is_normal===true);
  const abnormBees =bees.filter(b=>mlData?.svm?.per_bee?.[b.id]?.is_normal===false);
  const selBee=useMemo(()=>{const id=[...selIds][0];return bees.find(b=>b.id===id)||null;},[bees,selIds]);

  const TABS=[["map","3D"],["pca","PCA + SVM"],["feat","Features"],["impact","Impact"],["bee","Individu"]];

  const selGroups = [
    ["Tous", ()=>new Set(bees.map(b=>b.id)), C.muted],
    [`T (${tBees.length})`, ()=>new Set(tBees.map(b=>b.id)), C.temoin],
    [`E (${eBees.length})`, ()=>new Set(eBees.map(b=>b.id)), C.expose],
    ...(mlData ? [
      [`Normal (${normalBees.length})`, ()=>new Set(normalBees.map(b=>b.id)), C.normal],
      [`Anormal (${abnormBees.length})`, ()=>new Set(abnormBees.map(b=>b.id)), C.abnorm],
    ] : []),
  ];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="hdr">
          <h1>BOURDONS</h1>
          {loading&&<span style={{marginLeft:"auto",fontSize:10,color:C.accent,fontWeight:700,fontFamily:"DM Mono"}}>⟳ Calcul ML…</span>}
        </div>

        <div className="main">
          <div className="side">
            <div className="sec">
              <div className="sec-title">Données</div>
              {[["Témoin",true,C.temoin],["Exposé",false,C.expose]].map(([lbl,isT,col])=>(
                <div key={lbl} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:9,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
                    <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{lbl}</span>
                  </div>
                  <input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0],isT)}
                    style={{fontSize:10,width:"100%",cursor:"pointer"}}/>
                </div>
              ))}
            </div>

            <div className="sec">
              <div className="sec-title">Sélection</div>
              <div className="btn-grp">
                {selGroups.map(([lbl,fn,col])=>(
                  <button key={lbl} className="btn" onClick={()=>setSelIds(fn())}
                    style={{borderColor:col,color:col}}>{lbl}</button>
                ))}
                {selIds.size>0&&<button className="btn" onClick={()=>setSelIds(new Set())} style={{color:C.muted}}>Désélectionner</button>}
              </div>
              {selIds.size>0&&<div style={{fontSize:9,color:C.muted,marginTop:6,fontFamily:"DM Mono"}}>{selIds.size} sélectionné(s)</div>}
            </div>

            <div className="sec">
              <div className="sec-title">Couleur trajectoires</div>
              <div className="btn-grp">
                <button className={`btn ${colorMode==="group"?"on":""}`} onClick={()=>setColorMode("group")}>Groupe</button>
                <button className={`btn ${colorMode==="normal"?"on":""}`} onClick={()=>setColorMode("normal")} disabled={!mlData}>Normal/Anormal</button>
              </div>
            </div>

            <div className="sec" style={{flex:1,overflowY:"auto"}}>
              <div className="sec-title">Individus ({bees.length})</div>
              {bees.map(bee=>{
                const pb=mlData?.svm?.per_bee?.[bee.id];
                return (
                  <div key={bee.id} className={`bee-item ${selIds.has(bee.id)?"sel":""}`}
                    onClick={e=>selectBee(bee.id,e)}
                    onMouseEnter={()=>setHoverBee(bee.id)} onMouseLeave={()=>setHoverBee(null)}>
                    <span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                      background:colorMode==="normal"&&pb ? (pb.is_normal?C.normal:C.abnorm)
                                :(bee.group==="temoin"?C.temoin:C.expose)}}/>
                    <span style={{flex:1,fontSize:11,fontWeight:600}}>{bee.id}</span>
                    {pb&&<span className="chip" style={{
                      background:pb.is_normal?"rgba(16,185,129,.1)":"rgba(249,115,22,.1)",
                      color:pb.is_normal?C.normal:C.abnorm}}>
                      {pb.is_normal?"normal":"anormal"}
                    </span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="center">
            <div className="tabs">
              {TABS.map(([k,lbl])=>(
                <div key={k} className={`tab ${tab===k?"on":""}`} onClick={()=>setTab(k)}>{lbl}</div>
              ))}
            </div>

            {tab==="map"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div className="cvs-wrap" style={{flex:2}}>
                  <canvas ref={cvRef} style={{cursor:isDrag?"grabbing":"grab"}}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={()=>setIsDrag(false)} onMouseLeave={()=>setIsDrag(false)}
                    onWheel={handleWheel}
                    onDoubleClick={()=>{setPanX(0);setPanY(0);setZoom(1);setRotX(0);setRotY(0);}}/>
                  <div style={{position:"absolute",bottom:8,left:8,background:"rgba(0,0,0,.55)",color:"#fff",
                    padding:"4px 8px",borderRadius:4,fontSize:9,fontFamily:"DM Mono",pointerEvents:"none"}}>
                    Glisser=rotation · Shift+Glisser=déplacement · Scroll=zoom · Dbl-clic=reset
                  </div>
                </div>
                <div className="cvs-wrap" style={{flex:1,borderTop:`1px solid ${C.border}`}}>
                  <canvas ref={heatRef}/>
                </div>
              </div>
            )}

            {tab==="pca"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div style={{padding:"7px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:10,color:C.muted}}>Couleur :</span>
                  <div className="btn-grp">
                    <button className={`btn ${pcaColor==="group"?"on":""}`} onClick={()=>setPcaColor("group")}>Témoin / Exposé</button>
                    <button className={`btn ${pcaColor==="normal"?"on":""}`} onClick={()=>setPcaColor("normal")}>Normal / Anormal</button>
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:9,color:C.muted}}>
                    <span>● Témoin</span>
                    <span>▲ Exposé</span>
                    <span style={{color:"#555"}}>--- Frontière SVM</span>
                  </div>
                </div>
                <div className="cvs-wrap" style={{flex:1}}>
                  <PcaSvmCanvas mlData={mlData} colorMode={pcaColor} selIds={selIds} onClickBee={selectBee}/>
                </div>
                {mlData?.svm&&(
                  <div style={{padding:"6px 14px",borderTop:`1px solid ${C.border}`,display:"flex",gap:16,fontSize:10,color:C.muted,flexShrink:0}}>
                    <span>Accuracy LOO : <strong style={{color:mlData.svm.accuracy_loo>.7?C.green:C.orange}}>{(mlData.svm.accuracy_loo*100).toFixed(1)}%</strong></span>
                    <span>AUC LOO : <strong style={{color:mlData.svm.auc_loo>.7?C.green:C.orange}}>{(mlData.svm.auc_loo*100).toFixed(1)}%</strong></span>
                    <span style={{color:C.normal}}>● Normal : {mlData.n_normal}</span>
                    <span style={{color:C.abnorm}}>● Anormal : {mlData.n_abnormal}</span>
                  </div>
                )}
              </div>
            )}

            {tab==="feat"&&<div style={{flex:1,overflowY:"auto"}}><FeatDiscTab mlData={mlData}/></div>}

            {tab==="impact"&&<div style={{flex:1,overflowY:"auto"}}><ImpactTab bees={bees} mlData={mlData}/></div>}

            {tab==="bee"&&(
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                {selBee?(()=>{
                  const pb=mlData?.svm?.per_bee?.[selBee.id];
                  return (
                    <div style={{maxWidth:480}}>
                      <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,marginBottom:4}}>
                        {selBee.id}
                        <span style={{marginLeft:8,fontSize:11,color:selBee.group==="temoin"?C.temoin:C.expose}}>{selBee.group.toUpperCase()}</span>
                        {pb&&<span className="chip" style={{marginLeft:8,background:pb.is_normal?"rgba(16,185,129,.12)":"rgba(249,115,22,.12)",color:pb.is_normal?C.normal:C.abnorm}}>{pb.is_normal?"NORMAL":"ANORMAL"}</span>}
                      </div>
                      {pb&&(
                        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:10,marginBottom:12}}>
                          {[["Prédiction SVM",pb.is_normal?"Normal (0)":"Anormal (1)"],
                            ["Probabilité exposé",(pb.svm_proba*100).toFixed(1)+"%"],
                            ["Distance frontière",pb.dist_frontier.toFixed(4)],
                            ["PC1",pb.pca_x.toFixed(4)],["PC2",pb.pca_y.toFixed(4)]
                          ].map(([l,v])=>(
                            <div key={l} className="sr"><span className="sl">{l}</span><span className="sv">{v}</span></div>
                          ))}
                        </div>
                      )}
                      <div style={{fontFamily:"Syne",fontWeight:700,fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Features calculées</div>
                      {Object.entries(FEAT_LABELS).map(([k,lbl])=>{
                        const v=selBee.stats[k];
                        const fd=mlData?.feature_discrimination?.[k];
                        const p=fd?.p_mannwhitney;
                        return (
                          <div key={k} className="sr">
                            <span className="sl">{lbl}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              {p!=null&&p<.1&&<span style={{fontSize:8,color:p<.05?C.expose:C.orange}}>p={p.toFixed(3)}</span>}
                              <span className="sv">{typeof v==="number"?v.toFixed(5):v}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })():(
                  <div className="no-data"><span style={{fontSize:24}}>!</span><span>Sélectionnez un bourdon dans la liste.</span></div>
                )}
              </div>
            )}
          </div>

          <div className="right">
            <div className="sec-title">Résumé</div>
            {[["Total",bees.length,C.text],["Témoins",tBees.length,C.temoin],["Exposés",eBees.length,C.expose]].map(([l,v,c])=>(
              <div key={l} className="sr"><span className="sl">{l}</span><span className="sv" style={{color:c}}>{v}</span></div>
            ))}

            {mlData&&(
              <></>
            )}
            {!mlData&&<div style={{color:C.muted,fontSize:11,lineHeight:1.7,marginTop:8}}>Chargez les deux fichiers JSON pour démarrer l'analyse.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
