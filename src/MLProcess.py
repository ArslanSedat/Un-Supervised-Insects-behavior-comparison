from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import math
import numpy as np
from scipy.spatial import ConvexHull
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

app = Flask(__name__)
CORS(app)

model = RandomForestClassifier(n_estimators=100, random_state=42)
X_train = []
y_train = []
model_trained = False


def compute_metrics(traj, ruche, plantes, stats):
    if len(traj) < 2:
        return None
    
    points = np.array([[p["x"], p["y"], p["z"]] for p in traj])
    vitesses_list = [p.get("vitesse_ms", 0) for p in traj]
    vitesses = np.array(vitesses_list)
    accels_list = [p.get("acceleration_ms2", 0) for p in traj]
    accels = np.array(accels_list)
    
    dx = np.diff(points[:, 0])
    dy = np.diff(points[:, 1])
    dz = np.diff(points[:, 2])
    
    dist_totale = float(np.sum(np.sqrt(dx**2 + dy**2 + dz**2)))
    
    p0 = points[0]
    pN = points[-1]
    dist_directe = float(np.sqrt((pN[0] - p0[0])**2 + (pN[1] - p0[1])**2 + (pN[2] - p0[2])**2))
    tortuosite = dist_directe / dist_totale if dist_totale > 0 else 0.0
    
    vitesses_pos = vitesses[vitesses > 0]
    vitesse_moy = float(np.mean(vitesses_pos)) if len(vitesses_pos) > 0 else 0.0
    vitesse_max = float(np.max(vitesses)) if len(vitesses) > 0 else 0.0
    
    stabilite_val = vitesses_pos[vitesses_pos > 0]
    if len(stabilite_val) > 1:
        moy_v = np.mean(stabilite_val)
        ecart_type = np.std(stabilite_val)
        stabilite = max(0.0, 1.0 - (ecart_type / moy_v if moy_v > 0 else 1.0))
    else:
        stabilite = 0.0
    
    accels_pos = accels[accels > 0]
    acc_moy = float(np.mean(accels_pos)) if len(accels_pos) > 0 else 0.0
    acc_max = float(np.max(accels)) if len(accels) > 0 else 0.0
    
    pts_xy = points[:, :2]
    unique_pts = np.unique(pts_xy, axis=0)
    if len(unique_pts) >= 3:
        try:
            hull = ConvexHull(unique_pts)
            aire = float(hull.volume)
        except:
            aire = float((np.max(points[:, 0]) - np.min(points[:, 0])) * (np.max(points[:, 1]) - np.min(points[:, 1])))
    else:
        aire = 0.0
    
    if len(points) >= 3:
        points_centered = points - points.mean(axis=0)
        pca = PCA(n_components=1)
        pca.fit(points_centered)
        linearite = float(pca.explained_variance_ratio_[0])
    else:
        linearite = 0.0
    
    visites = stats.get("visites_plantes", 0)
    if visites == 0 and len(plantes) > 0:
        score_visites = -0.5
    else:
        score_visites = 1.0
    
    dist_ruche_fin = math.sqrt((pN[0] - ruche["x"])**2 + (pN[1] - ruche["y"])**2 + (pN[2] - ruche.get("z", 0))**2)
    retour_ruche = 1.0 if dist_ruche_fin < 0.5 else max(0.0, 1.0 - dist_ruche_fin)
    
    metrics = {
        "vitesse_moy": round(vitesse_moy, 4),
        "vitesse_max": round(vitesse_max, 4),
        "acc_moy": round(acc_moy, 4),
        "acc_max": round(acc_max, 4),
        "linearite": round(linearite, 4),
        "tortuosite": round(tortuosite, 4),
        "aire": round(aire, 4),
        "stabilite": round(stabilite, 3),
        "dist_totale": round(dist_totale, 3),
        "visites": visites,
        "retour_ruche": round(retour_ruche, 3),
    }
    
    features = [linearite, stabilite, score_visites, retour_ruche]
    
    return metrics, features


@app.route("/upload", methods=["POST"])
def upload_file():
    global model_trained, X_train, y_train
    
    try:
        print(f"[DEBUG] Upload reçu. Model trained: {model_trained}, Samples: {len(X_train)}")
        file = request.files["file"]
        group = request.form.get("group")
        data = json.load(file)
        if group:
            data["group"] = group

        cage = data.get("metadonnees", {}).get("cage_experimentale", {})
        ruche = cage.get("ruche_position_m", {"x": 0.1, "y": 0.1, "z": 0})
        plantes = cage.get("plantes", [])
        for key in data:
            if not key.startswith("bourdon_"):
                continue
            bourdon = data[key]
            traj = bourdon.get("trajectoire", [])
            stats = bourdon.get("statistiques", {})

            if len(traj) < 2:
                bourdon["efficacite"] = 0.0
                continue

            result = compute_metrics(traj, ruche, plantes, stats)
            if result is None:
                continue
            
            metrics, features = result
            
            for key_m, val_m in metrics.items():
                bourdon[key_m] = val_m

            if group:
                label = 1 if group == "expose" else 0
                X_train.append(features)
                y_train.append(label)
                print(f"[DEBUG] Données d'entraînement ajoutées. Total: {len(X_train)} samples")

            if model_trained :
                try:
                    pred = int(model.predict([features])[0])
                    proba = float(model.predict_proba([features])[0][1])
                    bourdon["ml_prediction"] = pred
                    bourdon["ml_confidence"] = round(proba, 3)
                    print(f"[DEBUG] Prédiction ML: {pred} (confiance: {proba:.3f})")
                except Exception as pe:
                    print(f"[ERROR] Prédiction ML échouée: {str(pe)}")
                    bourdon["ml_prediction"] = None
                    bourdon["ml_confidence"] = None
            else:
                bourdon["ml_prediction"] = None
                bourdon["ml_confidence"] = None

            if group:
                bourdon["group"] = group

        if len(X_train) > 10 :
            try:
                print(f"[DEBUG] Début du training ML avec {len(X_train)} samples")
                X_array = np.array(X_train, dtype=float)
                y_array = np.array(y_train, dtype=int)
                X_tr, X_te, y_tr, y_te = train_test_split(X_array, y_array, test_size=0.3, random_state=42)
                model.fit(X_tr, y_tr)
                y_pred = model.predict(X_te)
                accuracy = accuracy_score(y_te, y_pred)
                print(f"[DEBUG] Training réussi! Accuracy: {accuracy:.3f}")
                model_trained = True
                X_train = []
                y_train = []
                print(f"[DEBUG] Données d'entraînement réinitialisées")
            except Exception as te:
                print(f"[ERROR] Model training failed: {str(te)}")

        return jsonify(data)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/compare", methods=["POST"])
def compare():
    try:
        body = request.get_json()
        temoin_data = body.get("temoin", {})
        expose_data = body.get("expose", {})

        return jsonify({"status": "ok","message": "Comparaison effectuée"})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)