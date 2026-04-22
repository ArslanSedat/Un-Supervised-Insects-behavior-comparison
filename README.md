# Bourdons UI

Code for analyzing bumblebee trajectories in an experimental cage and extracting
kinematic/behavioral descriptors with machine learning classification.


src/app.py: entry point; Flask server handling file uploads, feature computation, and ML pipeline.

src/features.py: computes 23 kinematic and behavioral descriptors from 3D trajectories.

src/ml_model.py: machine learning pipeline (PCA dimensionality reduction, SVM classification,
Leave-One-Out validation, statistical tests).

src/bourdons_tracker_ui.jsx: React frontend component for interactive visualization and analysis.

Descriptors

Kinematic, trajectory geometry, directional dynamics, movement behavior, and spatial interaction:


vitesse_moy/vitesse_std: average and std dev of instantaneous speed (m/s).

stabilite: stability index (1 - std/mean).

acc_rms: root mean square acceleration.

tortuosite: ratio of straight-line distance to path length.

dist_totale: total path length (m).

katz_fd: Katz fractal dimension (path complexity).

rayon_giration: radius of gyration (m).

aire: 2D convex hull area (m²).

z_std: altitude standard deviation (m).

entropie_angles: Shannon entropy of angular changes.

autocorr_dir: autocorrelation of successive directions.

linearite: PCA 1-component variance ratio.

taux_immobilite: proportion of time immobile (velocity < 0.01 m/s).

temps_jusqua_immobilite: index to first immobility point.

ratio_mouvement_arret: movement vs immobility ratio.

nb_bouts: number of movement bouts (transitions).

msd_mean: mean squared displacement across multiple lags.

msd_slope: MSD slope in log-log space (diffusive scaling).

dist_ruche_mean: mean distance to hive (m).

nb_visites_plantes: count of flower visits.

temps_proche_plantes: time spent near flowers (steps).

retour_ruche: binary indicator (1 if final distance < initial distance to hive).

Setup & Usage

```bash
cd ~/bourdons-ui
./run.sh #ou sudo ./run.sh
```

Frontend: http://localhost:8080

Backend API: http://localhost:5000  

