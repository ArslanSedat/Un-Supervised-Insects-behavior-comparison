

export const HIVE_NEAR_RADIUS = 0.25;
export const FLOWER_RADIUS = 0.15;

function xyDistToHive(p, ruche = [0.1, 0.1, 0]) {
  return Math.hypot((p?.x || 0) - ruche[0], (p?.y || 0) - ruche[1]);
}

function xyDistToNearestFlower(p, flowers = []) {
  if (!flowers.length) return Infinity;
  // distance en 3D, comme dans le calcul backend (evenements_visites),
  // pour que la classification visuelle corresponde aux métriques calculées
  return Math.min(...flowers.map(([fx, fy, fz]) => Math.hypot((p?.x || 0) - fx, (p?.y || 0) - fy, (p?.z || 0) - (fz || 0))));
}

export function classifyPoint(p, flowers = [], ruche = [0.1, 0.1, 0]) {
  const v = p?.v || 0;
  const distToHive = xyDistToHive(p, ruche);
  const nearFlower = xyDistToNearestFlower(p, flowers) < FLOWER_RADIUS;

  if (distToHive < HIVE_NEAR_RADIUS) return 'proche_ruche';
  if (nearFlower && v < 0.15) return 'fleur';
  if (v < 0.05) return 'immobile';

  if (v < 0.25) return 'lent';
  return 'rapide';
}

export function trajectoryTimeline(bee, flowers = [], ruche = [0.1, 0.1, 0]) {
  const points = bee?.points || [];
  return points.map((p, i) => ({ index: i, state: classifyPoint(p, flowers, ruche), point: p }));
}

export function segmentTrajectory(bee, flowers, ruche) {
  const states = { proche_ruche: 0, immobile: 0, fleur: 0, lent: 0, rapide: 0};
  trajectoryTimeline(bee, flowers, ruche).forEach(({ state }) => { states[state] = (states[state] || 0) + 1; });
  return states;
}

export function parseJSON(json, groupOverride) {
  const cage      = json.metadonnees?.cage_experimentale || {};
  const ruche     = cage.ruche_position_m
    ? [cage.ruche_position_m.x, cage.ruche_position_m.y, cage.ruche_position_m.z ?? 0]
    : [0.1, 0.1, 0];
  const worldSize = cage.dimensions_m
    ? [cage.dimensions_m.longueur, cage.dimensions_m.largeur, cage.dimensions_m.hauteur]
    : [2.5, 2.5, 1.8];
  const flowers   = (cage.plantes || []).map(p => [p.x, p.y, p.z ?? 0, p.id]);
  const commentaires = json.metadonnees?.Commentaires || null;

  const bees = [];
  for (const [key, val] of Object.entries(json)) {
    if (!key.startsWith("bourdon_")) continue;
    const group  = groupOverride || val.groupe || "all";
    const metr   = val.metriques || {};
    const stats  = val.statistiques || {};
    const points = (val.trajectoire || []).map(p => ({
      t:p.t,
      x:p.x,
      y:p.y,
      z:p.z,
      v:p.vitesse_ms??0,
      vx:p.vx,
      vy:p.vy,
      vz:p.vz,
      acc:p.acceleration_ms2,
      ax:p.ax,
      ay:p.ay,
      az:p.az,
    }));
    bees.push({
      id: val.id || key, key, group, metriques: metr, points,
      stats: {
        vitesse_min:     metr.vitesse_min     ?? 0,
        vitesse_max:     metr.vitesse_max     ?? 0,
        vitesse_moy:     metr.vitesse_moy     ?? stats.vitesse_moyenne_ms ?? 0,
        vitesse_std:     metr.vitesse_std     ?? 0,
        stabilite:       metr.stabilite       ?? 0,
        acc_rms:         metr.acc_rms         ?? 0,
        dvdt_moy:        metr.dvdt_moy        ?? 0,
        dvdt_std:        metr.dvdt_std        ?? 0,
        jerk_max:        metr.jerk_max        ?? 0,
        jerk_moy:        metr.jerk_moy        ?? 0,
        sinuosity:       metr.sinuosity       ?? 0,
        dist_totale:     metr.dist_totale     ?? 0,
        msd_mean:        metr.msd_mean        ?? 0,
        rayon_giration:  metr.rayon_giration  ?? 0,
        aire:            metr.aire            ?? 0,
        z_std:           metr.z_std           ?? 0,
        entropie_angles: metr.entropie_angles ?? 0,
        autocorr_dir:    metr.autocorr_dir    ?? 0,
        elevation_moy:   metr.elevation_moy   ?? 0,
        elevation_std:   metr.elevation_std   ?? 0,
        angular_vel_moy: metr.angular_vel_moy ?? 0,
        angular_vel_max: metr.angular_vel_max ?? 0,
        taux_immobilite: metr.taux_immobilite ?? 0,
        temps_jusqua_immobilite: metr.temps_jusqua_immobilite ?? 0,
        ratio_mouvement_arret:   metr.ratio_mouvement_arret   ?? 0,
        nb_bouts:                metr.nb_bouts                ?? 0,
        dist_ruche_mean:         metr.dist_ruche_mean         ?? 0,
        corr_xy_z:        metr.corr_xy_z        ?? 0,
        confusion_spatiale: metr.confusion_spatiale ?? 0,
        altitude_moy:     metr.altitude_moy     ?? 0,
        altitude_min:     metr.altitude_min     ?? 0,
        altitude_max:     metr.altitude_max     ?? 0,
        nb_visites_plantes:            metr.nb_visites_plantes            ?? 0,
        nb_fleurs_distinctes_visitees: metr.nb_fleurs_distinctes_visitees ?? 0,
        time_to_first_visit:           metr.time_to_first_visit           ?? 0,
        temps_proche_plantes:          metr.temps_proche_plantes          ?? 0,
        dwell_moy_par_fleur:     metr.dwell_moy_par_fleur     ?? 0,
        transitions_fleurs:      metr.transitions_fleurs      ?? 0,
        temps_inter_visites_moy: metr.temps_inter_visites_moy ?? 0,
        latence_florale_moy:     metr.latence_florale_moy     ?? 0,
        indice_grooming:         metr.indice_grooming         ?? 0,
        path_efficiency:         metr.path_efficiency         ?? 0,
        temps_total_vol:         metr.temps_total_vol         ?? 0,
        retour_ruche:            metr.retour_ruche            ?? 0,
      },
    });
  }
  return { flowers, ruche, worldSize, bees, commentaires };
}

