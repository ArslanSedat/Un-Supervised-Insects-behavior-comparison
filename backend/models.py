import numpy as np
from scipy.stats import kruskal, false_discovery_control
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier

try:
    import shap
    HAS_SHAP = True
except ImportError:
    shap = None
    HAS_SHAP = False

try:
    import umap
    HAS_UMAP = True
except ImportError:
    umap = None
    HAS_UMAP = False

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    hdbscan = None
    HAS_HDBSCAN = False

from features import FEAT_NAMES

def safe_float(value, decimals=None):
    value = float(value)
    if not np.isfinite(value):
        return 0.0
    return round(value, decimals) if decimals is not None else value


def pca_2d(x_scaled, ids, feat_names):
    n_components = min(2, x_scaled.shape[0], x_scaled.shape[1])
    pca = PCA(n_components=n_components, random_state=42)
    coords = pca.fit_transform(x_scaled)
    if coords.shape[1] == 1:
        coords = np.hstack([coords, np.zeros((coords.shape[0], 1))])

    # loading = eigenvector * sqrt(eigenvalue), i.e. correlation with the axis
    loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
    if loadings.shape[1] == 1:
        loadings = np.hstack([loadings, np.zeros((loadings.shape[0], 1))])

    return {
        "variance_explained": [safe_float(v, 4) for v in pca.explained_variance_ratio_],
        "pca_per_bee": {ids[i]: {"pca_x": safe_float(coords[i, 0], 4), "pca_y": safe_float(coords[i, 1], 4)} for i in range(len(ids))},
        "loadings": {feat_names[j]: {"pc1": safe_float(loadings[j, 0], 6), "pc2": safe_float(loadings[j, 1], 6)} for j in range(len(feat_names))},
    }


def pca_full(x_scaled, feat_names, max_components=10):
    n_components = min(max_components, x_scaled.shape[0], x_scaled.shape[1])
    pca = PCA(n_components=n_components, random_state=42)
    pca.fit(x_scaled)
    loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
    return {
        "variance_explained_full": [safe_float(v, 4) for v in pca.explained_variance_ratio_],
        "loadings_full": {feat_names[j]: [safe_float(loadings[j, k], 6) for k in range(n_components)] for j in range(len(feat_names))},
    }


def umap_embeddings(x_scaled):
    # two projections: 2D for the scatter plot, higher-dim for HDBSCAN
    # (2D throws away too much to cluster well)
    if not HAS_UMAP:
        return None, None, ["UMAP not installed: HDBSCAN clustering skipped."]

    n_bees, n_features = x_scaled.shape
    n_neighbors = max(5, min(15, n_bees - 1))
    high_dim = min(10, n_features, max(2, n_bees - 2))

    reducer_2d = umap.UMAP(n_components=2, n_neighbors=n_neighbors, min_dist=0.05, metric="euclidean", random_state=42)
    coords_2d = reducer_2d.fit_transform(x_scaled)

    reducer_high = umap.UMAP(n_components=high_dim, n_neighbors=n_neighbors, min_dist=0.0, metric="euclidean", random_state=42)
    coords_high = reducer_high.fit_transform(x_scaled)

    return coords_2d, coords_high, []


