import numpy as np
from scipy.stats import mannwhitneyu
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import accuracy_score, roc_auc_score, balanced_accuracy_score
from sklearn.decomposition import PCA

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    from sklearn.ensemble import GradientBoostingClassifier

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from features import FEAT_NAMES

def _estimate_contamination(X_scaled: np.ndarray) -> float:
    norms = np.linalg.norm(X_scaled, axis=1)
    q1, q3 = np.percentile(norms, 25), np.percentile(norms, 75)
    fence = q3 + 1.5 * (q3 - q1)
    n_out = int(np.sum(norms > fence))
    return float(np.clip(n_out / max(len(X_scaled), 1), 0.01, 0.15))


def _fit_isolation_forest(X_temoin: np.ndarray):
    scaler = StandardScaler()
    X_sc = scaler.fit_transform(X_temoin)
    cont = _estimate_contamination(X_sc)
    iso = IsolationForest(
        n_estimators=500,
        contamination=cont,
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_sc)
    return iso, scaler, cont


def _anomaly_scores(iso, scaler, X: np.ndarray) -> np.ndarray:
    raw = iso.decision_function(scaler.transform(X))
    lo, hi = raw.min(), raw.max()
    return 1.0 - (raw - lo) / (hi - lo) if hi > lo else np.zeros(len(raw))


def _build_xgb(scale_pos_weight: float = 1.0, n_samples: int = None):
    if n_samples is not None and n_samples < 20:
        reg_alpha, reg_lambda, min_child = 0.2, 0.5, 1
    elif n_samples is not None and n_samples < 40:
        reg_alpha, reg_lambda, min_child = 0.5, 1.0, 2
    else:
        reg_alpha, reg_lambda, min_child = 1.0, 2.0, 3
    
    if HAS_XGB:
        return xgb.XGBClassifier(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.7,
            reg_alpha=reg_alpha,
            reg_lambda=reg_lambda,
            min_child_weight=min_child,
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss",
            random_state=42,
            verbosity=0,
        )
    else:
        from sklearn.ensemble import GradientBoostingClassifier
        min_samples = max(1, min_child)
        return GradientBoostingClassifier(
            n_estimators=300, max_depth=3, learning_rate=0.03,
            subsample=0.8, min_samples_leaf=min_samples, random_state=42,
        )


def _loo_xgb(X: np.ndarray, y: np.ndarray, scale_pw: float):
    N = len(X)
    preds, probas, truths = [], [], []
    for tr, te in LeaveOneOut().split(X, y):
        m = _build_xgb(scale_pw, n_samples=N)
        m.fit(X[tr], y[tr])
        p = float(m.predict_proba(X[te])[0, 1])
        preds.append(int(p >= 0.5))
        probas.append(p)
        truths.append(int(y[te[0]]))
    return np.array(preds), np.array(probas), np.array(truths)


def _shap_matrix(model, X: np.ndarray):
    if not HAS_SHAP:
        return None
    sv = shap.TreeExplainer(model).shap_values(X)
    return sv[1] if isinstance(sv, list) else sv


def _shap_with_bootstrap(model, X: np.ndarray, feat_names: list,
                         n_boot: int = 500, ci: float = 0.95):
    sv = _shap_matrix(model, X)
    if sv is None:
        return {}, {}, [], None

    N, P = sv.shape
    alpha = (1 - ci) / 2
    rng = np.random.default_rng(42)
    boot = np.zeros((n_boot, P))
    for b in range(n_boot):
        idx = rng.integers(0, N, size=N)
        boot[b] = np.mean(np.abs(sv[idx]), axis=0)

    mean_imp = np.mean(np.abs(sv), axis=0)
    lower = np.quantile(boot, alpha, axis=0)
    upper = np.quantile(boot, 1 - alpha, axis=0)

    order = np.argsort(mean_imp)[::-1]
    global_imp = {feat_names[j]: round(float(mean_imp[j]), 6) for j in order}
    boot_ci = {
        feat_names[j]: {
            "lower":  round(float(lower[j]), 6),
            "upper":  round(float(upper[j]), 6),
            "cv_pct": round(float((upper[j] - lower[j]) / max(mean_imp[j], 1e-9) * 100), 1),
        }
        for j in range(P)
    }
    per_sample = [
        {feat_names[j]: round(float(sv[i, j]), 6) for j in range(P)}
        for i in range(N)
    ]
    return global_imp, boot_ci, per_sample, sv


def _shap_loo_stability(X: np.ndarray, y: np.ndarray,
                        feat_names: list, scale_pw: float):
    if not HAS_SHAP:
        return {}
    N, P = X.shape
    loo_imp = np.zeros((N, P))
    for fold_i, (tr, te) in enumerate(LeaveOneOut().split(X, y)):
        m = _build_xgb(scale_pw, n_samples=N)
        m.fit(X[tr], y[tr])
        sv_tr = _shap_matrix(m, X[tr])
        if sv_tr is not None:
            loo_imp[fold_i] = np.mean(np.abs(sv_tr), axis=0)

    mean_l = np.mean(loo_imp, axis=0)
    std_l  = np.std(loo_imp,  axis=0)
    cv_l   = std_l / np.maximum(mean_l, 1e-9)
    ranks  = np.argsort(cv_l) + 1   # 1 = le plus stable

    return {
        fname: {
            "mean_loo": round(float(mean_l[j]), 6),
            "std_loo":  round(float(std_l[j]),  6),
            "cv_pct":   round(float(cv_l[j] * 100), 1),
            "stability_rank": int(ranks[j]),
        }
        for j, fname in enumerate(feat_names)
    }


