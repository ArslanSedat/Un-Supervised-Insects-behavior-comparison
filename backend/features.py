import numpy as np
from scipy.spatial import ConvexHull
from scipy.stats import pearsonr
from scipy.ndimage import label

FEAT_NAMES = ["vitesse_min", "vitesse_max", "vitesse_moy", "vitesse_std","stabilite", "acc_rms","dvdt_moy", "dvdt_std","jerk_max", "jerk_moy","sinuosity", "dist_totale", "msd_mean","rayon_giration", "aire", "z_std","entropie_angles", "autocorr_dir","elevation_moy", "elevation_std","angular_vel_moy", "angular_vel_max","taux_immobilite","temps_jusqua_immobilite", "ratio_mouvement_arret", "nb_bouts","dist_ruche_mean", "corr_xy_z", "confusion_spatiale","altitude_moy", "altitude_min", "altitude_max","nb_visites_plantes", "nb_fleurs_distinctes_visitees", "time_to_first_visit","temps_proche_plantes", "dwell_moy_par_fleur", "transitions_fleurs", "temps_inter_visites_moy", "latence_florale_moy", "indice_grooming", "path_efficiency", "temps_total_vol", "retour_ruche"]

def wrap_angle(angle):
    return (angle + np.pi) % (2 * np.pi) - np.pi


def circular_mean(angles):
    if len(angles) == 0:
        return 0.0
    vectors = np.exp(1j * angles)
    return float(np.angle(np.mean(vectors)))


def circular_entropy(angles, bins=16):
    if len(angles) == 0:
        return 0.0
    centered = wrap_angle(angles - circular_mean(angles))
    hist, _ = np.histogram(centered, bins=bins, range=(-np.pi, np.pi))
    total = hist.sum()
    if total == 0:
        return 0.0
    probs = hist[hist > 0] / total
    return float(-np.sum(probs * np.log2(probs)))


def nearest_flower(point, flowers):
    dists = np.linalg.norm(flowers - point, axis=1)
    idx = int(np.argmin(dists))
    return idx, dists[idx]


def flower_visits(points, flowers, dt, threshold):
    n_flowers = len(flowers)
    visits = [0] * n_flowers
    durations = [[] for _ in range(n_flowers)]
    order = []
    visit_times = []
    current = None
    enter_time = 0.0

    for i, point in enumerate(points):
        t = i * dt
        idx, dist = nearest_flower(point, flowers)
        if dist < threshold:
            if current is None:
                current = idx
                visits[idx] += 1
                order.append(idx)
                visit_times.append(t)
                enter_time = t
        elif current is not None:
            durations[current].append(t - enter_time)
            current = None

    if current is not None:
        durations[current].append(len(points) * dt - enter_time)

    avg_duration = [float(np.mean(d)) if d else 0.0 for d in durations]
    total_duration = float(sum(sum(d) for d in durations))
    transitions = sum(1 for j in range(1, len(order)) if order[j] != order[j - 1])
    gaps = list(np.diff(visit_times))

    return visits, avg_duration, total_duration, transitions, gaps


def distinct_flowers_visited(points, flowers, threshold):
    count = 0
    for flower in flowers:
        if np.any(np.linalg.norm(points - flower, axis=1) < threshold):
            count += 1
    return count


def first_visit_time(points, flowers, dt, threshold):
    min_dist = np.min(np.linalg.norm(points[:, None, :] - flowers[None, :, :], axis=2), axis=1)
    hits = np.where(min_dist < threshold)[0]
    if len(hits) == 0:
        return None
    return float(hits[0] * dt)


def flower_latency(points, flowers, dt, threshold):
    # time from entering a flower's approach zone (3x threshold) to contact
    zone = 3 * threshold
    latencies = []
    for flower in flowers:
        dist = np.linalg.norm(points - flower, axis=1)
        in_zone = dist < zone
        at_contact = dist < threshold
        i = 0
        while i < len(points):
            if in_zone[i] and not at_contact[i]:
                j = i
                while j < len(points) and in_zone[j]:
                    if at_contact[j]:
                        latencies.append((j - i) * dt)
                        break
                    j += 1
                i = j + 1
            else:
                i += 1
    return float(np.mean(latencies)) if latencies else 0.0


