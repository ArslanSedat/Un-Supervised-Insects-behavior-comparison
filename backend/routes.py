from flask import request, jsonify
import json
from features import compute_features, FEAT_NAMES
from models import run_hdbscan


def clean_nan_json(value):
    # NaN/Infinity aren't valid JSON, json.dumps chokes on them otherwise
    if isinstance(value, dict):
        return {k: clean_nan_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_nan_json(v) for v in value]
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    return value


def init_routes(app, store):

    @app.route("/upload", methods=["POST"])
    def upload_file():
        try:
            file = request.files["file"]
            data = json.load(file)
            store["all"] = {"feats": [], "ids": []}  # always start clean on upload

            cage = data.get("metadonnees", {}).get("cage_experimentale", {})
            hive_pos = cage.get("ruche_position_m", {})
            hive = [hive_pos.get("x", 0.1), hive_pos.get("y", 0.1), hive_pos.get("z", 0)]
            flowers = [(p["x"], p["y"], p.get("z", 0), p.get("id", i)) for i, p in enumerate(cage.get("plantes", []))]

            for key, bee in data.items():
                if not key.startswith("bourdon_"):
                    continue
                feat_dict, feat_vec = compute_features(bee.get("trajectoire", []), ruche=hive, flowers=flowers, stats=bee.get("statistiques"))
                if feat_dict is None:
                    feat_dict = {name: 0.0 for name in FEAT_NAMES}
                else:
                    store["all"]["feats"].append(feat_vec)
                    store["all"]["ids"].append(bee.get("id", key))
                bee["metriques"] = feat_dict

            return jsonify(clean_nan_json(data))
        except Exception as err:
            return jsonify({"error": str(err)}), 500

    @app.route("/compute-ml", methods=["POST"])
    def compute_ml():
        try:
            n_bees = len(store["all"]["feats"])
            if n_bees < 5:
                return jsonify({"error": "Pas assez de bourdons", "n_bourdons": n_bees}), 400
            result = run_hdbscan(store["all"]["feats"], store["all"]["ids"])
            return jsonify({"_ml": clean_nan_json(result)})
        except Exception as err:
            return jsonify({"error": str(err)}), 500

    @app.route("/reset", methods=["POST"])
    def reset():
        store["all"] = {"feats": [], "ids": []}
        return jsonify({"status": "ok"})