def _holm(p_values: list) -> list:
    n = len(p_values)
    order = np.argsort(p_values)
    p_adj = np.zeros(n)
    running_max = 0.0
    for rank, idx in enumerate(order):
        adj = p_values[idx] * (n - rank)
        running_max = max(running_max, adj)
        p_adj[idx] = min(running_max, 1.0)
    return p_adj.tolist()


def _univariate_tests(X_t: np.ndarray, X_e: np.ndarray, feat_names: list) -> dict:
    n_tests = len(feat_names)
    results, p_raws = {}, []

    for j, fname in enumerate(feat_names):
        vt, ve = X_t[:, j], X_e[:, j]
        try:
            _, p = mannwhitneyu(vt, ve, alternative="two-sided")
        except Exception:
            p = 1.0

        nt, ne = len(vt), len(ve)
        u1 = sum(1 if a > b else 0.5 if a == b else 0 for a in vt for b in ve)
        rb = (2 * u1 / (nt * ne) - 1) if nt > 0 and ne > 0 else 0.0

        q1t, q3t = np.percentile(vt, [25, 75])
        q1e, q3e = np.percentile(ve, [25, 75])

        results[fname] = {
            "p_raw":          round(float(p), 6),
            "p_bonferroni":   round(float(min(p * n_tests, 1.0)), 6),
            "effect_size_rb": round(float(rb), 4),
            "direction":      "expose>temoin" if rb > 0 else "temoin>expose",
            "mean_temoin":    round(float(np.mean(vt)), 5),
            "mean_expose":    round(float(np.mean(ve)), 5),
            "std_temoin":     round(float(np.std(vt)),  5),
            "std_expose":     round(float(np.std(ve)),  5),
            "median_temoin":  round(float(np.median(vt)), 5),
            "median_expose":  round(float(np.median(ve)), 5),
            "iqr_temoin":     round(float(q3t - q1t), 5),
            "iqr_expose":     round(float(q3e - q1e), 5),
            "p_mannwhitney":  round(float(p), 4),
        }
        p_raws.append(float(p))

    p_holm = _holm(p_raws)
    for j, fname in enumerate(feat_names):
        results[fname]["p_holm"] = round(p_holm[j], 6)
        results[fname]["significant_holm"] = bool(p_holm[j] < 0.05)
        results[fname]["significant_05"]   = bool(p_raws[j] < 0.05)

    return results

def _pca_2d(X_scaled: np.ndarray, y: np.ndarray, ids_all: list):
    pca2 = PCA(n_components=2, random_state=42)
    X_2d = pca2.fit_transform(X_scaled)
    
    pca_per_bee = {
        ids_all[i]: {
            "pca_x": round(float(X_2d[i, 0]), 4),
            "pca_y": round(float(X_2d[i, 1]), 4),
        }
        for i in range(len(ids_all))
    }
    
    return {
        "variance_explained": [round(float(v), 4) for v in pca2.explained_variance_ratio_],
        "pca_per_bee": pca_per_bee,
    }


def _generate_shap_plot(shap_values: np.ndarray, feature_names: list) -> str:
    if not HAS_SHAP or shap_values is None:
        return None
    try:
        plt.figure(figsize=(10, 6))
        shap.plots.beeswarm(shap.Explanation(values=shap_values, feature_names=feature_names), show=False)
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=80, bbox_inches='tight')
        buf.seek(0)
        plt.close()
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        print(f"SHAP plot error: {e}")
        return None

