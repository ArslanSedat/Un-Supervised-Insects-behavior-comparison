import numpy as np
from scipy.spatial import ConvexHull
from scipy.stats import pearsonr, gaussian_kde
from scipy.ndimage import gaussian_filter, label
from sklearn.decomposition import PCA

FEAT_NAMES = [
    "vitesse_min", "vitesse_max", "vitesse_moy", "vitesse_std",
    "stabilite", "acc_rms",
    "dvdt_moy", "dvdt_std",
    "jerk_max", "jerk_moy",
    "sinuosity", "dist_totale", "msd_mean",
    "rayon_giration", "aire", "z_std",
    "entropie_angles", "autocorr_dir",
    "elevation_moy", "elevation_std",
    "angular_vel_moy", "angular_vel_max",
    "taux_immobilite",
    "temps_jusqua_immobilite", "ratio_mouvement_arret", "nb_bouts",
    "dist_ruche_mean", "corr_xy_z", "confusion_spatiale",
    "altitude_moy", "altitude_min", "altitude_max",
    "nb_visites_plantes", "nb_fleurs_distinctes_visitees", "time_to_first_visit",
    "temps_proche_plantes",
    "dwell_moy_par_fleur", "transitions_fleurs",
    "temps_inter_visites_moy",
    "latence_florale_moy",
    "indice_grooming",
    "path_efficiency",
    "temps_total_vol", "retour_ruche",
]


def _dist_to_boundary(pt, world_size=(2.5, 2.5, 1.8)):
    x, y, z = pt
    mx, my, mz = world_size
    return min(x, mx - x, y, my - y, z, mz - z)


def _interaction_events(pts, flowers, dt, threshold=0.2):
    """
    Détecte les entrées/sorties dans la zone de chaque fleur.
    Retourne visits_per_flower, dwell_times, visit_order, time_between_visits.
    """
    n_flowers = len(flowers)
    visits_per_flower = [0] * n_flowers
    dwell_times = [[] for _ in range(n_flowers)]
    visit_order = []
    visit_timestamps = []

    inside = None
    enter_t = 0.0

    for i, pt in enumerate(pts):
        t = i * dt
        dists = [np.linalg.norm(pt - np.array(f[:3])) for f in flowers]
        nearest = int(np.argmin(dists))

        if dists[nearest] < threshold:
            if inside is None:
                inside = nearest
                visits_per_flower[nearest] += 1
                visit_order.append(nearest)
                visit_timestamps.append(t)
                enter_t = t
        else:
            if inside is not None:
                dwell_times[inside].append(t - enter_t)
                inside = None

    if inside is not None:
        dwell_times[inside].append(len(pts) * dt - enter_t)

    avg_dwell = [float(np.mean(d)) if d else 0.0 for d in dwell_times]
    transitions = sum(
        1 for j in range(1, len(visit_order)) if visit_order[j] != visit_order[j - 1]
    )
    time_between = [
        visit_timestamps[j] - visit_timestamps[j - 1]
        for j in range(1, len(visit_timestamps))
    ]

    return visits_per_flower, avg_dwell, visit_order, transitions, time_between


def _distinct_flowers_visited(pts, flowers, threshold=0.1):
    """Nombre de fleurs distinctes ayant au moins un point de trajectoire à < threshold m."""
    count = 0
    for f in flowers:
        f_pos = np.array(f[:3])
        if np.any(np.linalg.norm(pts - f_pos, axis=1) < threshold):
            count += 1
    return count


def _time_to_first_visit(pts, flowers, dt, threshold=0.1):
    """
    Temps jusqu'à la première approche (< threshold m) de la première fleur visitée
    (ordre chronologique le long de la trajectoire).
    """
    if not flowers:
        return None
    positions = np.array([f[:3] for f in flowers])
    min_dists = np.min(np.linalg.norm(pts[:, None, :] - positions[None, :, :], axis=2), axis=1)
    hits = np.where(min_dists < threshold)[0]
    if len(hits) == 0:
        return None
    return float(hits[0] * dt)


