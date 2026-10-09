import { C } from '../config/theme';

export const GROUP_COLORS = [
  C.purple, C.teal, C.orange, C.accent, C.expose, C.normal,
  '#9c6b30', '#cc5aa0', '#4f7f2f', '#7777cc', '#00a0aa', '#aa7700'
];

export function idGroupOfId(id) {
  const text = String(id || 'Inconnu');
  const match = text.match(/^([A-Za-z]+\d+)/);
  return match ? match[1] : text.split(/[-_]/)[0] || 'Inconnu';
}

export function colorForGroup(group) {
  const s = String(group || 'Inconnu');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

export function clusterColor(cluster) {
  const colors = [C.purple, C.teal, C.orange, C.accent, C.expose, C.normal];
  return Number(cluster) === -1 ? C.muted : colors[Math.abs(Number(cluster)) % colors.length];
}
