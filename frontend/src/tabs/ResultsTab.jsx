import { useState } from 'react';
import { C, FEAT_LABELS } from '../config/theme';
import UmapScatter from '../components/UmapScatter';
import { ClusterRadar } from '../components/ClusterRadar';

export default function ResultsTab({ mlData, clustering, selIds, onClickBee }) {
  const [subTab, setSubTab] = useState('map');

  if (!mlData) return (
    <div className="no-data">
      <span style={{ fontSize:28, opacity:.4 }}>◉</span>
      <span>Chargez un JSON.</span>
    </div>
  );

  const ranking = clustering?.feature_ranking || clustering?.kruskal || [];
  const profiles = clustering?.cluster_profiles || {};
  const clusters = Object.keys(profiles).sort((a, b) => Number(a) - Number(b));
  const shap = clustering?.shap_importance || [];
  const subTabs = [['map', 'Carte des clusters'],['ranking', 'Features discriminantes des clusters'],['shap', 'SHAP des clusters'],['radar', 'Radar des profils']];

  const dbcv = clustering?.dbcv_score;
  const dbcvNote = dbcv == null ? "n/a (moins de 2 clusters trouvés)" : dbcv > 0.7 ? "bonne séparation" : dbcv > 0.4 ? "séparation moyenne" : "faible séparation";

  const FeatureBar = ({ value, max, color = C.accent }) => (
    <div style={{ flex:1, height:7, background:C.panel, borderRadius:4, overflow:'hidden', border:`1px solid ${C.border}` }}>
      <div style={{ width:`${Math.min(100, (value / (max || 1)) * 100)}%`, height:'100%', background:color, borderRadius:4 }} />
    </div>
  );
  const MapPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 14px', fontSize:12, color:C.muted, lineHeight:1.5, borderBottom:`1px solid ${C.border}`, background:C.panel }}>
        <span style={{ color:C.text, fontWeight:700 }}>DBCV: {dbcv == null ? 'n/a' : dbcv.toFixed(3)} </span>
        ({dbcv == null ? 'moins de 2 clusters trouvés' : dbcv > 0.7 ? 'bonne séparation' : dbcv > 0.4 ? 'séparation moyenne' : 'faible séparation'}).
        Projection UMAP 2D des bourdons : chaque point = un individu qui est positionné selon la similarité de ses features avec les autres.
        La couleur = cluster attribué par HDBSCAN. Les points gris sont les outliers (bruit HDBSCAN).
      </div>
      <div style={{ flex:1, minHeight:0 }}><UmapScatter clustering={clustering} selIds={selIds} onClickPoint={onClickBee} /></div>
    </div>
  );

  const RankingPanel = () => {
    if (!ranking.length) return <div className="no-data"><span>Pas de ranking disponible.</span></div>;
    const rows = [...ranking].sort((a, b) => (b.exploratory_score ?? b.effect_size ?? 0) - (a.exploratory_score ?? a.effect_size ?? 0)).slice(0, 40);
    const maxScore = Math.max(...rows.map(r => r.exploratory_score ?? r.effect_size ?? 0), 1e-9);

    return (
      <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
        <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Features candidates pour le biologiste</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.5 }}>
          Score : score exploratoire défini dans le README. ε² : effect size du test de Kruskal-Wallis entre clusters. Δ médianes est l'écart entre les médianes des clusters. p Kruskal : p-value du test de Kruskal-Wallis. Détail cluster : médiane et écart interquartile pour chaque cluster.
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Feature</th>
              <th style={{ textAlign:'right' }}>Score</th>
              <th style={{ textAlign:'right' }}>ε²</th>
              <th style={{ textAlign:'right' }}>Δ médianes</th>
              <th style={{ textAlign:'right' }}>p Kruskal</th>
              <th>Détail cluster</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const score = r.exploratory_score ?? r.effect_size ?? 0;
              const stats = Object.entries(r.cluster_stats || {});
              return (
                <tr key={r.feature}>
                  <td style={{ minWidth:150 }}>{FEAT_LABELS[r.feature] || r.feature}</td>
                  <td style={{ minWidth:110 }}>{FeatureBar({ value: score, max: maxScore, color: C.accent })}</td>
                  <td style={{ textAlign:'right' }}>{(r.effect_size ?? 0).toFixed(4)}</td>
                  <td style={{ textAlign:'right' }}>{(r.median_delta ?? 0).toFixed(5)}</td>
                  <td style={{ textAlign:'right' }}>{r.p_value < 0.0001 ? '<0.0001' : Number(r.p_value ?? 1).toFixed(5)}</td>
                  <td style={{ fontSize:12, color:C.muted }}>
                    {stats.map(([clusterId, s]) => `C${clusterId}: med ${Number(s.median).toFixed(4)} / IQR ${Number(s.iqr).toFixed(4)}`).join(' · ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const ShapPanel = () => {
    const rows = shap.slice(0, 30);
    if (!rows.length) return <div className="no-data"><span>Pas de SHAP</span></div>;
    const maxImp = Math.max(...rows.map(r => r.importance), 1e-9);
    return (
      <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
        <div style={{ padding:'10px 14px', fontSize:12, color:C.muted, lineHeight:1.5, marginBottom:12 }}>
          Importance SHAP d'un modèle surrogate entraîné à prédire les labels HDBSCAN : elle indique quelles features expliquent le mieux la séparation des clusters.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((r, idx) => (
            <div key={r.feature} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:24, fontSize:12, color:C.muted, textAlign:'right' }}>{idx + 1}.</div>
              <div style={{ width:180, fontSize:12, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{FEAT_LABELS[r.feature] || r.feature}</div>
              {FeatureBar({ value: r.importance, max: maxImp, color: C.purple })}
              <div style={{ width:72, fontSize:12, textAlign:'right', color:C.purple }}>{Number(r.importance).toFixed(6)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const RadarPanel = () => (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Radar des profils de clusters</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.5 }}>
        Médianes normalisées des 8 features les plus discriminantes pour chaque cluster.
      </div>
      <ClusterRadar clustering={clustering} ranking={ranking} />
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border}`, background:C.panel, flexShrink:0 }}>
        {subTabs.map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)} style={{ flex:1, padding:'8px 12px', fontSize:12, fontWeight:700, border:'none', background:subTab === key ? C.bg : 'transparent', color:subTab === key ? C.accent : C.muted, borderBottom:subTab === key ? `2px solid ${C.accent}` : `1px solid ${C.border}`, cursor:'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        {subTab === 'map' && MapPanel()}
        {subTab === 'ranking' && RankingPanel()}
        {subTab === 'shap' && ShapPanel()}
        {subTab === 'radar' && RadarPanel()}
      </div>
    </div>
  );
}
