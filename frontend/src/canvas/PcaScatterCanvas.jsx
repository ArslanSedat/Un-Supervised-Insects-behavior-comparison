import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, FEAT_LABELS } from '../config/theme';
import { clusterColor, colorForGroup, idGroupOfId } from '../utils/groups';

function shortLabel(name, max = 26) {
  const label = FEAT_LABELS[name] || name;
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function getAllVectors(mlData) {
  const loadings = mlData?.pca?.loadings || {};
  return Object.entries(loadings)
    .map(([feature, v]) => ({
      feature,
      pc1: Number(v?.pc1 || 0),
      pc2: Number(v?.pc2 || 0),
      norm: Math.hypot(Number(v?.pc1 || 0), Number(v?.pc2 || 0)),
    }))
    .filter(v => Number.isFinite(v.norm) && v.norm > 0)
    .sort((a, b) => b.norm - a.norm);
}

export default function PcaScatterCanvas({ mlData, colorMode, selIds, onClickBee, showBiplot = true }) {
  const ref = useRef(null);
  const [hoverFeature, setHoverFeature] = useState(null);
  const vectors = useMemo(() => getAllVectors(mlData), [mlData]);

  const getLayout = useCallback((canvas) => {
    const perBee = mlData?.per_bee || {};
    const entries = Object.entries(perBee);
    const xs = entries.map(([, b]) => Number(b.pca_x ?? 0));
    const ys = entries.map(([, b]) => Number(b.pca_y ?? 0));
    vectors.forEach(v => { xs.push(v.pc1 * 3.2); ys.push(v.pc2 * 3.2); });

    const xmin0 = Math.min(...xs);
    const xmax0 = Math.max(...xs);
    const ymin0 = Math.min(...ys);
    const ymax0 = Math.max(...ys);

    const rx = Math.max(Math.abs(xmin0), Math.abs(xmax0), 0.5);
    const ry = Math.max(Math.abs(ymin0), Math.abs(ymax0), 0.5);

    const xpad = Math.max(rx * 0.08, 0.5);
    const ypad = Math.max(ry * 0.08, 0.5);

    const xmin = -rx - xpad;
    const xmax =  rx + xpad;
    const ymin = -ry - ypad;
    const ymax =  ry + ypad;

    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const pad = { l:54, r:showBiplot ? 230 : 18, t:24, b:50 };
    const dx = xmax - xmin || 1;
    const dy = ymax - ymin || 1;
    const toX = v => pad.l + ((v - xmin) / dx) * (W - pad.l - pad.r);
    const toY = v => H - pad.b - ((v - ymin) / dy) * (H - pad.t - pad.b);
    return { entries, W, H, pad, toX, toY, xmin, xmax, ymin, ymax };
  }, [mlData, vectors, showBiplot]);

  useEffect(() => {
    if (!ref.current || !mlData?.per_bee) return;
    try {
      const canvas = ref.current;
      const ctx = canvas.getContext('2d');
      const { entries, W, H, pad, toX, toY, xmin, xmax, ymin, ymax } = getLayout(canvas);
      canvas.width = W; canvas.height = H;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();

      const zeroX = toX(0);
      const zeroY = toY(0);
      if (zeroX > pad.l && zeroX < W - pad.r) {
        ctx.strokeStyle = `${C.border}88`;
        ctx.beginPath(); ctx.moveTo(zeroX, pad.t); ctx.lineTo(zeroX, H - pad.b); ctx.stroke();
      }
      if (zeroY > pad.t && zeroY < H - pad.b) {
        ctx.strokeStyle = `${C.border}88`;
        ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(W - pad.r, zeroY); ctx.stroke();
      }

      const varE = mlData.pca?.variance_explained || [0, 0];
      ctx.fillStyle = C.muted; ctx.font = "12px 'Times New Roman'"; ctx.textAlign = 'center';
      ctx.fillText(`PC1 (${((varE[0] || 0) * 100).toFixed(1)}%)`, (pad.l + W - pad.r) / 2, H - 14);
      ctx.save(); ctx.translate(15, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText(`PC2 (${((varE[1] || 0) * 100).toFixed(1)}%)`, 0, 0); ctx.restore();

      if (showBiplot && vectors.length) {
        const maxNorm = Math.max(...vectors.map(v => v.norm), 1e-9);
        const ox = toX(0), oy = toY(0);

        vectors.forEach(v => {
          const isHover = hoverFeature === v.feature;
          const hiddenByHover = hoverFeature && !isHover;
          const arrowLen = Math.min(xmax - xmin, ymax - ymin) * 0.22;
          const vectorScale = arrowLen / maxNorm;

          const ex = toX(v.pc1 * vectorScale);
          const ey = toY(v.pc2 * vectorScale);

          ctx.globalAlpha = hiddenByHover ? 0.14 : 0.88;
          ctx.strokeStyle = isHover ? C.accent : C.text;
          ctx.fillStyle = isHover ? C.accent : C.text;
          ctx.lineWidth = isHover ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          const angle = Math.atan2(ey - oy, ex - ox);
          const head = isHover ? 10 : 7;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - head * Math.cos(angle - Math.PI / 7), ey - head * Math.sin(angle - Math.PI / 7));
          ctx.lineTo(ex - head * Math.cos(angle + Math.PI / 7), ey - head * Math.sin(angle + Math.PI / 7));
          ctx.closePath();
          ctx.fill();

          ctx.font = isHover ? "700 12px 'Times New Roman'" : "12px 'Times New Roman'";
          ctx.textAlign = ex >= ox ? 'left' : 'right';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = isHover ? 3 : 2;
          const label = shortLabel(v.feature, isHover ? 32 : 18);
          const lx = ex + (ex >= ox ? 8 : -8);
          const ly = ey;
          ctx.globalAlpha = hiddenByHover ? 0.12 : (isHover ? 1 : 0.62);
          ctx.strokeStyle = C.bg;
          ctx.strokeText(label, lx, ly);
          ctx.fillStyle = isHover ? C.accent : C.text;
          ctx.fillText(label, lx, ly);
        });
        ctx.globalAlpha = 1;
      }

      const hasSel = selIds?.size > 0;
      entries.forEach(([id, b]) => {
        const px = toX(Number(b.pca_x ?? 0)), py = toY(Number(b.pca_y ?? 0));
        const isSel = selIds?.has(id);
        const cluster = b.cluster ?? -1;
        const col = colorMode === 'id_group' ? colorForGroup(idGroupOfId(id)) : clusterColor(cluster);
        ctx.fillStyle = col;
        ctx.strokeStyle = isSel ? C.text : C.bg;
        ctx.lineWidth = isSel ? 2.5 : 1.2;
        ctx.globalAlpha = hasSel ? (isSel ? .9 : .06) : 1;
        ctx.beginPath();
        ctx.arc(px, py, isSel ? 9 : 6.5, 0, 2 * Math.PI);
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.text; ctx.font = "600 12px 'Times New Roman'"; ctx.textAlign = 'center';
        ctx.fillText(id.replace('bourdon_', ''), px, py - 13);
      });
    } catch (err) { console.error('PCA canvas error:', err); }
  }, [mlData, colorMode, selIds, showBiplot, hoverFeature, vectors, getLayout]);

  const handleClick = useCallback(e => {
    if (!ref.current || !mlData?.per_bee) return;
    try {
      const rect = ref.current.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const { entries, toX, toY } = getLayout(ref.current);
      let best = null, bestD = 18;
      entries.forEach(([id, b]) => {
        const d = Math.hypot(toX(Number(b.pca_x ?? 0)) - mx, toY(Number(b.pca_y ?? 0)) - my);
        if (d < bestD) { bestD = d; best = id; }
      });
      if (best) onClickBee(best, e);
    } catch (err) { console.error('PCA click error:', err); }
  }, [mlData, onClickBee, getLayout]);

  return (
    <div style={{ position:'absolute', inset:0 }}>
      <canvas ref={ref} style={{ width:'100%', height:'100%', position:'absolute', top:0, left:0, cursor:'pointer' }} onClick={handleClick} />
      {showBiplot && vectors.length > 0 && (
        <aside style={{ position:'absolute', top:16, right:14, width:200, maxHeight:'calc(100% - 34px)', overflow:'auto', background:`${C.panel}ee`, border:`1px solid ${C.border}`, borderRadius:14, padding:10, boxShadow:'0 10px 28px rgba(0,0,0,.18)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:3, letterSpacing:.3 }}>Biplot - Features :</div>
          {vectors.map(v => {
            const active = hoverFeature === v.feature;
            return (
              <div
                key={v.feature}
                onMouseEnter={() => setHoverFeature(v.feature)}
                onMouseLeave={() => setHoverFeature(null)}
                style={{ padding:'6px 7px', borderRadius:9, marginBottom:4, cursor:'pointer', background:active ? `${C.accent}22` : 'transparent', border:`1px solid ${active ? C.accent : 'transparent'}` }}
                title={`${FEAT_LABELS[v.feature] || v.feature} - PC1 ${v.pc1.toFixed(3)} / PC2 ${v.pc2.toFixed(3)}`}
              >
                <div style={{ fontSize:12, fontWeight:700, color:active ? C.accent : C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{shortLabel(v.feature)}</div>
                <div style={{ fontSize:12, color:C.muted }}>PC1 {v.pc1.toFixed(2)} · PC2 {v.pc2.toFixed(2)}</div>
              </div>
            );
          })}
        </aside>
      )}
    </div>
  );
}
