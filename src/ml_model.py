import numpy as np
from scipy.stats import mannwhitneyu, pearsonr
from sklearn.decomposition import PCA
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import accuracy_score, roc_auc_score
import shap

from features import FEAT_NAMES


def cross_validate_pca_components(X_scaled, y_all, n_components_range=None):
    N, P = X_scaled.shape
    
    if n_components_range is None:
        max_comp = min(N - 1, P, 10)
        n_components_range = (2, max(3, max_comp))
    
    comp_range = range(n_components_range[0], n_components_range[1] + 1)
    cv_results = {}
    
    loo = LeaveOneOut()
    
    for n_comp in comp_range:
        if n_comp >= N:
            continue
        
        pca = PCA(n_components=n_comp, random_state=42)
        X_pca = pca.fit_transform(X_scaled)
        
        preds, probas, truths = [], [], []
        for tr, te in loo.split(X_pca):
            svm = SVC(kernel="rbf", C=1.0, gamma="scale", 
                     probability=True, random_state=42)
            svm.fit(X_pca[tr], y_all[tr])
            preds.append(int(svm.predict(X_pca[te])[0]))
            probas.append(float(svm.predict_proba(X_pca[te])[0][1]))
            truths.append(int(y_all[te[0]]))
        
        acc = float(accuracy_score(truths, preds))
        try:
            auc = float(roc_auc_score(truths, probas))
        except:
            auc = 0.5
        
        cum_var = float(np.sum(pca.explained_variance_ratio_))
        
        cv_results[n_comp] = {
            "accuracy": round(acc, 4),
            "auc": round(auc, 4),
            "cumulative_variance": round(cum_var, 4),
        }
    
    optimal_n_comp = max(cv_results.keys(), 
                        key=lambda k: cv_results[k]["accuracy"])
    
    return {
        "cv_results": cv_results,
        "optimal_n_components": optimal_n_comp,
        "optimal_performance": cv_results[optimal_n_comp],
    }


def run_random_forest_shap(X_all, y_all, ids_all):
    rf = RandomForestClassifier(n_estimators=300, random_state=42,
                                class_weight='balanced', max_depth=15)
    rf.fit(X_all, y_all)
    rf_pred = rf.predict(X_all)
    rf_proba = rf.predict_proba(X_all)[:, 1]
    explainer = shap.TreeExplainer(rf)
    shap_values = explainer.shap_values(X_all)
    shap_values_class1 = shap_values[1] if isinstance(shap_values, list) else shap_values
    per_bee_rf = {}
    for i, bid in enumerate(ids_all):
        shap_dict = {
            FEAT_NAMES[j]: round(float(shap_values_class1[i, j]), 5)
            for j in range(len(FEAT_NAMES))
        }
        per_bee_rf[bid] = {
            "rf_pred": int(rf_pred[i]),
            "rf_proba": round(float(rf_proba[i]), 4),
            "shap_values": shap_dict,
        }
    global_shap_importance = {
        FEAT_NAMES[j]: round(float(np.mean(np.abs(shap_values_class1[:, j]))), 5)
        for j in range(len(FEAT_NAMES))
    }
    rf_accuracy = float(accuracy_score(y_all, rf_pred))
    return {
        "per_bee_rf": per_bee_rf,
        "global_shap_importance": global_shap_importance,
        "rf_accuracy": round(rf_accuracy, 4),
    }


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
    pca_cv_result = cross_validate_pca_components(X_scaled, y_all)
    optimal_n_comp = pca_cv_result["optimal_n_components"]
    pca_cv_info = pca_cv_result["cv_results"]
    pca_opt = PCA(n_components=optimal_n_comp, random_state=42)
    X_opt = pca_opt.fit_transform(X_scaled)
    pca2   = PCA(n_components=2, random_state=42)
    X_2d   = pca2.fit_transform(X_scaled)
    var_exp_2d = [round(float(v), 4) for v in pca2.explained_variance_ratio_]
    cum_var_2d = list(np.round(np.cumsum(pca2.explained_variance_ratio_), 4))
    loadings = {
        "feature_names": FEAT_NAMES,
        "pc1": [round(float(v), 4) for v in pca2.components_[0]],
        "pc2": [round(float(v), 4) for v in pca2.components_[1]],
    }
    loo = LeaveOneOut()
    preds, probas, truths = [], [], []
    for tr, te in loo.split(X_opt):
        s = SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=42)
        s.fit(X_opt[tr], y_all[tr])
        preds.append(int(s.predict(X_opt[te])[0]))
        probas.append(float(s.predict_proba(X_opt[te])[0][1]))
        truths.append(int(y_all[te[0]]))

    acc_optimal = float(accuracy_score(truths, preds))
    try:    auc_optimal = float(roc_auc_score(truths, probas))
    except: auc_optimal = 0.5

    svm_opt = SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=42)
    svm_opt.fit(X_opt, y_all)

    svm_2d = SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=42)
    svm_2d.fit(X_2d, y_all)

    mg = 0.8
    x1mn, x1mx = X_2d[:, 0].min() - mg, X_2d[:, 0].max() + mg
    x2mn, x2mx = X_2d[:, 1].min() - mg, X_2d[:, 1].max() + mg
    res = 65
    xx, yy = np.meshgrid(np.linspace(x1mn, x1mx, res), np.linspace(x2mn, x2mx, res))
    grid   = np.c_[xx.ravel(), yy.ravel()]
    Z_prob = svm_2d.predict_proba(grid)[:, 1].reshape(res, res)

    svm_pred  = svm_opt.predict(X_opt)
    svm_proba = svm_opt.predict_proba(X_opt)[:, 1]
    svm_dist  = svm_opt.decision_function(X_opt)

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

    rf_shap_result = run_random_forest_shap(X_scaled, y_all, ids_all)

    return {
        "pca": {
            "variance_explained_2d": var_exp_2d,
            "cumulative_variance_2d": cum_var_2d,
            "all_variance":           all_var[:10],
            "loadings":               loadings,
            "pca_cv": {
                "optimal_n_components": optimal_n_comp,
                "optimal_performance":  pca_cv_result["optimal_performance"],
                "cv_results":           pca_cv_info,
            },
        },
        "svm": {
            "accuracy_loo":     round(acc_optimal, 4),
            "auc_loo":          round(auc_optimal, 4),
            "n_components_used": optimal_n_comp,
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
        "rf_shap": {
            "accuracy":                rf_shap_result["rf_accuracy"],
            "global_shap_importance":  rf_shap_result["global_shap_importance"],
            "per_bee":                 rf_shap_result["per_bee_rf"],
        },
        "ids":        ids_all,
        "labels":     [0] * len(feats_t) + [1] * len(feats_e),
        "n_normal":   int(np.sum(svm_pred == 0)),
        "n_abnormal": int(np.sum(svm_pred == 1)),
    }
