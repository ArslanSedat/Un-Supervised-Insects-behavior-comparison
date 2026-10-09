import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, css, FEAT_LABELS } from './config/theme';
import { parseJSON } from './utils/data';
import render3D from './canvas/render3D';
import PcaTab from './tabs/PcaTab';
import HeatmapTab from './tabs/HeatmapTab';
import ResultsTab from './tabs/ResultsTab';
import ActivityBudgetTab from './tabs/ActivityBudgetTab';
import ImpactTab from './tabs/ImpactTab';
import BeeTab from './tabs/BeeTab';
import DynamicsTab from './tabs/DynamicsTab';
import { idGroupOfId } from './utils/groups';

export default function App() {
  const [bees, setBees] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [ruche, setRuche] = useState(null);
  const [worldSize, setWorldSize] = useState([2.5, 2.5, 1.8]);
  const [selIds, setSelIds] = useState(new Set());
  const [hoverBee, setHoverBee] = useState(null);
  const [tab, setTab] = useState('map');
  const [mlData, setMlData] = useState(null);
  const [clustering, setClustering] = useState(null);
  const [colorMode, setColorMode] = useState('cluster');
  const [pcaColor, setPcaColor] = useState('cluster');
  const [comments, setComments] = useState(null);
  const [rawJson, setRawJson] = useState(null);
  const [processed, setProcessed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [panX, setPanX] = useState(0), [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotX, setRotX] = useState(0), [rotY, setRotY] = useState(0);
  const [isDrag, setIsDrag] = useState(false), [dSt, setDSt] = useState(null);
  const cvRef = useRef(null);
  const heatRef = useRef(null);
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const normalizeMlData = (payload) => {
    const ml = payload?._ml ?? payload;
    if (!ml) return null;
    if (!ml.per_bee && ml.pca?.pca_per_bee) {
      const ids = ml.ids || Object.keys(ml.pca.pca_per_bee);
      ml.per_bee = {};
      ids.forEach((id, i) => {
        const p = ml.pca.pca_per_bee[id];
        if (!p) return;
        const cluster = ml.clustering?.cluster_labels?.[i] ?? -1;
        ml.per_bee[id] = {
          id,
          cluster,
          cluster_label: cluster === -1 ? 'Non classé' : `Cluster ${cluster}`,
          pca_x: p.pca_x,
          pca_y: p.pca_y,
          features: {},
        };
      });
    }

    return ml?.per_bee ? ml : null;
  };

  const uploadJson = useCallback(async (json) => {
    const fd = new FormData();
    fd.append('file', new Blob([JSON.stringify(json)], { type: 'application/json' }), 'bourdons.json');
    const url = `http://${window.location.hostname}:5000/upload`;
    const response = await fetchWithTimeout(url, { method: 'POST', body: fd }, 60000);
    if (!response.ok) throw new Error(`Upload HTTP ${response.status}`);
    return response.json();
  }, []);

  useEffect(() => {
    const canvas = cvRef.current;
    if (!canvas) return;
    if (showHeatmap) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    try {
      render3D(canvas, bees, flowers, ruche, worldSize, selIds, hoverBee, panX, panY, zoom, rotX, rotY, colorMode, mlData);
    } catch (err) {
      console.error('render3D error', err);
    }
  }, [showHeatmap, bees, flowers, ruche, worldSize, selIds, hoverBee, panX, panY, zoom, rotX, rotY, colorMode, mlData]);

  useEffect(() => {
    if (!rawJson || processed) return;

    setLoading(true);
    (async () => {
      try {
        setBees([]);
        setSelIds(new Set());
        setMlData(null);
        setClustering(null);
        const baseUrl = `http://${window.location.hostname}:5000`;
        await fetch(`${baseUrl}/reset`, { method: 'POST' });
        const uploaded = await uploadJson(rawJson);
        const mlRes = await fetchWithTimeout(`${baseUrl}/compute-ml`, { method: 'POST' }, 60000);
        const raw = await mlRes.text();
        const safeRaw = raw
          .replace(/-\bInfinity\b/g, 'null')
          .replace(/\bInfinity\b/g, 'null')
          .replace(/\bNaN\b/g, 'null');
        const mlJson = JSON.parse(safeRaw);
        if (!mlRes.ok) throw new Error(mlJson?.error || `ML HTTP ${mlRes.status}`);
        const ml = normalizeMlData(mlJson);
        if (!ml) throw new Error('Réponse ML reçue sans per_bee utilisable.');
        const parsed = parseJSON(uploaded, 'all');
        setFlowers(parsed.flowers || []);
        setRuche(parsed.ruche || [0.1, 0.1, 0]);
        setWorldSize(parsed.worldSize || [2.5, 2.5, 1.8]);
        setBees(parsed.bees || []);
        setComments(parsed.commentaires);
        setMlData(ml);
        setClustering(ml.clustering || null);
        setProcessed(true);
      } catch (err) {
        console.error('Pipeline error:', err);
        alert(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [rawJson, processed, uploadJson]);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setRawJson(JSON.parse(event.target.result));
        setProcessed(false);
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleMouseDown = e => setIsDrag(true) || setDSt({ x:e.clientX, y:e.clientY, panX, panY, rotX, rotY, mode:e.shiftKey ? 'pan' : 'rotate' });
  const handleMouseMove = e => {
    if (!isDrag || !dSt) return;
    if (dSt.mode === 'pan') {
      setPanX(dSt.panX + e.clientX - dSt.x);
      setPanY(dSt.panY + e.clientY - dSt.y);
    } else {
      setRotY(dSt.rotY + (e.clientX - dSt.x) * 0.006);
      setRotX(Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, dSt.rotX - (e.clientY - dSt.y) * 0.006)));
    }
  };
  const handleWheel = e => { e.preventDefault(); setZoom(p => Math.min(3, Math.max(0.4, p * (e.deltaY > 0 ? 0.9 : 1.1)))); };

  const selectBee = useCallback((id, e) => {
    if (e?.ctrlKey || e?.metaKey) {
      setSelIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setSelIds(new Set([id]));
    }
  }, []);

  const selBee = useMemo(() => {
    const id = [...selIds][0];
    return bees.find(b => b.id === id) || null;
  }, [bees, selIds]);

  const clusterCounts = clustering?.counts || {};
  const idGroupOf = (bee) => idGroupOfId(bee?.id);
  const idGroupCounts = useMemo(() => {
    const counts = {};
    bees.forEach(bee => {
      const key = idGroupOf(bee);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [bees]);
  const TABS = [
    ['map', '3D'],
    ['pca', 'PCA'],
    ['results', 'Clusters'],
    ['impact', 'Features'],
    ['activity', "Budget d'activité"],
    ['dynamics', 'Dynamique temporelle'],
    ['bee', 'Individu'],
  ];

  const setGroupSelection = (ids, append = false) => {
    setSelIds(prev => {
      if (!append) return new Set(ids);
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every(id => next.has(id));
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const selectCluster = (clusterId, append = false) => {
    const ids = bees
      .filter(b => (mlData?.per_bee?.[b.id]?.cluster ?? -1) === Number(clusterId))
      .map(b => b.id);
    setGroupSelection(ids, append);
  };

  const selectIdGroup = (groupKey, append = false) => {
    const ids = bees.filter(b => idGroupOf(b) === groupKey).map(b => b.id);
    setGroupSelection(ids, append);
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="hdr">
          <span className="hdr-logo">BeeVITO</span>
          <div className="kpi" title="Bourdons chargés">
            <span className="kpi-num">{bees.length}</span>
            <span className="kpi-lbl">Bourdons</span>
          </div>
          <div className="kpi" title="Groupes d'ID">
            <span className="kpi-num">{Object.keys(idGroupCounts).length}</span>
            <span className="kpi-lbl">Groupes</span>
          </div>
          <div className="kpi" title="Clusters HDBSCAN">
            <span className="kpi-num">{Object.keys(clusterCounts).filter(k => k !== '-1').length}</span>
            <span className="kpi-lbl">Clusters</span>
          </div>
          <div className="kpi" title="Outliers HDBSCAN" style={clusterCounts['-1'] ? { borderColor:`${C.expose}66` } : undefined}>
            <span className="kpi-num" style={clusterCounts['-1'] ? { color:C.expose } : undefined}>{clusterCounts['-1'] || 0}</span>
            <span className="kpi-lbl">Outliers</span>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            {loading && <span style={{ fontSize:12, color:C.accent, fontWeight:700 }}>Attendre : Calcul ML…</span>}
          </div>
        </div>

        <div className="main">
          <div className="side">
            <div className="sec">
              <div className="sec-title">Données à déposer</div>
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:C.accent, display:'inline-block' }} />
                  <span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:C.accent }}>Json :</span>
                </div>
                <input type="file" accept=".json" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ fontSize:12, width:'100%', cursor:'pointer', color:C.muted }} />
              </div>
              {comments && !['null', 'None', ''].includes(comments) && (
                <div style={{ fontSize:12, color:C.muted, marginTop:8, lineHeight:1.4 }}>{comments}</div>
              )}
            </div>

            <div className="sec">
              <div className="sec-title">Sélection </div> 
              {selIds.size > 0 && <div style={{ fontSize:15, color:C.muted, marginTop:5 }}>{selIds.size} sélectionné(s)</div>}
              <div className="btn-grp">
                <button className="btn" onClick={() => setSelIds(new Set(bees.map(b => b.id)))}>Tous ({bees.length})</button>
                {Object.entries(clusterCounts).filter(([k]) => k !== '-1').map(([clusterId, n]) => (
                  <button key={clusterId} className="btn" onClick={e => selectCluster(clusterId, e.ctrlKey || e.metaKey)}>C{clusterId} ({n})</button>
                ))}
                {clusterCounts['-1'] > 0 && <button className="btn" onClick={e => selectCluster(-1, e.ctrlKey || e.metaKey)}>Outliers ({clusterCounts['-1']})</button>}
                {selIds.size > 0 && <button className="btn" onClick={() => setSelIds(new Set())}>✕</button>}
              </div>
              {Object.keys(idGroupCounts).length > 1 && (
                <>
                  <div style={{ fontSize:12, color:C.muted, margin:'8px 0 4px'}}>Maintenir CTRL pour sélectionner plusieurs</div>
                  <div className="btn-grp">
                    {Object.entries(idGroupCounts).sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric:true })).map(([groupKey, n]) => (
                      <button key={groupKey} className="btn" onClick={e => selectIdGroup(groupKey, e.ctrlKey || e.metaKey)}>{groupKey} ({n})</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="sec" style={{ flex:1, overflowY:'auto' }}>
              <div className="sec-title">Individus ({bees.length})</div>
              {bees.map(bee => {
                const cluster = mlData?.per_bee?.[bee.id]?.cluster ?? -1;
                const colors = [C.purple, C.teal, C.orange, C.accent, C.expose, C.normal];
                const col = cluster === -1 ? C.muted : colors[Math.abs(cluster) % colors.length];
                return (
                  <div key={bee.id} className={`bee-item ${selIds.has(bee.id) ? 'sel' : ''}`}
                    onClick={e => selectBee(bee.id, e)}
                    onMouseEnter={() => setHoverBee(bee.id)} onMouseLeave={() => setHoverBee(null)}>
                    <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background:col }} />
                    <span style={{ flex:1, fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bee.id}</span>
                    <span style={{ fontSize:12, color:C.muted }}>{cluster === -1 ? 'out' : `C${cluster}`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="center">
            <div className="tabs">
              {TABS.map(([k, lbl]) => <div key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{lbl}</div>)}
            </div>

            {tab === 'map' && (
              <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
                <div style={{ padding:'6px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', gap:8, alignItems:'center', flexShrink:0, background:C.panel }}>
                  <div className="btn-grp" style={{ display:'flex', gap:6 }}>
                    <button className={`btn ${!showHeatmap ? 'on' : ''}`} onClick={() => setShowHeatmap(false)}>3D</button>
                    <button className={`btn ${showHeatmap ? 'on' : ''}`} onClick={() => setShowHeatmap(true)}>Heatmap</button>
                  </div>
                  <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>Couleur :</span>
                  <button className={`btn ${colorMode === 'cluster' ? 'on' : ''}`} onClick={() => setColorMode('cluster')}>Clusters</button>
                  <button className={`btn ${colorMode === 'id_group' ? 'on' : ''}`} onClick={() => setColorMode('id_group')}>Groupes ID</button>
                </div>

                {!showHeatmap ? (
                  <div className="cvs-wrap">
                    <canvas ref={cvRef} style={{ cursor:isDrag ? 'grabbing' : 'grab' }}
                      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                      onMouseUp={() => setIsDrag(false)} onMouseLeave={() => setIsDrag(false)}
                      onWheel={handleWheel}
                      onDoubleClick={() => { setPanX(0); setPanY(0); setZoom(1); setRotX(0); setRotY(0); }} />
                    <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,.65)', color:'#fff', padding:'4px 8px', borderRadius:4, fontSize:12, pointerEvents:'none' }}>
                      Glisser=rotation · Shift+Glisser=déplacement · Scroll=zoom · Double-clic=reset
                    </div>
                  </div>
                ) : (
                  <div className="cvs-wrap">
                    <HeatmapTab bees={bees} allFlowers={flowers} rucheT={ruche} rucheE={null} worldSize={worldSize} selIds={selIds} heatRef={heatRef}
                      panX={panX} panY={panY} zoom={zoom} rotX={rotX} rotY={rotY}
                      setPanX={setPanX} setPanY={setPanY} setZoom={setZoom} setRotX={setRotX} setRotY={setRotY} />
                  </div>
                )}
              </div>
            )}

            {tab === 'pca' && (
              <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
                <div style={{ padding:'6px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', gap:8, alignItems:'center', flexShrink:0, background:C.panel }}>
                  <span style={{ fontSize:12, color:C.muted }}>Couleur :</span>
                  <button className={`btn ${pcaColor === 'cluster' ? 'on' : ''}`} onClick={() => setPcaColor('cluster')}>Clusters</button>
                  <button className={`btn ${pcaColor === 'id_group' ? 'on' : ''}`} onClick={() => setPcaColor('id_group')}>Groupes ID</button>
                </div>
                <div className="cvs-wrap" style={{ flex:1 }}>
                  <PcaTab mlData={mlData} colorMode={pcaColor} selIds={selIds} onClickBee={selectBee} />
                </div>
              </div>
            )}

            {tab === 'results' && <div style={{ flex:1, overflowY:'auto' }}><ResultsTab mlData={mlData} clustering={clustering} selIds={selIds} onClickBee={selectBee} /></div>}
            {tab === 'impact' && <div style={{ flex:1, overflowY:'auto' }}><ImpactTab bees={bees} mlData={mlData} selIds={selIds} /></div>}
            {tab === 'activity' && <div style={{ flex:1, overflowY:'auto' }}><ActivityBudgetTab bees={bees} flowers={flowers} rucheT={ruche} rucheE={ruche} selIds={selIds} mlData={mlData} /></div>}
            {tab === 'dynamics' && <div style={{ flex:1, overflow:'hidden' }}><DynamicsTab bees={bees} flowers={flowers} ruche={ruche} selIds={selIds} mlData={mlData} /></div>}
            {tab === 'bee' && <div style={{ flex:1, overflowY:'auto' }}><BeeTab selBee={selBee} mlData={mlData} /></div>}
          </div>
        </div>
      </div>
    </>
  );
}
