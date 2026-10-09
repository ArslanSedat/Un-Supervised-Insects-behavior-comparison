import { C, FEAT_LABELS } from '../config/theme';

export default function BeeTab({ selBee, mlData }) {
  if (!selBee) return (
    <div className="no-data">
      <span style={{ fontSize:28, opacity:.4 }}>◉</span>
      <span>Chargez un JSON.</span>
    </div>
  );

  const pb = mlData?.per_bee?.[selBee.id];
  const rfData = mlData?.rf_shap?.per_bee?.[selBee.id];
  const shapVals = rfData?.shap_values || {};
  const allShap = Object.entries(shapVals)
    .map(([f, v]) => ({ feat:f, val:Number(v) || 0, label:FEAT_LABELS[f] || f }))
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
  const maxShap = allShap.length ? Math.abs(allShap[0].val) || 1 : 1;
  const cluster = pb?.cluster ?? -1;

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ maxWidth:560 }}>
        <div style={{fontWeight:700, fontSize:14, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
            {selBee.id}
            <span style={{ fontSize:12, color:cluster === -1 ? C.muted : C.accent, fontWeight:400 }}>
              {cluster === -1 ? 'NON CLASSÉ' : `CLUSTER ${cluster}`}
            </span>
          </div>

          {pb && (
            <div className="metric-card" style={{ marginBottom:10, marginTop:8 }}>
              {[
                ['PC1', pb.pca_x?.toFixed(4)], ['PC2', pb.pca_y?.toFixed(4)],
                ['UMAP X', pb.umap_x?.toFixed(4)], ['UMAP Y', pb.umap_y?.toFixed(4)],
              ].map(([l, v]) => v != null && (
                <div key={l} className="sr"><span className="sl">{l}</span><span className="sv" style={{ color:C.text }}>{v}</span></div>
              ))}
            </div>
          )}

          {allShap.length > 0 && (
            <div className="metric-card" style={{ marginBottom:10, display:'flex', flexDirection:'column' }}>
              <div className="sec-title" style={{ marginBottom:6 }}>SHAP individuel</div>
              <div style={{ flex:1, overflowY:'auto', maxHeight:300, borderRadius:4, border:`1px solid ${C.border}22`, paddingRight:6 }}>
                {allShap.slice(0, 30).map(({ feat, val, label }) => (
                  <div key={feat} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, paddingRight:6 }}>
                    <span style={{ width:128, fontSize:12, color:C.text, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{label}</span>
                    <div style={{ flex:1, height:7, background:C.bg, borderRadius:2, border:`1px solid ${C.border}`, overflow:'hidden', position:'relative' }}>
                      <div style={{ position:'absolute', top:0, bottom:0, width:`${Math.min(Math.abs(val) / maxShap * 50, 50)}%`, background:val >= 0 ? C.purple : C.normal, opacity:.8, borderRadius:1, left:val >= 0 ? '50%' : undefined, right:val < 0 ? '50%' : undefined }} />
                      <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:C.border }} />
                    </div>
                    <span style={{ width:62, fontSize:12, color:val >= 0 ? C.purple : C.normal, textAlign:'right', flexShrink:0 }}>{val >= 0 ? '+' : ''}{val.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sec-title" style={{ marginBottom:6 }}>Features calculées</div>
          {Object.entries(FEAT_LABELS).map(([k, lbl]) => {
            const v = selBee.stats[k];
            return (
              <div key={k} className="sr">
                <span className="sl">{lbl}</span>
                <span className="sv">{typeof v === 'number' ? v.toFixed(5) : v ?? '-'}</span>
              </div>
            );
          })}
        </div>
      </div>
  );
}
