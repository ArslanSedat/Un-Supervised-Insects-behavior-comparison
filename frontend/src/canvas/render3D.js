import { C } from '../config/theme';
import { clusterColor, colorForGroup, idGroupOfId } from '../utils/groups';

export default function render3D(canvas, bees, flowers, rucheT, worldSize, selIds, hoverBee, panX, panY, zoom, rotX, rotY, colorMode, mlData) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth, H = canvas.height = canvas.offsetHeight;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  const bs = Math.min(W * .75 / (worldSize[0] || 2.5), H * .75 / (worldSize[1] || 2.5));
  const sc = bs * zoom, ox = W / 2 + panX, oy = H / 2 + panY;
  const ctr = [worldSize[0] / 2, worldSize[1] / 2, worldSize[2] / 2];
  const cX = Math.cos(rotX), sX = Math.sin(rotX), cY = Math.cos(rotY), sY = Math.sin(rotY);

  const proj = ({ x, y, z }) => {
    let px = x - ctr[0], py = y - ctr[1], pz = z - ctr[2];
    const xz = px * cY - py * sY, yz = px * sY + py * cY;
    const yy = yz * cX - pz * sX, zz = yz * sX + pz * cX;
    const p = 1 / (1 - zz * .1);
    return { x: ox + xz * sc * p, y: oy + yy * sc * p };
  };

  ctx.strokeStyle = C.border + '88'; ctx.lineWidth = .4;
  for (let i = 0; i <= 8; i++) {
    const xi = worldSize[0] * i / 8, yi = worldSize[1] * i / 8;
    const p1 = proj({ x:xi, y:0, z:0 }), p2 = proj({ x:xi, y:worldSize[1], z:0 });
    const q1 = proj({ x:0, y:yi, z:0 }), q2 = proj({ x:worldSize[0], y:yi, z:0 });
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
  }

  flowers.forEach(([fx, fy, fz, fid]) => {
    const p = proj({ x:fx, y:fy, z:fz });
    ctx.fillStyle = '#d29922'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = C.bg; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = C.bg; ctx.font = "600 12px 'Times New Roman'"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`F${Number(fid) + 1}`, p.x, p.y);
  });

  if (rucheT) {
    const p = proj({ x:rucheT[0], y:rucheT[1], z:rucheT[2] });
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = C.bg; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.bg; ctx.font = "600 12px 'Times New Roman'"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⌂', p.x, p.y);
  }

  const hasSel = selIds.size > 0;
  bees.forEach(bee => {
    if (!bee.points.length) return;
    const pr = bee.points.map(p => proj(p));
    const isSel = selIds.has(bee.id), isHov = hoverBee === bee.id;
    const cluster = mlData?.per_bee?.[bee.id]?.cluster ?? -1;
    const col = colorMode === 'id_group' ? colorForGroup(idGroupOfId(bee.id)) : clusterColor(cluster);

    ctx.lineWidth = isSel ? 2.5 : isHov ? 2 : .8;
    ctx.strokeStyle = col;
    ctx.globalAlpha = hasSel ? (isSel ? .9 : .06) : (isHov ? .85 : .35);
    ctx.setLineDash(cluster === -1 ? [3, 3] : []);
    ctx.beginPath(); pr.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = hasSel ? (isSel ? 1 : .08) : 1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(pr[0].x, pr[0].y, 2.5, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(pr[pr.length - 1].x, pr[pr.length - 1].y, isSel ? 5 : 2.5, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
  });

}