def _latence_florale(pts, flowers, dt, zone=0.3, touch=0.1):
    """
    Temps moyen entre l'entrée en zone d'approche et le premier contact.
    (Stanley et al. 2016)
    """
    latences = []
    for f in flowers:
        f_pos = np.array(f[:3])
        dist_f = np.linalg.norm(pts - f_pos, axis=1)
        in_zone = dist_f < zone
        in_touch = dist_f < touch

        i = 0
        while i < len(pts):
            if in_zone[i] and not in_touch[i]:
                j = i
                while j < len(pts) and in_zone[j]:
                    if in_touch[j]:
                        latences.append((j - i) * dt)
                        break
                    j += 1
                i = j + 1
            else:
                i += 1

    return float(np.mean(latences)) if latences else 0.0


def compute_features(traj, ruche=None, flowers=None, stats=None, time_step=0.1):
    if len(traj) < 5:
        return None, None

    pts = np.array([[p["x"], p["y"], p["z"]] for p in traj], dtype=float)
    vit = np.array([p.get("vitesse_ms", 0) for p in traj], dtype=float)
    acc = np.array([p.get("acceleration_ms2", 0) for p in traj], dtype=float)
    n = len(pts)
    dt = time_step
    total_duration = (n - 1) * dt

    flowers_arr = []
    if flowers:
        for f in flowers:
            if len(f) >= 3:
                flowers_arr.append((f[0], f[1], f[2]))
            else:
                flowers_arr.append((f[0], f[1], 0.0))

    ruche_arr = np.array(ruche[:2]) if ruche else np.array([0.0, 0.0])
    ruche_z   = float(ruche[2]) if ruche and len(ruche) > 2 else 0.0

    vit_pos     = vit[vit > 0]
    vitesse_min = float(np.min(vit_pos)) if len(vit_pos) > 0 else 0.0
    vitesse_max = (
        float(stats["vitesse_max_ms"])
        if stats and "vitesse_max_ms" in stats
        else (float(np.max(vit_pos)) if len(vit_pos) > 0 else 0.0)
    )
    vitesse_moy = float(np.mean(vit_pos)) if len(vit_pos) > 0 else 0.0
    vitesse_std = float(np.std(vit_pos))  if len(vit_pos) > 1 else 0.0
    cv          = vitesse_std / vitesse_moy if vitesse_moy > 0 else 0.0
    stabilite   = float(1.0 / (1.0 + cv))
    acc_rms     = float(np.sqrt(np.mean(acc ** 2)))

    dvdt        = np.diff(vit) / dt
    dvdt_moy    = float(np.mean(np.abs(dvdt))) if len(dvdt) > 0 else 0.0
    dvdt_std    = float(np.std(dvdt))          if len(dvdt) > 0 else 0.0

    vel_vecs  = np.diff(pts, axis=0) / dt
    acc_vecs  = np.diff(vel_vecs, axis=0) / dt
    jerk_vecs = np.diff(acc_vecs, axis=0) / dt
    jerk_mags = np.linalg.norm(jerk_vecs, axis=1) if len(jerk_vecs) > 0 else np.array([0.0])
    jerk_max  = float(np.max(jerk_mags))
    jerk_moy  = float(np.mean(jerk_mags))

    diffs       = np.diff(pts, axis=0)
    seg         = np.linalg.norm(diffs, axis=1)
    dist_totale = float(np.sum(seg))

    dx = np.diff(pts[:, 0])
    dy = np.diff(pts[:, 1])
    angles      = np.arctan2(dy, dx)
    angle_diffs = np.diff(angles)
    angle_diffs = (angle_diffs + np.pi) % (2 * np.pi) - np.pi

    p_s = float(np.mean(seg))
    c_s = float(np.mean(np.cos(angle_diffs)))
    b_s = float(np.std(seg) / (p_s + 1e-10))
    if p_s > 1e-10 and (1 - c_s) > 1e-6:
        sinuosity = float(2.0 / np.sqrt(p_s * (1 + c_s) / (1 - c_s) + b_s ** 2))
    else:
        sinuosity = 0.0

    lags  = [1, 5, 10, 20, 50]
    msds  = [
        float(np.mean(np.sum((pts[l:] - pts[:-l]) ** 2, axis=1))) if l < n else 0.0
        for l in lags
    ]
    msd_mean  = float(np.mean(msds))


    centroid  = pts.mean(axis=0)
    rayon_gir = float(np.sqrt(np.mean(np.sum((pts - centroid) ** 2, axis=1))))
    pts_xy    = np.unique(pts[:, :2], axis=0)
    if len(pts_xy) >= 3:
        try:    aire = float(ConvexHull(pts_xy).volume)
        except: aire = 0.0
    else:
        aire = 0.0
    z_std = float(np.std(pts[:, 2]))

    hist, _ = np.histogram(angle_diffs, bins=16, range=(-np.pi, np.pi))
    h        = hist / (hist.sum() + 1e-10)
    entropie = float(-np.sum(h[h > 0] * np.log2(h[h > 0])))

    nxy  = np.sqrt(dx ** 2 + dy ** 2) + 1e-10
    dx_  = dx / nxy
    dy_  = dy / nxy
    if len(dx_) > 2:
        dir_vecs     = np.column_stack([dx_, dy_])
        dot_products = np.sum(dir_vecs[:-1] * dir_vecs[1:], axis=1)
        autocorr     = float(np.mean(dot_products))
    else:
        autocorr = 0.0

    dist_xy_step  = np.sqrt(diffs[:, 0] ** 2 + diffs[:, 1] ** 2)
    elev_angles   = np.arctan2(diffs[:, 2], dist_xy_step + 1e-10)
    elevation_moy = float(np.mean(np.abs(elev_angles)))
    elevation_std = float(np.std(elev_angles))

    vel_norms = np.linalg.norm(vel_vecs, axis=1) + 1e-10
    orient    = vel_vecs / vel_norms[:, None]
    if len(orient) >= 2:
        dots        = np.clip(np.sum(orient[:-1] * orient[1:], axis=1), -1.0, 1.0)
        ang_vels    = np.arccos(dots) / dt
        angular_vel_moy = float(np.mean(ang_vels))
        angular_vel_max = float(np.max(ang_vels))
    else:
        angular_vel_moy = angular_vel_max = 0.0

    immobile  = vit < 0.01
    mouvement = ~immobile

    taux_imm = float(np.mean(immobile))

    idx_first_imm = np.where(immobile)[0]
    temps_jusqua_immobilite = (
        float(idx_first_imm[0] * dt) if len(idx_first_imm) > 0 else float(total_duration)
    )

    n_mouv = float(np.sum(mouvement))
    n_arr  = float(np.sum(immobile))
    ratio_mouvement_arret = float((n_arr / (n_mouv + 1)) * 100) if n_mouv > 0 else 100.0

    transitions_imm  = np.diff(mouvement.astype(int))
    nb_bouts = int(np.sum(transitions_imm > 0))

    dist_ruche = np.linalg.norm(pts[:, :2] - ruche_arr, axis=1)
    dist_ruche_mean = float(np.mean(dist_ruche))

    xy_cumul = np.cumsum(np.sqrt(np.sum(np.diff(pts[:, :2], axis=0) ** 2, axis=1)))
    xy_cumul = np.concatenate([[0.0], xy_cumul])
    if np.std(xy_cumul) > 1e-10 and np.std(pts[:, 2]) > 1e-10:
        r, _ = pearsonr(xy_cumul, pts[:, 2])
        corr_xyz = float(r)
    else:
        corr_xyz = 0.0

    grid_res = 0.1
    visited  = set()
    revisits = 0
    for pt in pts:
        cell = (int(pt[0] / grid_res), int(pt[1] / grid_res), int(pt[2] / grid_res))
        if cell in visited:
            revisits += 1
        visited.add(cell)
    confusion_spatiale = float(revisits / (n + 1e-10))


    alt_diffs   = pts[:, 2] - ruche_z
    altitude_moy = float(np.mean(alt_diffs))
    altitude_min = float(np.min(alt_diffs))
    altitude_max = float(np.max(alt_diffs))

    nb_visites_plantes           = 0.0
    nb_fleurs_distinctes_visitees = 0.0
    time_to_first_visit          = 0.0
    temps_proche_plantes         = 0.0
    dwell_moy            = 0.0
    transitions_fl       = 0
    temps_inter_moy      = 0.0
    latence_fl           = 0.0

    if stats and "visites_plantes" in stats:
        nb_visites_plantes = float(stats["visites_plantes"])
    if stats and "duree_butinage" in stats:
        temps_proche_plantes = float(stats["duree_butinage"])

    if flowers_arr:
        (
            visits_per_fl, avg_dwell_per_fl, visit_order,
            transitions_fl, time_between
        ) = _interaction_events(pts, flowers_arr, dt, threshold=0.2)

        if not (stats and "visites_plantes" in stats):
            nb_visites_plantes = float(sum(visits_per_fl))

        if not (stats and "duree_butinage" in stats):
            temps_proche_plantes = float(sum(
                sum(d) for d in [
                    [
                        np.sum(np.linalg.norm(pts - np.array(f[:3]), axis=1) < 0.2) * dt
                        for f in flowers_arr
                    ]
                ]
            ))

        nb_fleurs_distinctes_visitees = float(
            _distinct_flowers_visited(pts, flowers_arr, threshold=0.1)
        )
        ttfv = _time_to_first_visit(pts, flowers_arr, dt, threshold=0.1)
        time_to_first_visit = float(ttfv if ttfv is not None else total_duration)
        dwell_moy       = float(np.mean([d for d in avg_dwell_per_fl if d > 0])) if any(d > 0 for d in avg_dwell_per_fl) else 0.0
        temps_inter_moy = float(np.mean(time_between)) if time_between else 0.0
        latence_fl      = _latence_florale(pts, flowers_arr, dt)

    lbl, n_events = label(immobile)
    durations_imm = [np.sum(lbl == i) * dt for i in range(1, n_events + 1)]
    indice_grooming = float(sum(1 for d in durations_imm if 0.5 < d < 5.0))

    direct_dist  = float(np.linalg.norm(pts[-1] - pts[0]))
    path_eff     = direct_dist / dist_totale if dist_totale > 1e-6 else 1.0

    dist_init_ruche  = float(np.linalg.norm(pts[0,  :2] - ruche_arr))
    dist_final_ruche = float(np.linalg.norm(pts[-1, :2] - ruche_arr))

    if stats and "retour_a_la_ruche" in stats:
        retour_ruche = float(stats["retour_a_la_ruche"])
    else:
        retour_ruche = 1.0 if dist_final_ruche < dist_init_ruche else 0.0

    feat_values = [
        vitesse_min, vitesse_max, vitesse_moy, vitesse_std,
        stabilite, acc_rms,
        dvdt_moy, dvdt_std,
        jerk_max, jerk_moy,
        sinuosity, dist_totale, msd_mean,
        rayon_gir, aire, z_std,
        entropie, autocorr,
        elevation_moy, elevation_std,
        angular_vel_moy, angular_vel_max,
        taux_imm,
        temps_jusqua_immobilite, ratio_mouvement_arret, nb_bouts,
        dist_ruche_mean, corr_xyz, confusion_spatiale,
        altitude_moy, altitude_min, altitude_max,
        nb_visites_plantes, nb_fleurs_distinctes_visitees, time_to_first_visit,
        temps_proche_plantes,
        dwell_moy, float(transitions_fl),
        temps_inter_moy,
        latence_fl,
        indice_grooming,
        path_eff,
        float(total_duration), retour_ruche,
    ]

    feat_dict = {}
    for k, v in zip(FEAT_NAMES, feat_values):
        v = 0.0 if not np.isfinite(v) else float(v)
        feat_dict[k] = round(v, 5)

    feat_vec = [0.0 if not np.isfinite(v) else float(v) for v in feat_values]
    return feat_dict, feat_vec