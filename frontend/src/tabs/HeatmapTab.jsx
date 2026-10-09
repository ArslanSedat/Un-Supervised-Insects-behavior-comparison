import { useCallback, useEffect, useState } from 'react';
import { C } from '../config/theme';

let heatmapCacheKey = null;
let heatmapGridCache = null;

export default function HeatmapTab({ bees, allFlowers, rucheT, rucheE, worldSize, selIds, heatRef, panX, panY, zoom, rotX, rotY, setPanX, setPanY, setZoom, setRotX, setRotY }) {
  const [isDrag, setIsDrag] = useState(false);
  const [dSt, setDSt] = useState(null);

  const handleMouseDown = useCallback(e => {
    setIsDrag(true);
    setDSt({ x: e.clientX, y: e.clientY, panX, panY, rotX, rotY, mode: e.shiftKey ? "pan" : "rotate" });
  }, [panX, panY, rotX, rotY]);

  const handleMouseMove = useCallback(e => {
    if (!isDrag || !dSt) return;
    if (dSt.mode === "pan") {
      setPanX(dSt.panX + e.clientX - dSt.x);
      setPanY(dSt.panY + e.clientY - dSt.y);
    } else {
      setRotY(dSt.rotY + (e.clientX - dSt.x) * 0.006);
      setRotX(Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, dSt.rotX - (e.clientY - dSt.y) * 0.006)));
    }
  }, [isDrag, dSt, setPanX, setPanY, setRotX, setRotY]);

  const handleWheel = useCallback(e => {
    e.preventDefault();
    setZoom(p => Math.min(3, Math.max(0.4, p * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, [setZoom]);

  useEffect(()=>{
    if(!heatRef?.current) return;
    const canvas = heatRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    // ─ SETUP 3D PROJECTION ─
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

    const active = selIds && selIds.size>0 ? bees.filter(b=>selIds.has(b.id)) : bees;
    const cacheKey = [active.map(b=>b.id).join(","), W, H].join("|");
    
    let smoothGrid, maxH;
    if(cacheKey !== heatmapCacheKey) {
      heatmapCacheKey = cacheKey;
      const binsX = Math.max(40, Math.min(80, Math.floor(W/4.5)));
      const binsY = Math.max(40, Math.min(80, Math.floor(H/4.5)));
      const grid = new Float32Array(binsX*binsY);
      
      let allX = [], allY = [];
      active.forEach(bee => {
        bee.points.forEach(p => {
          allX.push((p.x/worldSize[0])*(binsX-1));
          allY.push((p.y/worldSize[1])*(binsY-1));
        });
      });
      
      const stddev = (arr) => {
        if(arr.length<2) return 1;
        const mean = arr.reduce((a,b)=>a+b,0) / arr.length;
        const variance = arr.reduce((a,b)=>a+(b-mean)*(b-mean),0) / (arr.length-1);
        return Math.sqrt(variance);
      };
      
      const n = allX.length;
      const stdX = stddev(allX), stdY = stddev(allY);
      const silverman = Math.pow(4/(3*n), 1/5);
      const gaussSigmaX = Math.max(1.2, silverman * stdX);
      const gaussSigmaY = Math.max(1.2, silverman * stdY);
      
      active.forEach(bee => {
        for(let i=0; i<bee.points.length-1; i++) {
          const p0 = bee.points[i], p1 = bee.points[i+1];
          const cx0 = (p0.x/worldSize[0])*(binsX-1), cy0 = (p0.y/worldSize[1])*(binsY-1);
          const cx1 = (p1.x/worldSize[0])*(binsX-1), cy1 = (p1.y/worldSize[1])*(binsY-1);
          const segDist = Math.hypot(cx1-cx0, cy1-cy0);
          const nInterp = Math.max(1, Math.ceil(segDist / 0.7));
          
          for(let k=0; k<=nInterp; k++) {
            const t = nInterp>0 ? k/nInterp : 0;
            const cx = cx0 + t*(cx1-cx0), cy = cy0 + t*(cy1-cy0);
            const radiusX = Math.ceil(2.5*gaussSigmaX), radiusY = Math.ceil(2.5*gaussSigmaY);
            
            for(let dy=-radiusY; dy<=radiusY; dy++) {
              for(let dx=-radiusX; dx<=radiusX; dx++) {
                const gx = Math.floor(cx) + dx, gy = Math.floor(cy) + dy;
                if(gx>=0 && gx<binsX && gy>=0 && gy<binsY) {
                  const distSqX = (dx*dx) / (gaussSigmaX*gaussSigmaX);
                  const distSqY = (dy*dy) / (gaussSigmaY*gaussSigmaY);
                  const weight = Math.exp(-(distSqX + distSqY) / 2);
                  grid[gy*binsX+gx] += weight;
                }
              }
            }
          }
        }
      });

      const blurSep = (arr,w,h)=>{
        const tmp = new Float32Array(arr.length);
        const k=[0.25,0.5,0.25];
        for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=0; for(let i=-1;i<=1;i++){ const xi=Math.min(w-1,Math.max(0,x+i)); v+=arr[y*w+xi]*k[i+1]; } tmp[y*w+x]=v; }
        const out = new Float32Array(arr.length);
        for(let x=0;x<w;x++) for(let y=0;y<h;y++){ let v=0; for(let i=-1;i<=1;i++){ const yi=Math.min(h-1,Math.max(0,y+i)); v+=tmp[yi*w+x]*k[i+1]; } out[y*w+x]=v; }
        return out;
      };

      // finalize grid smoothing
      smoothGrid = blurSep(grid, binsX, binsY);
      maxH = 0; 
      for(let i=0;i<smoothGrid.length;i++) if(smoothGrid[i]>maxH) maxH = smoothGrid[i];
      heatmapGridCache = { binsX, binsY, grid: smoothGrid, maxH };
    } else if(heatmapGridCache) {
      smoothGrid = heatmapGridCache.grid;
      maxH = heatmapGridCache.maxH;
    }

    if(!smoothGrid || maxH === undefined) {
      ctx.fillStyle = C.bg; 
      ctx.fillRect(0,0,W,H);
      return;
    }

    ctx.fillStyle = C.bg; 
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = C.border + '22'; 
    ctx.lineWidth = 0.4;
    for(let i=0;i<=8;i++){
      const xi = worldSize[0]*i/8, yi = worldSize[1]*i/8;
      const p1 = proj({x:xi,y:0,z:0}), p2 = proj({x:xi,y:worldSize[1],z:0});
      const q1 = proj({x:0,y:yi,z:0}), q2 = proj({x:worldSize[0],y:yi,z:0});
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(q1.x,q1.y); ctx.lineTo(q2.x,q2.y); ctx.stroke();
    }

    const quads = [];
    
    if(smoothGrid && heatmapGridCache) {
      const { binsX, binsY } = heatmapGridCache;
      for(let y=0;y<binsY-1;y++){
        for(let x=0;x<binsX-1;x++){
          const val00 = Math.max(0, smoothGrid[y*binsX+x]/maxH);
          const val10 = Math.max(0, smoothGrid[y*binsX+(x+1)]/maxH);
          const val01 = Math.max(0, smoothGrid[(y+1)*binsX+x]/maxH);
          const val11 = Math.max(0, smoothGrid[(y+1)*binsX+(x+1)]/maxH);
          const avgVal = (val00 + val10 + val01 + val11) / 4;
          if(avgVal<0.01) continue;
          
          const dx = worldSize[0]/(binsX-1), dy = worldSize[1]/(binsY-1);
          const wx0 = (x/(binsX-1))*worldSize[0], wy0 = (y/(binsY-1))*worldSize[1];
          const getZ = (v) => Math.min(worldSize[2]*0.65, v*(worldSize[2]||1)*0.55);
          
          quads.push({
            v00: proj({x:wx0, y:wy0, z:getZ(val00)}),
            v10: proj({x:wx0+dx, y:wy0, z:getZ(val10)}),
            v01: proj({x:wx0, y:wy0+dy, z:getZ(val01)}),
            v11: proj({x:wx0+dx, y:wy0+dy, z:getZ(val11)}),
            val: avgVal,
            depth: 0
          });
        }
      }
    }
    
    const colorBlueToRed = (t)=>{
      const tt = Math.max(0, Math.min(1, t));
      let r=0,g=0,b=0;
      if (tt < 0.25) {
        const s = tt / 0.25;
        r = 0; g = Math.floor(s * 255); b = 255;
      } else if (tt < 0.5) {
        const s = (tt - 0.25) / 0.25;
        r = 0; g = 255; b = Math.floor((1 - s) * 255);
      } else if (tt < 0.75) {
        const s = (tt - 0.5) / 0.25;
        r = Math.floor(s * 255); g = 255; b = 0;
      } else {
        const s = (tt - 0.75) / 0.25;
        r = 255; g = Math.floor((1 - s) * 255); b = 0;
      }
      return [r,g,b];
    };

    quads.forEach(q => q.depth = (q.v00.z + q.v10.z + q.v01.z + q.v11.z) / 4);
    quads.sort((a,b)=>a.depth - b.depth);

    quads.forEach(quad => {
      const [r,g,b] = colorBlueToRed(quad.val);
      const alpha = 0.65 + quad.val*0.35;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha*0.6})`;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(quad.v00.x, quad.v00.y);
      ctx.lineTo(quad.v10.x, quad.v10.y);
      ctx.lineTo(quad.v11.x, quad.v11.y);
      ctx.lineTo(quad.v01.x, quad.v01.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    ctx.strokeStyle = C.border + '22'; 
    ctx.lineWidth = 0.4;
    for(let i=0;i<=8;i++){
      const xi = worldSize[0]*i/8, yi = worldSize[1]*i/8;
      const p1 = proj({x:xi,y:0,z:0}), p2 = proj({x:xi,y:worldSize[1],z:0});
      const q1 = proj({x:0,y:yi,z:0}), q2 = proj({x:worldSize[0],y:yi,z:0});
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(q1.x,q1.y); ctx.lineTo(q2.x,q2.y); ctx.stroke();
    }

    (allFlowers||[]).forEach(([fx,fy,fz,fid])=>{
      const p = proj({x:fx,y:fy,z:fz||0}); 
      ctx.fillStyle='#d29922'; 
      ctx.beginPath(); 
      ctx.arc(p.x,p.y,5,0,2*Math.PI); 
      ctx.fill(); 
      ctx.strokeStyle=C.bg; 
      ctx.lineWidth=1.2; 
      ctx.stroke(); 
      ctx.fillStyle=C.bg; 
      ctx.font="600 12px 'Times New Roman'"; 
      ctx.textAlign='center'; 
      ctx.textBaseline='middle'; 
      ctx.fillText(`F${fid+1}`,p.x,p.y);
    });
    [[rucheT,C.temoin],[rucheE,C.expose]].forEach(([r,col])=>{ 
      if(!r) return; 
      const p=proj({x:r[0],y:r[1],z:r[2]||0}); 
      ctx.fillStyle=col; 
      ctx.beginPath(); 
      ctx.arc(p.x,p.y,7,0,2*Math.PI); 
      ctx.fill(); 
      ctx.strokeStyle=C.bg; 
      ctx.lineWidth=1.5; 
      ctx.stroke(); 
      ctx.fillStyle=C.bg; 
      ctx.font="600 12px 'Times New Roman'"; 
      ctx.textAlign='center'; 
      ctx.textBaseline='middle'; 
      ctx.fillText('🏠',p.x,p.y); 
    });
  },[bees, allFlowers, rucheT, rucheE, worldSize, selIds, heatRef, panX, panY, zoom, rotX, rotY]);

  return (
    <canvas ref={heatRef} style={{width:'100%',height:'100%',cursor:isDrag?"grabbing":"grab"}}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      onMouseUp={()=>setIsDrag(false)} onMouseLeave={()=>setIsDrag(false)}
      onWheel={handleWheel}
      onDoubleClick={()=>{setPanX(0);setPanY(0);setZoom(1);setRotX(0);setRotY(0);}}/>
  );
}

