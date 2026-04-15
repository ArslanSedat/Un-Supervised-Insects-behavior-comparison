from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import math
import numpy as np
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

app = Flask(__name__)
CORS(app)

# Modèle de ML (Random Forest, essayer Isolation Forest ou SVM)
model = RandomForestClassifier(n_estimators=50, random_state=42)
X_train = []
y_train = []
model_trained = False


@app.route("/upload", methods=["POST"])
def upload_file():
    global model_trained, X_train, y_train
    
    try:
        file = request.files["file"]
        group = request.form.get("group")
        data = json.load(file)
        if group:
            data["group"] = group

        cage = data.get("metadonnees", {}).get("cage_experimentale", {})
        ruche = cage.get("ruche_position_m", {"x": 0.1, "y": 0.1, "z": 0})
        plantes = cage.get("plantes", [])

        print(f"[DEBUG] Processing group: {group}, Number of bees to process: {len([k for k in data.keys() if k.startswith('bourdon_')])}")

        for key in data:
            if not key.startswith("bourdon_"):
                continue
            bourdon = data[key]
            traj = bourdon.get("trajectoire", [])
            stats = bourdon.get("statistiques", {})

            if len(traj) < 2:
                bourdon["efficacite"] = 0.0
                bourdon["efficacite_rule"] = 0.0
                continue

            # LINEARITE DE LA TRAJECTOIRE (AVEC PCA)
            points = np.array([[p["x"], p["y"], p["z"]] for p in traj])

            if len(points) >= 3:
                pca = PCA(n_components=1)
                pca.fit(points)
                variance_expliquee = pca.explained_variance_ratio_[0]
                linearite = float(variance_expliquee)
            else:
                linearite = 0.0

            # STABILITE DE LA VITESSE
            vitesses = [p.get("vitesse_ms", 0) for p in traj if p.get("vitesse_ms", 0) > 0]
            if len(vitesses) > 1:
                moy = sum(vitesses) / len(vitesses)
                ecart_type = math.sqrt(sum((v - moy)**2 for v in vitesses) / len(vitesses))
                stabilite = max(0, 1 - (ecart_type / moy if moy > 0 else 1))
            else:
                stabilite = 0.0

            # VISITES PLANTES
            nb_plantes = max(len(plantes), 1)
            visites = stats.get("visites_plantes", 0)
            if visites == 0 and len(plantes) > 0:
                score_visites = -0.5
            else:
                score_visites = 1.0

            # RETOUR A LA RUCHE
            pN = traj[-1]
            dist_ruche_fin = math.sqrt((pN["x"] - ruche["x"])**2 + (pN["y"] - ruche["y"])**2 + (pN["z"] - ruche.get("z", 0))**2)
            retour_ruche = 1.0 if dist_ruche_fin < 0.5 else max(0, 1 - dist_ruche_fin)

            # règle d'efficacité, peut être ajustée
            rule_score = (
                0.25 * linearite +
                0.10 * stabilite +
                0.35 * score_visites +
                0.30 * retour_ruche
            )

            bourdon["efficacite_rule"] = round(rule_score, 3)




            # TORTUOSITE (uniquement pour le random forest)

            #p0, pTOR = traj[0], traj[-1]
            #dist_directe = math.sqrt((pN["x"] - p0["x"])**2 + (pN["y"] - p0["y"])**2 +(pN["z"] - p0["z"])**2)
            #dist_totale = sum(
            #    math.sqrt((traj[i]["x"] - traj[i-1]["x"])**2 + (traj[i]["y"] - traj[i-1]["y"])**2 + (traj[i]["z"] - traj[i-1]["z"])**2)
            #    for i in range(1, len(traj))
            #)
            #tortuosite = dist_directe / dist_totale if dist_totale > 0 else 0





            # features pour ML
            features = [linearite, stabilite, score_visites, retour_ruche] #, tortuosite] à voir si ajout d'autres

            if group:
                label = 1 if group == "expose" else 0
                X_train.append(features)
                y_train.append(label)
                print(f"[DEBUG] Added to training: {key}, group={group}, features={features}")

            if model_trained:
                try:
                    pred = int(model.predict([features])[0])
                    proba = float(model.predict_proba([features])[0][1])
                    bourdon["ml_prediction"] = pred
                    bourdon["ml_confidence"] = round(proba, 3)
                    print(f"[DEBUG] {key}: prediction={pred}, confidence={round(proba, 3)}")
                except Exception as pe:
                    print(f"[ERROR] Prediction failed for {key}: {str(pe)}")
                    bourdon["ml_prediction"] = None
                    bourdon["ml_confidence"] = None
            else:
                bourdon["ml_prediction"] = None
                bourdon["ml_confidence"] = None

            if group:
                bourdon["group"] = group

            bourdon["efficacite"] = bourdon["efficacite_rule"]

        if len(X_train) > 10 and not model_trained:
            try:
                X_tr, X_te, y_tr, y_te = train_test_split(X_train, y_train, test_size=0.3, random_state=42)
                model.fit(X_tr, y_tr)
                y_pred = model.predict(X_te)
                accuracy = accuracy_score(y_te, y_pred)

                print(f"[DEBUG] Model trained with {len(X_tr)} samples")
                print(f"[DEBUG] Test accuracy: {round(accuracy, 3)}")
                print(f"[DEBUG] Feature importances: {model.feature_importances_}")

                model_trained = True
            except Exception as te:
                print(f"[ERROR] Model training failed: {str(te)}")

        print(f"[DEBUG] Total training samples: {len(X_train)}, Model trained: {model_trained}")
        return jsonify(data)

    except Exception as e:
        print(f"[ERROR] Exception in /upload: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/compare", methods=["POST"])
def compare():
    """Route de comparaison entre groupes temoin et expose"""
    try:
        body = request.get_json()
        temoin_data = body.get("temoin", {})
        expose_data = body.get("expose", {})
        
        print(f"[DEBUG] /compare called")
        
        return jsonify({"status": "ok","message": "Comparaison effectuée"})
        
    except Exception as e:
        print(f"[ERROR] Exception in /compare: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
