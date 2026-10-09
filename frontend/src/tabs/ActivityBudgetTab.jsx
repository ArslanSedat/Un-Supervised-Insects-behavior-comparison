import { useMemo, useState } from 'react';
import { C } from '../config/theme';
import { segmentTrajectory } from '../utils/data';

const STATE_KEYS = ['proche_ruche', 'immobile', 'fleur', 'lent', 'rapide'];
const STATE_COLORS = {
  proche_ruche: '#2fa84f',
  immobile: '#cc3333',
  fleur: '#d29922',
  lent: '#2d9a2d',
  rapide: '#0066cc',
};
const STATE_LABELS = {
  proche_ruche: 'Proche ruche',
  immobile: 'Immobile',
  fleur: "Près d'une fleur",
  lent: 'Déplacement lent',
  rapide: 'Déplacement rapide',
};
const SERIES_COLORS = [C.accent, C.purple, C.teal, C.orange, C.expose, C.green, C.normal];

function idGroupOf(bee) {
  const id = String(bee?.id || 'Inconnu');
  const match = id.match(/^([A-Za-z]+\d+)/);
  return match ? match[1] : id.split(/[-_]/)[0] || 'Inconnu';
}

function clusterOf(bee, mlData) {
  const cluster = mlData?.per_bee?.[bee.id]?.cluster ?? bee.cluster ?? null;
  if (cluster === null || cluster === undefined) return 'Non classé';
  return Number(cluster) === -1 ? 'Outliers' : `Cluster ${cluster}`;
}

function aggregateBudget(bees, flowers, ruche) {
  const agg = Object.fromEntries(STATE_KEYS.map(k => [k, 0]));
  bees.forEach(bee => {
    const seg = segmentTrajectory(bee, flowers, ruche || [0.1, 0.1, 0]);
    STATE_KEYS.forEach(k => { agg[k] += Number(seg[k] || 0); });
  });
  const total = STATE_KEYS.reduce((sum, k) => sum + agg[k], 0);
  const pct = Object.fromEntries(STATE_KEYS.map(k => [k, total ? agg[k] / total * 100 : 0]));
  return { agg, pct, total };
}

export default function ActivityBudgetTab({ bees, flowers, rucheT, selIds, mlData }) {
  const [mode, setMode] = useState('aggregate');
  const filtered = selIds && selIds.size > 0 ? bees.filter(b => selIds.has(b.id)) : bees;

  const series = useMemo(() => {
    if (!filtered.length) return [];

    if (mode === 'cluster') {
      const groups = new Map();
      filtered.forEach(bee => {
        const key = clusterOf(bee, mlData);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(bee);
      });
      return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric:true }))
        .map(([label, items], i) => ({ label, items, color:SERIES_COLORS[i % SERIES_COLORS.length] }));
    }

    if (mode === 'idGroup') {
      const groups = new Map();
      filtered.forEach(bee => {
        const key = idGroupOf(bee);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(bee);
      });
      return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric:true }))
        .map(([label, items], i) => ({ label, items, color:SERIES_COLORS[i % SERIES_COLORS.length] }));
    }

    return [{ label:'Sélection', items:filtered, color:C.accent }];
  }, [filtered, mode, mlData]);

  if (!filtered.length) return <div className="no-data"><span style={{ fontSize:28, opacity:.4 }}>◉</span>
      <span>Chargez un JSON.</span></div>;

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ padding:'10px 14px', fontSize:12, color:C.muted, lineHeight:1.5, borderBottom:`1px solid ${C.border}`, background:C.panel }}>
        Répartition du temps de vol entre les états comportementaux (immobilité, proximité ruche/fleurs, vitesse).
      </div>
      <div className="btn-grp" style={{ marginBottom:14 }}>
        <button className={`btn ${mode === 'aggregate' ? 'on' : ''}`} onClick={() => setMode('aggregate')}>Barre agrégée</button>
        <button className={`btn ${mode === 'cluster' ? 'on' : ''}`} onClick={() => setMode('cluster')}>Séparer par cluster</button>
        <button className={`btn ${mode === 'idGroup' ? 'on' : ''}`} onClick={() => setMode('idGroup')}>Séparer par groupe ID</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
        {series.map(({ label, items }) => {
          const { agg, pct } = aggregateBudget(items, flowers, rucheT || [0.1, 0.1, 0]);
          return (
            <div key={label} className="metric-card" style={{ marginBottom:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{label}</span>
                <span style={{ fontSize:12, color:C.muted }}>{items.length} bourdon(s)</span>
              </div>
              <div className="stacked-bar" style={{ marginBottom:0 }}>
                {STATE_KEYS.map(state => pct[state] > 0 && (
                  <div key={state} className="stacked-segment" style={{ flex:pct[state], background:STATE_COLORS[state] }} title={`${label} · ${STATE_LABELS[state]}: ${pct[state].toFixed(1)}% · ${agg[state]} points`}>
                    {pct[state] > 7 && `${pct[state].toFixed(0)}%`}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10 }}>
        {STATE_KEYS.map(state => (
          <div key={state} className="metric-card">
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <span style={{ width:10, height:10, borderRadius:3, background:STATE_COLORS[state] }} />
              <span style={{ fontSize:12, color:C.text, fontWeight:700 }}>{STATE_LABELS[state]}</span>
            </div>
            {series.map(({ label, items, color }) => {
              const { agg, pct } = aggregateBudget(items, flowers, rucheT || [0.1, 0.1, 0]);
              return (
                <div key={`${label}-${state}`} className="metric-row">
                  <span style={{ width:74, fontSize:12, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
                  <div className="progress-track">
                    <div style={{ width:`${pct[state]}%`, height:'100%', background:color, borderRadius:3 }} />
                  </div>
                  <span style={{ width:104, fontSize:12, color:C.muted, textAlign:'right' }}>{pct[state].toFixed(1)}% · {agg[state]}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