def compute_features(traj, ruche=None, flowers=None, stats=None, time_step=0.1):
    if len(traj) < 5:
        return None, None

    pts = np.array([[p["x"], p["y"], p["z"]] for p in traj], dtype=float)
    speed = np.array([p.get("vitesse_ms", 0) for p in traj], dtype=float)
    acc = np.array([p.get("acceleration_ms2", 0) for p in traj], dtype=float)
    n = len(pts)

    t = np.array([p.get("t", i) for i, p in enumerate(traj)], dtype=float)
    dts = np.diff(t)
    dt = float(np.median(dts[dts > 0])) if np.any(dts > 0) else time_step
    total_time = (n - 1) * dt

    flower_pos = np.array([[f[0], f[1], f[2] if len(f) >= 3 else 0.0] for f in flowers]) if flowers else np.empty((0, 3))
    hive_xy = np.array(ruche[:2]) if ruche else np.array([0.0, 0.0])
    hive_z = float(ruche[2]) if ruche and len(ruche) > 2 else 0.0

    # --- Speed ---
    speed_pos = speed[speed > 0]
    speed_min = float(np.min(speed_pos)) if len(speed_pos) > 0 else 0.0
    speed_max = float(stats["vitesse_max_ms"]) if stats and "vitesse_max_ms" in stats else (float(np.max(speed_pos)) if len(speed_pos) > 0 else 0.0)
    speed_mean = float(np.mean(speed_pos)) if len(speed_pos) > 0 else 0.0
    speed_std = float(np.std(speed_pos)) if len(speed_pos) > 1 else 0.0
    cv = speed_std / speed_mean if speed_mean > 0 else 0.0
    stability = float(1.0 / (1.0 + cv))

    # --- Acceleration / jerk (derivatives of position, sensitive to measurement noise) ---
    acc_rms = float(np.sqrt(np.mean(acc ** 2)))
    dvdt = np.diff(speed) / dt
    dvdt_mean = float(np.mean(np.abs(dvdt))) if len(dvdt) > 0 else 0.0
    dvdt_std = float(np.std(dvdt)) if len(dvdt) > 0 else 0.0

    vel_vecs = np.diff(pts, axis=0) / dt
    acc_vecs = np.diff(vel_vecs, axis=0) / dt
    jerk_vecs = np.diff(acc_vecs, axis=0) / dt
    jerk_norm = np.linalg.norm(jerk_vecs, axis=1) if len(jerk_vecs) > 0 else np.array([0.0])
    jerk_max = float(np.max(jerk_norm))
    jerk_mean = float(np.mean(jerk_norm))

    # --- Path shape ---
    steps = np.diff(pts, axis=0)
    step_len = np.linalg.norm(steps, axis=1)
    total_dist = float(np.sum(step_len))

    dx = steps[:, 0]
    dy = steps[:, 1]
    step_xy = np.sqrt(dx ** 2 + dy ** 2)
    moving = step_xy > 1e-10
    headings = np.arctan2(dy[moving], dx[moving])
    step_times = t[1:][moving]  # timestamp of each retained step
    turn_angles = wrap_angle(np.diff(headings)) if len(headings) >= 2 else np.array([])
    turn_dt = np.diff(step_times) if len(step_times) >= 2 else np.array([])

    mean_step = float(np.mean(step_len))
    mean_cos = float(np.mean(np.cos(turn_angles))) if len(turn_angles) > 0 else 1.0
    step_cv = float(np.std(step_len) / (mean_step + 1e-10))
    if mean_step > 1e-10 and (1 - mean_cos) > 1e-6:
        # Benhamou (2004): S = 2 / sqrt(p(1+c)/(1-c) + b^2)
        sinuosity = float(2.0 / np.sqrt(mean_step * (1 + mean_cos) / (1 - mean_cos) + step_cv ** 2))
    else:
        sinuosity = 0.0

    # MSD over fixed time lags in seconds (not raw sample counts), so it's
    # comparable across trajectories sampled at different rates
    lag_seconds = [0.1, 0.5, 1.0, 2.0, 5.0]
    lags = sorted(set(max(1, round(s / dt)) for s in lag_seconds if round(s / dt) < n))
    msd_vals = [float(np.mean(np.sum((pts[l:] - pts[:-l]) ** 2, axis=1))) for l in lags]
    msd_mean = float(np.mean(msd_vals)) if msd_vals else 0.0

    centroid = pts.mean(axis=0)
    gyration_radius = float(np.sqrt(np.mean(np.sum((pts - centroid) ** 2, axis=1))))

    xy_unique = np.unique(pts[:, :2], axis=0)
    area = 0.0
    if len(xy_unique) >= 3:
        try:
            area = float(ConvexHull(xy_unique).volume)
        except Exception:
            area = 0.0

    z_std = float(np.std(pts[:, 2]))
    angle_entropy = circular_entropy(turn_angles)
    autocorr_dir = float(np.mean(np.cos(turn_angles))) if len(turn_angles) > 0 else 0.0

    step_xy_full = np.sqrt(steps[:, 0] ** 2 + steps[:, 1] ** 2)
    elevation_angle = np.arctan2(steps[:, 2], step_xy_full + 1e-10)
    elevation_mean = float(np.mean(np.abs(elevation_angle)))
    elevation_std = float(np.std(elevation_angle))

    if len(turn_angles) > 0:
        # divide by the real elapsed time between the two retained steps, not
        # dt, since stationary steps may have been filtered out in between
        elapsed = np.where(turn_dt > 0, turn_dt, dt)
        angular_speed = np.abs(turn_angles) / elapsed
        angular_vel_mean = float(np.mean(angular_speed))
        angular_vel_max = float(np.max(angular_speed))
    else:
        angular_vel_mean = angular_vel_max = 0.0

    # --- Immobility ---
    still = speed < 0.01
    active = ~still
    still_rate = float(np.mean(still))
    first_still = np.where(still)[0]
    time_to_still = float(first_still[0] * dt) if len(first_still) > 0 else float(total_time)
    n_active = float(np.sum(active))
    n_still = float(np.sum(still))
    # move_still_ratio = time active per unit of time still
    move_still_ratio = float((n_active / (n_still + 1)) * 100) if n_still > 0 else 100.0
    state_changes = np.diff(active.astype(int))
    n_bouts = int(np.sum(state_changes > 0))

    # --- Position relative to hive ---
    hive_dist = np.linalg.norm(pts[:, :2] - hive_xy, axis=1)
    hive_dist_mean = float(np.mean(hive_dist))

    # step-by-step correlation, not a cumulative sum against a raw value
    # (that would inflate the correlation artificially)
    vertical_step = np.abs(steps[:, 2])
    if np.std(step_xy_full) > 1e-10 and np.std(vertical_step) > 1e-10:
        corr_xyz, _ = pearsonr(step_xy_full, vertical_step)
        corr_xyz = float(corr_xyz)
    else:
        corr_xyz = 0.0

    # floor, not truncation, so negative coordinates land in the right cell
    grid_res = 0.1
    visited_cells = set()
    revisits = 0
    for point in pts:
        cell = tuple(np.floor(point / grid_res).astype(int))
        if cell in visited_cells:
            revisits += 1
        visited_cells.add(cell)
    spatial_confusion = float(revisits / n)

    altitude = pts[:, 2] - hive_z
    altitude_mean = float(np.mean(altitude))
    altitude_min = float(np.min(altitude))
    altitude_max = float(np.max(altitude))

    # --- Flower interactions ---
    threshold = 0.15  # detection distance, should match real flower size
    n_visits = float(stats["visites_plantes"]) if stats and "visites_plantes" in stats else 0.0
    time_near_flowers = float(stats["duree_butinage"]) if stats and "duree_butinage" in stats else 0.0
    n_distinct_flowers = 0.0
    first_visit = 0.0
    dwell_mean = 0.0
    transitions = 0
    mean_gap = 0.0
    latency = 0.0

    if len(flower_pos) > 0:
        visits, avg_duration, total_duration, transitions, gaps = flower_visits(pts, flower_pos, dt, threshold)
        if not (stats and "visites_plantes" in stats):
            n_visits = float(sum(visits))
        if not (stats and "duree_butinage" in stats):
            time_near_flowers = total_duration
        n_distinct_flowers = float(distinct_flowers_visited(pts, flower_pos, threshold))
        fv = first_visit_time(pts, flower_pos, dt, threshold)
        first_visit = float(fv if fv is not None else total_time)
        positive_durations = [d for d in avg_duration if d > 0]
        dwell_mean = float(np.mean(positive_durations)) if positive_durations else 0.0
        mean_gap = float(np.mean(gaps)) if len(gaps) > 0 else 0.0
        latency = flower_latency(pts, flower_pos, dt, threshold)

    # --- Pauses / prolonged immobility ---
    labels, n_pauses = label(still)
    pause_durations = [np.sum(labels == i) * dt for i in range(1, n_pauses + 1)]
    grooming_index = float(sum(1 for d in pause_durations if 0.5 < d < 5.0))

    # --- Return to hive ---
    direct_dist = float(np.linalg.norm(pts[-1] - pts[0]))
    path_efficiency = direct_dist / total_dist if total_dist > 1e-6 else 1.0
    start_hive_dist = float(np.linalg.norm(pts[0, :2] - hive_xy))
    end_hive_dist = float(np.linalg.norm(pts[-1, :2] - hive_xy))
    if stats and "retour_a_la_ruche" in stats:
        returned_home = float(stats["retour_a_la_ruche"])
    else:
        returned_home = 1.0 if end_hive_dist < start_hive_dist else 0.0

    values = [speed_min, speed_max, speed_mean, speed_std, stability, acc_rms, dvdt_mean, dvdt_std, jerk_max, jerk_mean,
              sinuosity, total_dist, msd_mean, gyration_radius, area, z_std, angle_entropy, autocorr_dir, elevation_mean, elevation_std,
              angular_vel_mean, angular_vel_max, still_rate, time_to_still, move_still_ratio, n_bouts,
              hive_dist_mean, corr_xyz, spatial_confusion, altitude_mean, altitude_min, altitude_max,
              n_visits, n_distinct_flowers, first_visit, time_near_flowers, dwell_mean, float(transitions),
              mean_gap, latency, grooming_index, path_efficiency, float(total_time), returned_home]

    feat_dict = {name: round(v if np.isfinite(v) else 0.0, 5) for name, v in zip(FEAT_NAMES, values)}
    feat_vec = [v if np.isfinite(v) else 0.0 for v in values]
    return feat_dict, feat_vec
