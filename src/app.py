from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import warnings

from features import compute_features, FEAT_NAMES
from ml_model import run_analysis

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

store = {
    "temoin": {"feats": [], "ids": []},
    "expose": {"feats": [], "ids": []},
}


@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        file  = request.files["file"]
        group = request.form.get("group", "")
        data  = json.load(file)

        cage      = data.get("metadonnees", {}).get("cage_experimentale", {})
        ruche_pos = cage.get("ruche_position_m", {})
        ruche     = [ruche_pos.get("x", 0.1), ruche_pos.get("y", 0.1), ruche_pos.get("z", 0)]
        flowers   = [
            (p["x"], p["y"], p.get("z", 0), p.get("id", i))
            for i, p in enumerate(cage.get("plantes", []))
        ]

        for key, val in data.items():
            if not key.startswith("bourdon_"):
                continue

            feat_dict, feat_vec = compute_features(
                val.get("trajectoire", []),
                ruche=ruche,
                flowers=flowers,
                stats=val.get("statistiques", None),
            )

            if feat_dict is None:
                feat_dict = {fname: 0.0 for fname in FEAT_NAMES}
            else:
                bee_id = val.get("id", key)
                if group in store and feat_vec is not None:
                    store[group]["feats"].append(feat_vec)
                    store[group]["ids"].append(bee_id)

            val["metriques"] = feat_dict

        data["_ml"] = None
        return jsonify(data)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/compute-ml", methods=["POST"])
def compute_ml():
    try:
        ml_result = None
        if store["temoin"]["feats"] and store["expose"]["feats"]:
            try:
                ml_result = run_analysis(
                    store["temoin"]["feats"], store["expose"]["feats"],
                    store["temoin"]["ids"],   store["expose"]["ids"],
                )
            except Exception as e:
                import traceback
                traceback.print_exc()

        return jsonify({"_ml": ml_result})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/reset", methods=["POST"])
def reset():
    store["temoin"] = {"feats": [], "ids": []}
    store["expose"] = {"feats": [], "ids": []}
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)