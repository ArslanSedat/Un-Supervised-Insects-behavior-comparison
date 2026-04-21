from flask import Flask, request, jsonify
from flask_cors import CORS
import json, math, warnings
import numpy as np
from scipy.spatial import ConvexHull
from scipy.stats import mannwhitneyu, pearsonr
from sklearn.decomposition import PCA
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import accuracy_score, roc_auc_score

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

store = {
    "temoin": {"feats": [], "ids": []},
    "expose": {"feats": [], "ids": []},
}

FEAT_NAMES = [
    "vitesse_moy", "vitesse_std", "stabilite", "acc_rms",
    "tortuosite", "dist_totale", "msd_mean", "msd_slope",
    "katz_fd", "rayon_giration", "aire", "z_std",
    "entropie_angles", "autocorr_dir", "taux_immobilite", "linearite",
    "temps_jusqua_immobilite", "ratio_mouvement_arret", "nb_bouts",
    "dist_ruche_mean", "nb_visites_plantes", "temps_proche_plantes",
    "biais_vers_ruche", "angle_moyen_ruche", "retour_ruche",
]


def compute_features(traj, ruche=None, flowers=None):
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

    # Nouvelles features
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
    if flowers:
        for fx, fy, fz, fid in flowers:
            flower_pos = np.array([fx, fy])
            dist_flower = np.sqrt(np.sum((pts[:, :2] - flower_pos) ** 2, axis=1))
            nb_visites_plantes += float(np.sum(dist_flower < 0.1))
            temps_proche_plantes += float(np.sum(dist_flower < 0.15))
    nb_visites_plantes = float(nb_visites_plantes)
    temps_proche_plantes = float(temps_proche_plantes)
    
    direction_moyennes = np.diff(pts[:, :2], axis=0)
    direction_moyennes_norm = direction_moyennes / (np.linalg.norm(direction_moyennes, axis=1, keepdims=True) + 1e-10)
    direction_vers_ruche = (ruche_arr - pts[:-1, :2]) / (np.linalg.norm(ruche_arr - pts[:-1, :2], axis=1, keepdims=True) + 1e-10)
    dot_products = np.sum(direction_moyennes_norm * direction_vers_ruche, axis=1)
    biais_vers_ruche = float(np.mean(dot_products))
    
    vecteurs_ruche = ruche_arr - pts[:, :2]
    distances_ruche = np.linalg.norm(vecteurs_ruche, axis=1)
    # Éviter division par zéro : filtrer les vecteurs nuls
    mask_nonzero = distances_ruche > 1e-6
    
    if np.any(mask_nonzero):
        vecteurs_ruche_norm = vecteurs_ruche[mask_nonzero] / distances_ruche[mask_nonzero, np.newaxis]
        angles_vers_ruche = np.arctan2(vecteurs_ruche_norm[:, 1], vecteurs_ruche_norm[:, 0])
        angle_moyen_ruche = float(np.arctan2(np.nanmean(np.sin(angles_vers_ruche)), np.nanmean(np.cos(angles_vers_ruche))))
    else:
        angle_moyen_ruche = 0.0
    
    if np.isnan(angle_moyen_ruche):
        angle_moyen_ruche = 0.0
    
    dist_init_ruche = float(np.sqrt(np.sum((pts[0, :2] - ruche_arr) ** 2)))
    dist_final_ruche = float(np.sqrt(np.sum((pts[-1, :2] - ruche_arr) ** 2)))
    retour_ruche = float(1.0 if dist_final_ruche < dist_init_ruche else 0.0)

    feat_dict = {}
    feat_values = [
        vitesse_moy, vitesse_std, stabilite, acc_rms,
        tortuosite, dist_totale, msd_mean, msd_slope,
        katz_fd, rayon_gir, aire, z_std,
        entropie, autocorr, taux_imm, linearite,
        temps_jusqua_immobilite, ratio_mouvement_arret, nb_bouts,
        dist_ruche_mean, nb_visites_plantes, temps_proche_plantes,
        biais_vers_ruche, angle_moyen_ruche, retour_ruche,
    ]
    
    for k, v in zip(FEAT_NAMES, feat_values):
        # Remplacer NaN/inf par 0
        if not np.isfinite(v):
            v = 0.0
        feat_dict[k] = round(float(v), 5)
    
    feat_vec = [0.0 if not np.isfinite(v) else float(v) for v in feat_values]
    return feat_dict, feat_vec


