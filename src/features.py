import numpy as np
import math
from scipy.spatial import ConvexHull
from scipy.stats import pearsonr
from sklearn.decomposition import PCA

FEAT_NAMES = [
    "vitesse_moy", "vitesse_std", "stabilite", "acc_rms",
    "tortuosite", "dist_totale", "msd_mean", "msd_slope",
    "katz_fd", "rayon_giration", "aire", "z_std",
    "entropie_angles", "autocorr_dir", "taux_immobilite", "linearite",
    "temps_jusqua_immobilite", "ratio_mouvement_arret", "nb_bouts",
    "dist_ruche_mean", "nb_visites_plantes", "temps_proche_plantes",
    "retour_ruche",
]


def compute_features(traj, ruche=None, flowers=None, stats=None):
    if len(traj) < 5:
        return None, None
    
    pts = np.array([[p["x"], p["y"], p["z"]] for p in traj], dtype=float)
    vit = np.array([p.get("vitesse_ms", 0) for p in traj], dtype=float)
    acc = np.array([p.get("acceleration_ms2", 0) for p in traj], dtype=float)
    n = len(pts)

    vit_pos     = vit[vit > 0]
    vitesse_moy = float(np.mean(vit_pos)) if len(vit_pos) > 0 else 0.0
    vitesse_std = float(np.std(vit_pos))  if len(vit_pos) > 1 else 0.0
    stabilite   = max(0.0, 1.0 - vitesse_std / vitesse_moy) if vitesse_moy > 0 else 0.0
    acc_rms     = float(np.sqrt(np.mean(acc ** 2)))

    diffs       = np.diff(pts, axis=0)
    seg         = np.sqrt(np.sum(diffs ** 2, axis=1))
    dist_totale = float(np.sum(seg))
    dist_dir    = float(np.linalg.norm(pts[-1] - pts[0]))
    tortuosite  = dist_dir / dist_totale if dist_totale > 0 else 0.0

    lags     = [1, 5, 10, 20, 50]
    msds     = [float(np.mean(np.sum((pts[l:] - pts[:-l]) ** 2, axis=1))) if l < n else 0.0 for l in lags]
    msd_mean  = float(np.mean(msds))
    msd_slope = float(np.polyfit(np.log1p(lags), np.log1p(msds), 1)[0])

    d_max   = float(np.max(np.sqrt(np.sum((pts - pts[0]) ** 2, axis=1))))
    katz_fd = (math.log10(n) / (math.log10(n) + math.log10(d_max / dist_totale))
               if d_max > 0 and dist_totale > 0 and n > 1 else 1.0)

    centroid  = pts.mean(axis=0)
    rayon_gir = float(np.sqrt(np.mean(np.sum((pts - centroid) ** 2, axis=1))))

    pts_xy = np.unique(pts[:, :2], axis=0)
    if len(pts_xy) >= 3:
        try:    aire = float(ConvexHull(pts_xy).volume)
        except: aire = 0.0
    else:
        aire = 0.0

    z_std = float(np.std(pts[:, 2]))

    dx = np.diff(pts[:, 0]); dy = np.diff(pts[:, 1])
    angles = np.arctan2(dy, dx)
    adiffs = np.diff(angles)
    adiffs = (adiffs + np.pi) % (2 * np.pi) - np.pi
    hist, _ = np.histogram(adiffs, bins=16, range=(-np.pi, np.pi))
    h        = hist / (hist.sum() + 1e-10)
    entropie = float(-np.sum(h[h > 0] * np.log2(h[h > 0])))

    nxy      = np.sqrt(dx ** 2 + dy ** 2) + 1e-10
    dx_      = dx / nxy
    try:    autocorr = float(pearsonr(dx_[:-1], dx_[1:])[0]) if len(dx_) > 2 else 0.0
    except: autocorr = 0.0

    taux_imm = float(np.mean(vit < 0.01))

    pca1 = PCA(n_components=1)
    pca1.fit(pts - pts.mean(axis=0))
    linearite = float(pca1.explained_variance_ratio_[0])

    immobile = vit < 0.01
    temps_jusqua_immobilite = float(np.where(immobile)[0][0] if np.any(immobile) else n)
    
    mouvement = vit >= 0.01
    n_mouvement = float(np.sum(mouvement))
    n_arret = float(np.sum(immobile))
    ratio_mouvement_arret = float(n_mouvement / (n_arret + 1e-6))
    
    transitions = np.diff(mouvement.astype(int))
    nb_bouts = float(np.sum(transitions == 1))
    
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
        tortuosite, dist_totale, msd_mean, msd_slope,
        katz_fd, rayon_gir, aire, z_std,
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
