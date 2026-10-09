import { useState } from 'react';
import { C } from '../config/theme';
import PcaScatterCanvas from '../canvas/PcaScatterCanvas';
import BiplotCanvas from '../canvas/BiplotCanvas';

export default function PcaTab({ mlData, colorMode, selIds, onClickBee }) {
  const [subTab, setSubTab] = useState('scatter');
  const [showBiplot, setShowBiplot] = useState(true);

  if (!mlData?.per_bee) {
    return <div className="no-data">
      <span style={{ fontSize:28, opacity:.4 }}>◉</span>
      <span>Chargez un JSON.</span>
    </div>;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, borderBottom:`1px solid ${C.border}`, background:C.panel, flexShrink:0 }}>
        <div style={{ display:'flex', flex:1 }}>
          {[["scatter", "PCA avec biplot"], ["biplot", "Loadings"]].map(([key, label]) => (
            <button key={key} onClick={() => setSubTab(key)} style={{ flex:1, padding:'10px 14px', fontSize:14, fontWeight:700, border:'none', background:subTab === key ? C.bg : 'transparent', color:subTab === key ? C.accent : C.muted, borderBottom:subTab === key ? `2px solid ${C.accent}` : `1px solid ${C.border}`, cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        {subTab === 'scatter' && (
          <button
            onClick={() => setShowBiplot(v => !v)}
            style={{ marginRight:10, padding:'7px 10px', borderRadius:10, border:`1px solid ${showBiplot ? C.accent : C.border}`, background:showBiplot ? `${C.accent}18` : C.bg, color:showBiplot ? C.accent : C.muted, fontSize:12, fontWeight:700, cursor:'pointer' }}
          >
            {showBiplot ? 'Masquer le biplot' : 'Afficher le biplot'}
          </button>
        )}
      </div>
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {subTab === 'scatter' && <PcaScatterCanvas mlData={mlData} colorMode={colorMode} selIds={selIds} onClickBee={onClickBee} showBiplot={showBiplot} />}
        {subTab === 'biplot' && <BiplotCanvas mlData={mlData} />}
      </div>
    </div>
  );
}
