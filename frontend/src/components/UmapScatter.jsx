import { useEffect, useRef, useState } from 'react';
import { C, FEAT_LABELS } from '../config/theme';

function convexHull(points) {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export default function UmapScatter({ clustering, selIds, onClickPoint }) {
  const ref = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const canvas = ref.current; if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth; const H = canvas.height = canvas.offsetHeight;
    ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
    if(!clustering) return;

    // Prefer UMAP 2d if available, otherwise fallback to PCA 2D coordinates
    let pts = clustering.umap_2d;
    let ids = clustering.ids;
    if ((!pts || !pts.length) && clustering.pca?.pca_per_bee) {
      const p = clustering.pca.pca_per_bee;
      ids = clustering.ids || Object.keys(p || {});
      pts = ids.map(id => [Number(p[id]?.pca_x || 0), Number(p[id]?.pca_y || 0)]);
    }
    if(!pts || !pts.length) return;

    const labs = clustering.cluster_labels || clustering.labels || [];
    const xs = pts.map(p=>p[0]); const ys = pts.map(p=>p[1]);
    const xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
    const toX = v => 20 + (v-xmin)/(xmax-xmin||1)*(W-40);
    const toY = v => 20 + (1 - (v-ymin)/(ymax-ymin||1))*(H-40);
    const colors = [C.temoin,C.expose,C.purple,C.teal,C.orange,"#888"];

    // enveloppes convexes + centroïdes par cluster
    const byLabel = new Map();
    pts.forEach((p, i) => {
      const lab = labs[i];
      if (lab == null || lab === -1) return;
      if (!byLabel.has(lab)) byLabel.set(lab, []);
      byLabel.get(lab).push([toX(p[0]), toY(p[1])]);
    });
    byLabel.forEach((xy, lab) => {
      const col = colors[(lab % colors.length)];
      const hull = convexHull(xy);
      if (hull.length > 2) {
        ctx.beginPath();
        hull.forEach(([hx, hy], i) => i ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy));
        ctx.closePath();
        ctx.fillStyle = `${col}1f`;
        ctx.fill();
        ctx.strokeStyle = `${col}99`;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const cx = xy.reduce((s, p) => s + p[0], 0) / xy.length;
      const cy = xy.reduce((s, p) => s + p[1], 0) / xy.length;
      ctx.fillStyle = col;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    });

    pts.forEach((p,i)=>{
      const lab = labs[i];
      const id = ids?.[i];
      const isSel = selIds?.has(id);
      const x = toX(p[0]), y = toY(p[1]);
      const hasSel = selIds?.size > 0;
      ctx.globalAlpha = hasSel ? (isSel ? 1 : 0.15) : (lab===-1?0.6:0.95);
      ctx.beginPath(); ctx.arc(x,y, isSel ? (lab===-1?6:9) : (lab===-1?3:6),0,2*Math.PI);
      ctx.fillStyle = lab===-1? '#999' : colors[(lab%colors.length)];
      ctx.fill();
      if (isSel) { ctx.strokeStyle = C.text; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
  }, [clustering, selIds]);

  const handleMove = e => {
    const canvas = ref.current; if(!canvas || !clustering) return;
    const rect = canvas.getBoundingClientRect(); const mx = e.clientX-rect.left, my = e.clientY-rect.top;

    let pts = clustering.umap_2d;
    let ids = clustering.ids;
    if ((!pts || !pts.length) && clustering.pca?.pca_per_bee) {
      const p = clustering.pca.pca_per_bee;
      ids = clustering.ids || Object.keys(p || {});
      pts = ids.map(id => [Number(p[id]?.pca_x || 0), Number(p[id]?.pca_y || 0)]);
    }
    if(!pts || !pts.length) return;

    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const xs = pts.map(p=>p[0]); const ys = pts.map(p=>p[1]);
    const xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
    const toX = v => 20 + (v-xmin)/(xmax-xmin||1)*(W-40);
    const toY = v => 20 + (1 - (v-ymin)/(ymax-ymin||1))*(H-40);
    let best=null, bd=12;
    pts.forEach((p,i)=>{ const d=Math.hypot(toX(p[0])-mx,toY(p[1])-my); if(d<bd){bd=d;best=i;} });
    if(best!=null){
      const id = (clustering.ids && clustering.ids[best]) || (clustering.ids ? clustering.ids[best] : best);
      const per = clustering.per_sample_shap?.[id] || {};
      const top5 = Object.entries(per).map(([f,v])=>({f,v})).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,5);
      setTooltip({x:mx+10,y:my+10,id,lab:clustering.cluster_labels?.[best] ?? clustering.labels?.[best],top5});
    } else setTooltip(null);
  };

  const handleClick = e => { if(!tooltip) return; onClickPoint && onClickPoint(tooltip.id, e); };

  return <div style={{width:'100%',height:'100%',position:'relative'}}>
    <canvas ref={ref} style={{width:'100%',height:'100%'}} onMouseMove={handleMove} onClick={handleClick}/>
    {tooltip && (
      <div style={{position:'absolute',left:tooltip.x,top:tooltip.y,background:'rgba(0,0,0,0.8)',color:'#fff',padding:8,borderRadius:6,fontSize:12,zIndex:10}}>
        <div style={{fontWeight:700,marginBottom:6}}>ID: {tooltip.id} - {tooltip.lab===-1?"Non classée":"Groupe "+tooltip.lab}</div>
        <div style={{fontSize:12}}>
          {tooltip.top5.length?tooltip.top5.map(({f,v})=>(<div key={f} style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <div style={{flex:1}}>{FEAT_LABELS[f]||f}</div>
            <div style={{width:60,textAlign:'right'}}>{v>=0?'+':''}{(v||0).toFixed(4)}</div>
          </div>)):(<div style={{color:'#ccc'}}>Pas d'influence disponible</div>)}
        </div>
      </div>
    )}
  </div>;
}