def run_pca_svm(feats_t, feats_e, ids_t, ids_e):
    X_t   = np.array(feats_t, dtype=float)
    X_e   = np.array(feats_e, dtype=float)
    X_all = np.vstack([X_t, X_e])
    y_all = np.array([0] * len(X_t) + [1] * len(X_e))
    ids_all = ids_t + ids_e

    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X_all)

    pca_full = PCA(n_components=min(X_scaled.shape[0] - 1, X_scaled.shape[1]))
    pca_full.fit(X_scaled)
    all_var  = [round(float(v), 4) for v in pca_full.explained_variance_ratio_]

    pca2   = PCA(n_components=2, random_state=42)
    X_2d   = pca2.fit_transform(X_scaled)
    var_exp = [round(float(v), 4) for v in pca2.explained_variance_ratio_]
    cum_var = list(np.round(np.cumsum(pca2.explained_variance_ratio_), 4))

    loadings = {
        "feature_names": FEAT_NAMES,
        "pc1": [round(float(v), 4) for v in pca2.components_[0]],
        "pc2": [round(float(v), 4) for v in pca2.components_[1]],
    }

    svm = SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=42)

    loo = LeaveOneOut()
    preds, probas, truths = [], [], []
    for tr, te in loo.split(X_2d):
        s = SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=42)
        s.fit(X_2d[tr], y_all[tr])
        preds.append(int(s.predict(X_2d[te])[0]))
        probas.append(float(s.predict_proba(X_2d[te])[0][1]))
        truths.append(int(y_all[te[0]]))

    acc = float(accuracy_score(truths, preds))
    try:    auc = float(roc_auc_score(truths, probas))
    except: auc = 0.5

    svm.fit(X_2d, y_all)

    mg = 0.8
    x1mn, x1mx = X_2d[:, 0].min() - mg, X_2d[:, 0].max() + mg
    x2mn, x2mx = X_2d[:, 1].min() - mg, X_2d[:, 1].max() + mg
    res = 65
    xx, yy = np.meshgrid(np.linspace(x1mn, x1mx, res), np.linspace(x2mn, x2mx, res))
    grid   = np.c_[xx.ravel(), yy.ravel()]
    Z_prob = svm.predict_proba(grid)[:, 1].reshape(res, res)

    svm_pred  = svm.predict(X_2d)
    svm_proba = svm.predict_proba(X_2d)[:, 1]
    svm_dist  = svm.decision_function(X_2d)

    per_bee = {}
    for i, bid in enumerate(ids_all):
        per_bee[bid] = {
            "group":         int(y_all[i]),
            "svm_pred":      int(svm_pred[i]),
            "svm_proba":     round(float(svm_proba[i]), 4),
            "dist_frontier": round(float(svm_dist[i]), 4),
            "is_normal":     bool(svm_pred[i] == 0),
            "pca_x":         round(float(X_2d[i, 0]), 4),
            "pca_y":         round(float(X_2d[i, 1]), 4),
            "features":      {FEAT_NAMES[j]: round(float(X_all[i, j]), 5)
                              for j in range(len(FEAT_NAMES))},
        }

    feat_disc = {}
    for j, fname in enumerate(FEAT_NAMES):
        vals_t = X_t[:, j]; vals_e = X_e[:, j]
        try:    _, p_mw = mannwhitneyu(vals_t, vals_e, alternative="two-sided")
        except: p_mw = 1.0
        nt, ne = len(vals_t), len(vals_e)
        u1     = sum(1 if a > b else 0.5 if a == b else 0 for a in vals_t for b in vals_e)
        rb     = (2 * u1 / (nt * ne) - 1) if nt > 0 and ne > 0 else 0.0
        feat_disc[fname] = {
            "p_mannwhitney":  round(float(p_mw), 4),
            "effect_size_rb": round(float(rb), 4),
            "pc1_loading":    round(float(pca2.components_[0][j]), 4),
            "pc2_loading":    round(float(pca2.components_[1][j]), 4),
            "mean_temoin":    round(float(np.mean(vals_t)), 5),
            "mean_expose":    round(float(np.mean(vals_e)), 5),
            "std_temoin":     round(float(np.std(vals_t)), 5),
            "std_expose":     round(float(np.std(vals_e)), 5),
        }

    return {
        "pca": {
            "variance_explained": var_exp,
            "cumulative_variance": cum_var,
            "all_variance":        all_var[:10],
            "loadings":            loadings,
        },
        "svm": {
            "accuracy_loo": round(acc, 4),
            "auc_loo":      round(auc, 4),
            "boundary": {
                "xx":      [[round(float(v), 3) for v in row] for row in xx],
                "yy":      [[round(float(v), 3) for v in row] for row in yy],
                "Z_prob":  [[round(float(v), 3) for v in row] for row in Z_prob],
                "x1_range": [round(float(x1mn), 3), round(float(x1mx), 3)],
                "x2_range": [round(float(x2mn), 3), round(float(x2mx), 3)],
            },
            "per_bee":  per_bee,
        },
        "feature_discrimination": feat_disc,
        "ids":        ids_all,
        "labels":     [0] * len(feats_t) + [1] * len(feats_e),
        "n_normal":   int(np.sum(svm_pred == 0)),
        "n_abnormal": int(np.sum(svm_pred == 1)),
    }


@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        file  = request.files["file"]
        group = request.form.get("group", "")
        data  = json.load(file)

        cage = data.get("metadonnees", {}).get("cage_experimentale", {})
        ruche_pos = cage.get("ruche_position_m", {})
        ruche = [ruche_pos.get("x", 0.1), ruche_pos.get("y", 0.1), ruche_pos.get("z", 0)]
        flowers = [(p["x"], p["y"], p.get("z", 0), p.get("id", i)) for i, p in enumerate(cage.get("plantes", []))]

        for key, val in data.items():
            if not key.startswith("bourdon_"):
                continue
            feat_dict, feat_vec = compute_features(val.get("trajectoire", []), ruche=ruche, flowers=flowers)
            
            if feat_dict is None:
                feat_dict = {fname: 0.0 for fname in FEAT_NAMES}
            else:
                bee_id = val.get("id", key)
                if group in store and feat_vec is not None:
                    store[group]["feats"].append(feat_vec)
                    store[group]["ids"].append(bee_id)
            
            val["metriques"] = feat_dict

        ml_result = None
        if store["temoin"]["feats"] and store["expose"]["feats"]:
            try:
                ml_result = run_pca_svm(
                    store["temoin"]["feats"], store["expose"]["feats"],
                    store["temoin"]["ids"],   store["expose"]["ids"],
                )
            except Exception as e:
                import traceback; traceback.print_exc()

        data["_ml"] = ml_result
        return jsonify(data)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/reset", methods=["POST"])
def reset():
    store["temoin"] = {"feats": [], "ids": []}
    store["expose"] = {"feats": [], "ids": []}
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