def hdbscan_labels(coords_high, n_bees):
    if coords_high is None:
        return np.full(n_bees, -1, dtype=int), []
    if not HAS_HDBSCAN:
        return np.full(n_bees, -1, dtype=int), ["HDBSCAN not installed: no cluster computed."]

    # small dataset -> min_cluster_size needs a lower ceiling, otherwise
    # nothing ever passes the threshold
    min_cluster_size = max(3, min(12, n_bees // 4, n_bees // 2))
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, min_samples=3, metric="euclidean", prediction_data=False)
    labels = clusterer.fit_predict(coords_high).astype(int)
    return labels, []


def dbcv_score(coords_high, labels):
    # DBCV (Moulavi et al. 2014), computed on the same space HDBSCAN
    # clustered on -- not the 2D projection, that would give a fake score
    if coords_high is None or len(set(labels) - {-1}) < 2:
        return None
    try:
        return float(hdbscan.validity_index(coords_high.astype(np.float64), labels))
    except Exception:
        return None


def epsilon_squared(h, n, k):
    # effect size for Kruskal-Wallis (Rea & Parker)
    if n <= k:
        return 0.0
    return max(0.0, (float(h) - k + 1) / (n - k))


def rank_features_by_cluster(x_raw, labels, feat_names):
    clusters = [c for c in sorted(set(labels)) if c != -1]
    values_by_cluster = {c: x_raw[labels == c] for c in clusters}
    n_total = sum(v.shape[0] for v in values_by_cluster.values())

    ranking = []
    for j, name in enumerate(feat_names):
        cluster_stats = {}
        medians = []
        samples = []
        for c in clusters:
            values = values_by_cluster[c][:, j]
            if values.size == 0:
                continue
            q1, q3 = np.percentile(values, [25, 75])
            median = np.median(values)
            medians.append(float(median))
            samples.append(values)
            cluster_stats[str(c)] = {"n": int(values.size), "median": safe_float(median, 6), "iqr": safe_float(q3 - q1, 6), "q1": safe_float(q1, 6), "q3": safe_float(q3, 6)}

        if len(samples) >= 2:
            h, p = kruskal(*samples)
            effect = epsilon_squared(h, n_total, len(samples))
            median_delta = max(medians) - min(medians)
        else:
            p, effect, median_delta = 1.0, 0.0, 0.0

        ranking.append({"feature": name, "p_value": safe_float(p, 8), "effect_size": safe_float(effect, 6), "epsilon2": safe_float(effect, 6), "median_delta": safe_float(median_delta, 6), "cluster_stats": cluster_stats})

    # Benjamini-Hochberg correction -- 44 features tested one by one without
    # it would inflate the false positive rate
    corrected_p = false_discovery_control(np.array([r["p_value"] for r in ranking]), method="bh")
    for r, p_corr in zip(ranking, corrected_p):
        r["p_value_corrigee"] = safe_float(p_corr, 8)

    return sorted(ranking, key=lambda r: (r["effect_size"], abs(r["median_delta"])), reverse=True)


def build_cluster_profiles(x_raw, labels, feat_names, ranking):
    in_cluster = labels != -1
    x_ref = x_raw[in_cluster] if np.any(in_cluster) else x_raw
    mins = x_ref.min(axis=0)
    maxs = x_ref.max(axis=0)
    ranges = np.where(maxs - mins > 0, maxs - mins, 1.0)
    rank_by_feature = {r["feature"]: i for i, r in enumerate(ranking)}

    profiles = {}
    for c in sorted(set(labels)):
        if c == -1:
            continue
        idx = np.where(labels == c)[0]
        values = x_raw[idx]
        median = np.median(values, axis=0)
        q1 = np.percentile(values, 25, axis=0)
        q3 = np.percentile(values, 75, axis=0)
        iqr = q3 - q1
        median_norm = (median - mins) / ranges
        iqr_norm = iqr / ranges

        features = {}
        for j, name in enumerate(feat_names):
            features[name] = {"median": safe_float(median_norm[j], 6), "iqr": safe_float(iqr_norm[j], 6), "median_raw": safe_float(median[j], 6), "iqr_raw": safe_float(iqr[j], 6), "rank": int(rank_by_feature.get(name, 9999))}
        profiles[str(c)] = {"size": int(len(idx)), "ids": [], "features": features}
    return profiles


def representative_bees(coords_2d, labels, ids):
    reps = {}
    if coords_2d is None:
        return reps
    for c in sorted(set(labels)):
        if c == -1:
            continue
        idx = np.where(labels == c)[0]
        points = coords_2d[idx]
        center = points.mean(axis=0)
        dist_to_center = np.linalg.norm(points - center, axis=1)
        closest = idx[int(np.argmin(dist_to_center))]
        farthest = idx[int(np.argmax(dist_to_center))]
        reps[str(c)] = {"representative": ids[closest], "extreme": ids[farthest]}
    return reps


def shap_importance(x_scaled, labels, ids, feat_names):
    # trains a RandomForest to predict cluster membership then lets SHAP
    # explain it -- gives feature importance for the clusters HDBSCAN found.
    # unreliable below a few dozen bees, the forest just overfits.
    valid_idx = np.where(labels != -1)[0]
    mean_importance = {name: 0.0 for name in feat_names}
    per_bee_shap = {str(bid): {} for bid in ids}
    source = "none"

    if valid_idx.size <= 5 or len(set(labels[valid_idx])) < 2:
        return mean_importance, per_bee_shap, source

    x_train = x_scaled[valid_idx]
    y_train = labels[valid_idx]
    forest = RandomForestClassifier(n_estimators=300, random_state=42, class_weight="balanced")
    forest.fit(x_train, y_train)
    source = "random_forest_importance"
    importances = forest.feature_importances_

    if HAS_SHAP:
        try:
            explainer = shap.TreeExplainer(forest)
            shap_values = explainer.shap_values(x_train)
            if isinstance(shap_values, list):
                values = np.mean(np.stack([np.abs(np.asarray(v)) for v in shap_values], axis=0), axis=0)
            else:
                values = np.asarray(shap_values)
                values = np.mean(np.abs(values), axis=2) if values.ndim == 3 else np.abs(values)
            importances = values.mean(axis=0)
            source = "shap_surrogate_cluster"
            for row, idx in enumerate(valid_idx):
                per_bee_shap[str(ids[idx])] = {feat_names[j]: safe_float(values[row, j], 8) for j in range(len(feat_names))}
        except Exception:
            source = "random_forest_importance"
            importances = forest.feature_importances_

    mean_importance = {feat_names[j]: safe_float(importances[j], 8) for j in range(len(feat_names))}
    return mean_importance, per_bee_shap, source


def analyze_bees(all_features, ids):
    x_raw = np.array(all_features, dtype=float)
    ids = list(ids)
    feat_names = list(FEAT_NAMES)

    x_scaled = StandardScaler().fit_transform(x_raw)

    pca_view = pca_2d(x_scaled, ids, feat_names)
    pca_deep = pca_full(x_scaled, feat_names)

    coords_2d, coords_high, warnings = umap_embeddings(x_scaled)
    labels, clustering_warnings = hdbscan_labels(coords_high, len(ids))
    warnings = warnings + clustering_warnings
    dbcv = dbcv_score(coords_high, labels)

    if coords_2d is None:
        coords_2d = np.array([[pca_view["pca_per_bee"][bid]["pca_x"], pca_view["pca_per_bee"][bid]["pca_y"]] for bid in ids])

    ranking = rank_features_by_cluster(x_raw, labels, feat_names)
    profiles = build_cluster_profiles(x_raw, labels, feat_names, ranking)
    reps = representative_bees(coords_2d, labels, ids)
    for cluster, rep in reps.items():
        if cluster in profiles:
            profiles[cluster]["representative"] = rep["representative"]
            profiles[cluster]["extreme"] = rep["extreme"]
            profiles[cluster]["ids"] = [ids[i] for i in np.where(labels == int(cluster))[0]]

    mean_shap, per_bee_shap, shap_source = shap_importance(x_scaled, labels, ids, feat_names)
    shap_ranking = sorted([{"feature": name, "importance": safe_float(mean_shap.get(name, 0.0), 8)} for name in feat_names], key=lambda r: r["importance"], reverse=True)
    shap_max = max([r["importance"] for r in shap_ranking] or [1.0]) or 1.0
    shap_norm = {r["feature"]: r["importance"] / shap_max for r in shap_ranking}

    pca_loading_abs = {name: abs(v.get("pc1", 0.0)) + abs(v.get("pc2", 0.0)) for name, v in pca_view["loadings"].items()}
    pca_max = max(pca_loading_abs.values() or [1.0]) or 1.0

    # weighted score to surface the most interesting features first --
    # 45% cluster effect size, 35% SHAP, 20% PCA weight, picked by hand
    for r in ranking:
        name = r["feature"]
        r["shap_importance"] = safe_float(mean_shap.get(name, 0.0), 8)
        r["pca_loading_abs"] = safe_float(pca_loading_abs.get(name, 0.0), 8)
        r["exploratory_score"] = safe_float(0.45 * r["effect_size"] + 0.35 * shap_norm.get(name, 0.0) + 0.20 * (pca_loading_abs.get(name, 0.0) / pca_max), 6)
    ranking = sorted(ranking, key=lambda r: r["exploratory_score"], reverse=True)

    per_bee = {}
    for i, bid in enumerate(ids):
        cluster = int(labels[i])
        per_bee[bid] = {
            "id": bid,
            "cluster": cluster,
            "cluster_label": "Non classé" if cluster == -1 else f"Cluster {cluster}",
            "pca_x": pca_view["pca_per_bee"][bid]["pca_x"],
            "pca_y": pca_view["pca_per_bee"][bid]["pca_y"],
            "umap_x": safe_float(coords_2d[i, 0], 6),
            "umap_y": safe_float(coords_2d[i, 1], 6),
            "features": {feat_names[j]: safe_float(x_raw[i, j], 5) for j in range(len(feat_names))},
        }

    n_clusters = len(set(labels) - {-1})
    counts = {str(c): int(np.sum(labels == c)) for c in sorted(set(labels))}

    return {
        "mode": "unsupervised_hdbscan_umap",
        "warnings": warnings,
        "ids": ids,
        "labels": labels.astype(int).tolist(),
        "per_bee": per_bee,
        "pca": {
            "variance_explained": pca_view["variance_explained"],
            "pca_per_bee": pca_view["pca_per_bee"],
            "loadings": pca_view["loadings"],
            "variance_explained_full": pca_deep["variance_explained_full"],
            "loadings_full": pca_deep["loadings_full"],
        },
        "rf_shap": {
            "mode": "surrogate_cluster_model",
            "source": shap_source,
            "accuracy": None,
            "global_shap_importance": mean_shap,
            "per_bee": {bid: {"cluster": int(labels[i]), "shap_values": per_bee_shap.get(str(bid), {})} for i, bid in enumerate(ids)},
        },
        "clustering": {
            "method": "UMAP + HDBSCAN",
            "n_clusters": int(n_clusters),
            "counts": counts,
            "dbcv_score": safe_float(dbcv, 4) if dbcv is not None else None,
            "umap_2d": [[safe_float(x, 6), safe_float(y, 6)] for x, y in coords_2d],
            "cluster_labels": labels.astype(int).tolist(),
            "feature_ranking": ranking,
            "kruskal": ranking,
            "cluster_profiles": profiles,
            "shap_importance": shap_ranking,
            "per_sample_shap": per_bee_shap,
            "ids": ids,
            "warnings": warnings,
        },
    }


def run_hdbscan(all_features, ids):
    return analyze_bees(all_features, ids)
