import numpy as np
import math
from scipy.spatial import ConvexHull
from scipy.stats import pearsonr
from sklearn.decomposition import PCA

FEAT_NAMES = [
    "vitesse_moy", "vitesse_std", "stabilite", "acc_rms",
    "sinuosity", "dist_totale", "msd_mean", "msd_slope",
    "rayon_giration", "aire", "z_std",
    "entropie_angles", "autocorr_dir", "taux_immobilite", "linearite",
    "temps_jusqua_immobilite", "ratio_mouvement_arret", "nb_bouts",
    "dist_ruche_mean", "nb_visites_plantes", "temps_proche_plantes",
    "retour_ruche",
]


def compute_features(traj, ruche=None, flowers=None, stats=None, time_step=0.1):
    if len(traj) < 5:
        return None, None
    
    pts = np.array([[p["x"], p["y"], p["z"]] for p in traj], dtype=float)
    vit = np.array([p.get("vitesse_ms", 0) for p in traj], dtype=float)
    acc = np.array([p.get("acceleration_ms2", 0) for p in traj], dtype=float)
    n = len(pts)

    #Speed & Acceleration
    vit_pos     = vit[vit > 0]
    vitesse_moy = float(np.mean(vit_pos)) if len(vit_pos) > 0 else 0.0
    vitesse_std = float(np.std(vit_pos))  if len(vit_pos) > 1 else 0.0
    stabilite   = max(0.0, 1.0 - vitesse_std / vitesse_moy) if vitesse_moy > 0 else 0.0
    acc_rms     = float(np.sqrt(np.mean(acc ** 2)))

    #Distance & Sinuosity
    diffs       = np.diff(pts, axis=0)
    seg         = np.sqrt(np.sum(diffs ** 2, axis=1))
    dist_totale = float(np.sum(seg))
    dx = np.diff(pts[:, 0])
    dy = np.diff(pts[:, 1])
    angles = np.arctan2(dy, dx)
    angle_diffs = np.diff(angles)
    angle_diffs = (angle_diffs + np.pi) % (2 * np.pi) - np.pi
    p = np.mean(seg) 
    c = np.mean(np.cos(angle_diffs)) 
    b = np.std(seg) / (np.mean(seg) + 1e-10)
    if p > 0 and c < 1:
        sinuosity = float(2.0 / np.sqrt(p * (1 + c) / (1 - c) + b**2))
    else:
        sinuosity = 0.0

    #MSD (Mean Squared Displacement) 
    lags     = [1, 5, 10, 20, 50]
    msds     = [float(np.mean(np.sum((pts[l:] - pts[:-l]) ** 2, axis=1))) if l < n else 0.0 for l in lags]
    msd_mean  = float(np.mean(msds))
    msd_slope = float(np.polyfit(np.log1p(lags), np.log1p(msds), 1)[0])

    #Gyration Radius & Area
    centroid  = pts.mean(axis=0)
    rayon_gir = float(np.sqrt(np.mean(np.sum((pts - centroid) ** 2, axis=1))))
    pts_xy = np.unique(pts[:, :2], axis=0)
    if len(pts_xy) >= 3:
        try:    aire = float(ConvexHull(pts_xy).volume)
        except: aire = 0.0
    else:
        aire = 0.0
    z_std = float(np.std(pts[:, 2]))
    
    #Entropy of angle distribution
    adiffs = angle_diffs
    hist, _ = np.histogram(adiffs, bins=16, range=(-np.pi, np.pi))
    h        = hist / (hist.sum() + 1e-10)
    entropie = float(-np.sum(h[h > 0] * np.log2(h[h > 0])))

    #Directional Autocorrelation
    nxy      = np.sqrt(dx ** 2 + dy ** 2) + 1e-10
    dx_      = dx / nxy
    dy_      = dy / nxy
    try:
        if len(dx_) > 2:
            dir_vecs = np.column_stack([dx_, dy_])
            dot_products = np.sum(dir_vecs[:-1] * dir_vecs[1:], axis=1)
            autocorr = float(np.mean(dot_products))
        else:
            autocorr = 0.0

    #Immobility Rate & Linearity
    except: autocorr = 0.0

    taux_imm = float(np.mean(vit < 0.01))

    pca1 = PCA(n_components=1)
    pca1.fit(pts - pts.mean(axis=0))
    linearite = float(pca1.explained_variance_ratio_[0])

    total_duration = (n - 1) * time_step

    # temps_jusqua_immobilite
    immobile = vit < 0.01
    idx_first_immobile = np.where(immobile)[0]
    if len(idx_first_immobile) > 0:
        temps_jusqua_immobilite = float(idx_first_immobile[0] * time_step)
    else:
        temps_jusqua_immobilite = float(total_duration)
    
    #ratio_mouvement_arret
    mouvement = vit >= 0.01
    n_mouvement = float(np.sum(mouvement))
    n_arret = float(np.sum(immobile))
    ratio_mouvement_arret = float((n_arret / (n_mouvement + 1)) * 100) if n_mouvement > 0 else 100.0
    
    #nb_bouts
    transitions = np.diff(mouvement.astype(int))
    total_transitions = float(np.sum(np.abs(transitions)))

    #Hive & Flower Interactions
    duration_minutes = total_duration / 60.0
    nb_bouts = total_transitions / (duration_minutes + 0.1)
    
    ruche_arr = np.array(ruche[:2]) if ruche else np.array([0.0, 0.0])
    dist_ruche = np.sqrt(np.sum((pts[:, :2] - ruche_arr) ** 2, axis=1))
    dist_ruche_mean = float(np.mean(dist_ruche))
    
    nb_visites_plantes = 0.0
    temps_proche_plantes = 0.0
    if stats and "visites_plantes" in stats:
        nb_visites_plantes = float(stats["visites_plantes"])
    elif stats and "duree_butinage" in stats:
        temps_proche_plantes = float(stats["duree_butinage"])
    else:
        if flowers:
            for fx, fy, fz, fid in flowers:
                flower_pos = np.array([fx, fy])
                dist_flower = np.sqrt(np.sum((pts[:, :2] - flower_pos) ** 2, axis=1))
                nb_visites_plantes += float(np.sum(dist_flower < 0.1))
                temps_proche_plantes += float(np.sum(dist_flower < 0.15))

    #Hive Return
        nb_visites_plantes = float(nb_visites_plantes)
        temps_proche_plantes = float(temps_proche_plantes)
    
    dist_init_ruche = float(np.sqrt(np.sum((pts[0, :2] - ruche_arr) ** 2)))
    dist_final_ruche = float(np.sqrt(np.sum((pts[-1, :2] - ruche_arr) ** 2)))
    if stats and "retour_a_la_ruche" in stats:
        retour_ruche = float(stats["retour_a_la_ruche"])


    else:
        retour_ruche = float(1.0 if dist_final_ruche < dist_init_ruche else 0.0)

    feat_dict = {}
    feat_values = [
        vitesse_moy, vitesse_std, stabilite, acc_rms,
        sinuosity, dist_totale, msd_mean, msd_slope,
        rayon_gir, aire, z_std,
        entropie, autocorr, taux_imm, linearite,
        temps_jusqua_immobilite, ratio_mouvement_arret, nb_bouts,
        dist_ruche_mean, nb_visites_plantes, temps_proche_plantes,
        retour_ruche,
    ]
    
    for k, v in zip(FEAT_NAMES, feat_values):
        if not np.isfinite(v):
            v = 0.0
        feat_dict[k] = round(float(v), 5)
    
    feat_vec = [0.0 if not np.isfinite(v) else float(v) for v in feat_values]
    return feat_dict, feat_vec
