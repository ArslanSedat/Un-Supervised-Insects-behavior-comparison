import os
import sys
import threading
import webbrowser
from flask import Flask, send_from_directory
from flask_cors import CORS
import warnings
from routes import init_routes
warnings.filterwarnings("ignore")


def resource_path(relative_path):
    # PyInstaller unpacks bundled files into a temp dir (_MEIPASS) once packaged
    base_path = sys._MEIPASS if hasattr(sys, "_MEIPASS") else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, relative_path)


DIST_DIR = resource_path(os.path.join("frontend", "dist"))
app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")
CORS(app)

# holds uploaded bees' features between /upload and /compute-ml. global and
# shared across clients -- fine for one user at a time, not for concurrent use
store = {"all": {"feats": [], "ids": []}}
init_routes(app, store)


@app.route("/")
def index():
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    port = 5000
    threading.Timer(1.0, lambda: webbrowser.open(f"http://0.0.0.0:{port}")).start()
    app.run(debug=False, host="0.0.0.0", port=port)
