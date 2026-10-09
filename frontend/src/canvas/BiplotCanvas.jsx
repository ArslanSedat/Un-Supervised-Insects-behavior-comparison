import { useMemo, useState } from 'react';
import { C, FEAT_LABELS } from '../config/theme';

const MAX_COMPONENTS = 8;

function labelOf(feature) {
  return FEAT_LABELS[feature] || feature;
  }

function fmt(v, d = 3) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(d) : '0.000';
  }

export default function BiplotCanvas({ mlData }) {
  const [hover, setHover] = useState(null);

  const model = useMemo(() => {
    const loadings = mlData?.pca?.loadings_full || {};
    const varExp = mlData?.pca?.variance_explained_full || [];
    const nComp = Math.min(MAX_COMPONENTS, varExp.length || 0);
    const rows = Object.entries(loadings)
      .map(([feature, values]) => {
        const kept = Array.from({ length:nComp }, (_, i) => Number(values?.[i] || 0));
        return {
          feature,
          values: kept.map(v => Math.abs(v)),
          signedValues: kept,
          score: kept.reduce((s, v) => s + Math.abs(v), 0),
          maxAbs: Math.max(...kept.map(v => Math.abs(v)), 0),
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
    const maxAbs = Math.max(...rows.flatMap(r => r.values.map(v => Math.abs(v))), 1e-9);
    return { rows, varExp, nComp, maxAbs };
    }, [mlData]);

  if (!model.rows.length) {
    return <div className="no-data"><span>Aucun loading PCA disponible.</span></div>;
    }

  return (
    <div style={{ height:'100%', overflow:'auto', padding:18, background:C.bg }}>
      <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:14 }}>Loadings des premières composantes principales</div>

      <div style={{ minWidth:860, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden', background:C.panel }}>
        <div style={{ display:'grid', gridTemplateColumns:`230px repeat(${model.nComp}, minmax(76px, 1fr))`, position:'sticky', top:0, zIndex:2, background:C.panel, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ padding:'10px 12px', fontSize:12, fontWeight:700, color:C.muted }}>FEATURE</div>
          {Array.from({ length:model.nComp }, (_, i) => (
            <div key={i} style={{ padding:'10px 8px', textAlign:'center', borderLeft:`1px solid ${C.border}`, fontSize:12, fontWeight:700, color:C.text }}>
              PC{i + 1}
              <div style={{ color:C.muted, fontWeight:700 }}>{((model.varExp[i] || 0) * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>

        {model.rows.map(row => {
          const active = hover === row.feature;
          return (
            <div
              key={row.feature}
              onMouseEnter={() => setHover(row.feature)}
              onMouseLeave={() => setHover(null)}
              style={{ display:'grid', gridTemplateColumns:`230px repeat(${model.nComp}, minmax(76px, 1fr))`, minHeight:38, background:active ? `${C.accent}12` : 'transparent', opacity:hover && !active ? .42 : 1, borderBottom:`1px solid ${C.border}66` }}>
              <div style={{ padding:'9px 12px', color:active ? C.accent : C.text, fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={labelOf(row.feature)}>
                {labelOf(row.feature)}
              </div>
              {row.values.map((v, i) => {
                const width = `${Math.max(3, v / model.maxAbs * 92)}%`;
                const signed = row.signedValues?.[i] ?? v;
                return (
                  <div key={i} style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', padding:'6px 8px', borderLeft:`1px solid ${C.border}66` }} title={`${labelOf(row.feature)} - PC${i + 1}: |${fmt(signed)}| = ${fmt(v)}`}>
                    <div style={{ position:'absolute', left:8, right:8, height:14, borderRadius:99, background:`${C.border}55` }} />
                    <div style={{ position:'absolute', left:8, height:14, width, borderRadius:99, background:`${C.accent}bb` }} />
                    <span style={{ position:'relative', zIndex:1, fontSize:12, fontWeight:700, color:C.text }}>{fmt(v, 2)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