def run_analysis(feats_t: list, feats_e: list, ids_t: list, ids_e: list) -> dict:
    X_t   = np.array(feats_t, dtype=float)
    X_e   = np.array(feats_e, dtype=float)
    X_all = np.vstack([X_t, X_e])
    y_all = np.array([0] * len(X_t) + [1] * len(X_e), dtype=int)
    ids_all = ids_t + ids_e
    n_t, n_e, N = len(X_t), len(X_e), len(X_all)

    base_names  = list(FEAT_NAMES)
    aug_names   = base_names + ["anomaly_score_IF"]

    scaler = StandardScaler()
    X_sc   = scaler.fit_transform(X_all)

    iso, scaler_iso, cont_used = _fit_isolation_forest(X_t)
    a_scores = _anomaly_scores(iso, scaler_iso, X_all)
    iso_pred = (a_scores > 0.5).astype(int)

    X_aug = np.hstack([X_sc, a_scores.reshape(-1, 1)])

    X_aug_raw = np.hstack([X_all, a_scores.reshape(-1, 1)])
    feat_disc = _univariate_tests(X_aug_raw[:n_t], X_aug_raw[n_t:], aug_names)

    scale_pw = n_t / max(n_e, 1)
    loo_preds, loo_probas, loo_truths = _loo_xgb(X_aug, y_all, scale_pw)

    acc      = float(accuracy_score(loo_truths, loo_preds))
    bal_acc  = float(balanced_accuracy_score(loo_truths, loo_preds))
    try:    auc = float(roc_auc_score(loo_truths, loo_probas))
    except: auc = 0.5

    tp = int(np.sum((loo_preds==1) & (loo_truths==1)))
    tn = int(np.sum((loo_preds==0) & (loo_truths==0)))
    fp = int(np.sum((loo_preds==1) & (loo_truths==0)))
    fn = int(np.sum((loo_preds==0) & (loo_truths==1)))

    final_model = _build_xgb(scale_pw, n_samples=N)
    final_model.fit(X_aug, y_all)
    final_preds  = final_model.predict(X_aug)
    final_probas = final_model.predict_proba(X_aug)[:, 1]

    shap_global, shap_ci, shap_per_sample, sv_mat = _shap_with_bootstrap(
        final_model, X_aug, aug_names, n_boot=100
    )
    
    pca_vis = _pca_2d(X_sc, y_all, ids_all)
    shap_plot_img = _generate_shap_plot(sv_mat, aug_names)

    per_bee = {}
    for i, bid in enumerate(ids_all):
        loo_prob = round(float(loo_probas[i]), 4)
        entry = {
            "id":          bid,
            "group":       int(y_all[i]),
            "group_label": "temoin" if y_all[i] == 0 else "expose",
            "anomaly_score": round(float(a_scores[i]), 5),
            "if_is_anomaly": bool(iso_pred[i] == 1),
            "xgb_proba_loo":  loo_prob,
            "xgb_pred_loo":   int(loo_prob >= 0.5),
            "xgb_proba_train": round(float(final_probas[i]), 4),
            "pca_x": pca_vis["pca_per_bee"][bid]["pca_x"],
            "pca_y": pca_vis["pca_per_bee"][bid]["pca_y"],
            "is_normal":     bool(loo_prob < 0.5),
            "dist_frontier": round(float(loo_prob - 0.5), 4),
            "features": {
                FEAT_NAMES[j]: round(float(X_all[i, j]), 5)
                for j in range(len(FEAT_NAMES))
            },
        }
        if shap_per_sample:
            sv_bee = shap_per_sample[i]
            entry["shap_values"] = sv_bee
            top3 = sorted(sv_bee.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
            entry["shap_top3"] = [
                {"feature": k, "shap": v, "direction": "→exposé" if v > 0 else "→temoin"}
                for k, v in top3
            ]
        per_bee[bid] = entry

    n_agree = sum(
        1 for i, bid in enumerate(ids_all)
        if int(iso_pred[i]) == per_bee[bid]["xgb_pred_loo"]
    )

    return {
        "n_temoin":  n_t,
        "n_expose":  n_e,

        "isolation_forest": {
            "contamination_used":  round(cont_used, 4),
            "mean_score_temoin":   round(float(np.mean(a_scores[:n_t])), 4),
            "mean_score_expose":   round(float(np.mean(a_scores[n_t:])), 4),
            "median_score_temoin": round(float(np.median(a_scores[:n_t])), 4),
            "median_score_expose": round(float(np.median(a_scores[n_t:])), 4),
            "anomaly_rate_temoin": round(float(np.mean(iso_pred[:n_t])), 3),
            "anomaly_rate_expose": round(float(np.mean(iso_pred[n_t:])), 3),
        },

        "xgboost": {
            "accuracy":          round(acc, 4),
            "balanced_accuracy": round(bal_acc, 4),
            "auc":               round(auc, 4),
            "sensitivity":       round(tp / max(tp + fn, 1), 4),
            "specificity":       round(tn / max(tn + fp, 1), 4),
            "confusion_matrix":  {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        },

        "shap": {
            "global_importance": shap_global,
            "bootstrap_ci_95":   shap_ci,
            "top_features":      list(shap_global.keys())[:10] if shap_global else [],
            "plot_img":          shap_plot_img,
        },

        "pca": {
            "variance_explained": pca_vis["variance_explained"],
        },

        "feature_discrimination": feat_disc,
        "ids":        ids_all,
        "labels":     y_all.tolist(),
        "n_normal":   int(np.sum([1 for b in per_bee.values() if b["is_normal"]])),
        "n_abnormal": int(np.sum([1 for b in per_bee.values() if not b["is_normal"]])),

        "per_bee": per_bee,

        "model_agreement": {
            "n_agree":   n_agree,
            "pct_agree": round(float(n_agree / N), 3),
        },

        "rf_shap": {
            "accuracy": round(acc, 4),
            "global_shap_importance": shap_global,
            "per_bee": {
                bid: {
                    "rf_pred":    per_bee[bid]["xgb_pred_loo"],
                    "rf_proba":   per_bee[bid]["xgb_proba_loo"],
                    "shap_values": per_bee[bid].get("shap_values", {}),
                }
                for bid in ids_all
            },
        },
    }
