# Bourdons Tracker

Analyse comportementale de trajectoires de bourdons suivis en cage expérimentale : extraction de 44 métriques de mouvement par individu, clustering non supervisé (UMAP + HDBSCAN), et interface web pour explorer les résultats.

## Structure du dépôt

```
backend/          API Flask : calcul des features, clustering, tests
  app.py           point d'entrée Flask
  routes.py        endpoints /upload, /compute-ml, /reset
  features.py      44 métriques par trajectoire (features.py::FEAT_NAMES)
  models.py        PCA, UMAP, HDBSCAN, ranking statistique, SHAP
  tests/           suite pytest
frontend/          interface React (Vite)
data/              jeux de données d'exemple (JSON)
```

## Installation

```bash
# backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# frontend
cd ../frontend
npm install
```

## Lancer le projet

```bash
# terminal 1 : backend (port 5000)
cd backend && python3 app.py

# terminal 2 : frontend en dev (port 5173, proxy vers le backend)
cd frontend && npm run dev
```

Pour un build de production servi directement par Flask :

```bash
cd frontend && npm run build   # génère frontend/dist
cd ../backend && python3 app.py
```

## Format des données d'entrée

Le backend attend un fichier JSON uploadé via `/upload`, avec cette structure :

```jsonc
{
  "metadonnees": {
    "cage_experimentale": {
      "ruche_position_m": { "x": 0.1, "y": 0.1, "z": 0 },
      "plantes": [ { "id": 0, "x": 1.2, "y": 0.4, "z": 0.1 }, ... ]
    }
  },
  "bourdon_001": {
    "id": "bourdon_001",
    "groupe": "temoin",
    "statistiques": {
      "vitesse_max_ms": 0.0869,
      "visites_plantes": 2,
      "duree_butinage": 2000,
      "retour_a_la_ruche": 1
    },
    "trajectoire": [
      { "t": 1, "x": 0.165, "y": 0.137, "z": 0.335, "vitesse_ms": 0.0605, "acceleration_ms2": 0.0606 },
      ...
    ]
  },
  ...
}
```

Unités : positions en mètres, vitesses en m/s, accélérations en m/s², temps en pas d'échantillonnage (`t`, converti en secondes via le `dt` médian de la trajectoire). Le champ `statistiques` est optionnel : quand un champ y est présent (ex. `vitesse_max_ms`), il prime sur la valeur recalculée depuis la trajectoire brute.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

21 tests : trajectoires synthétiques à réponse géométrique connue (ligne droite, aller-retour, cercle), cas limites, clustering sur groupes synthétiques séparés, correction statistique, non-régression sur `data/Exemple.json`.

## Métriques calculées (`backend/features.py`)

44 features par bourdon, réparties en vitesse/accélération, forme du trajet, immobilité, interactions avec les fleurs et retour à la ruche. Formules non triviales, avec leur source :

- **`sinuosity`** — indice de tortuosité de Benhamou (2004), `S = 2/√(p(1+c)/(1-c) + b²)`.
- **`msd_mean`** — déplacement quadratique moyen sur des décalages temporels fixes (0.1 à 5 s), convertis en nombre d'échantillons via le `dt` propre à chaque trajectoire pour rester comparable entre bourdons échantillonnés à des fréquences différentes.
- **`path_efficiency`** — indice de rectitude (Batschelet), distance nette / distance parcourue.
- **`entropie_angles`** — entropie de Shannon de la distribution des angles de virage.

Le détail de chaque métrique (formule, unité, limites connues) est dans les docstrings/commentaires de `features.py`.

## Clustering (`backend/models.py`)

1. Standardisation des 44 features (`StandardScaler`).
2. **PCA** (2D pour l'affichage + 10 composantes pour l'exploration) — loadings calculés comme `eigenvector × √eigenvalue`, interprétables comme des corrélations feature/axe.
3. **UMAP** (McInnes et al., 2018) : une projection 2D pour la carte, une projection en dimension plus haute pour donner du volume au clustering (une 2D perd trop d'information).
4. **HDBSCAN** (Campello et al., 2013) sur la projection haute dimension. `min_cluster_size` est recalculé selon le nombre de bourdons pour rester praticable sur de petits effectifs.
5. **DBCV** (Moulavi et al., 2014) comme indice de validité du clustering, calculé sur le même espace que le clustering (pas la projection 2D). `null` si moins de 2 clusters trouvés — normal avec peu de bourdons, HDBSCAN n'a pas assez de matière pour séparer des groupes fiables.
6. **Ranking des features discriminantes** : test de Kruskal-Wallis par feature entre clusters, taille d'effet epsilon² (Rea & Parker), correction de tests multiples par Benjamini-Hochberg (`p_value_corrigee`).
7. **SHAP** (optionnel) : un RandomForest surrogate est entraîné à prédire le cluster HDBSCAN à partir des features, puis expliqué par SHAP pour obtenir une importance par feature.
8. **`exploratory_score`** : score composite (45% taille d'effet, 35% SHAP, 20% poids ACP) pour prioriser les features à regarder en premier. Pondération choisie arbitrairement, pas issue d'une méthode statistique — à documenter comme tel si utilisée dans une publication, ou à ajuster selon vos priorités.

## Limites connues

- Le `store` qui garde les features entre `/upload` et `/compute-ml` (dans `app.py`) est une variable globale partagée par tous les clients du serveur : adapté à un usage mono-utilisateur local, pas à un déploiement multi-utilisateurs simultané.
- Avec peu de bourdons (moins d'une trentaine), le clustering HDBSCAN et l'importance SHAP sont statistiquement peu fiables — le pipeline reste utilisable pour explorer les données mais les conclusions doivent être prises avec prudence en dessous de ce seuil.
- Les seeds (`random_state=42`) sont fixés partout où c'est possible (PCA, UMAP, HDBSCAN indirectement via son entrée, RandomForest). UMAP force son exécution en mono-thread dès qu'un `random_state` est fourni (`n_jobs=1`), ce qui garantit la reproductibilité au prix d'un calcul plus lent sur de gros jeux de données.

## Citer ce logiciel

Voir `CITATION.cff`.

## Références

- Benhamou, S. (2004). How to reliably estimate the tortuosity of an animal's path. *Journal of Theoretical Biology*, 229(2), 209–220.
- Batschelet, E. (1981). *Circular Statistics in Biology*. Academic Press.
- Rea, L. M., & Parker, R. A. (2014). *Designing and Conducting Survey Research: A Comprehensive Guide* (4th ed.). Jossey-Bass. (formule de l'epsilon² pour Kruskal-Wallis)
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. *Journal of the Royal Statistical Society: Series B*, 57(1), 289–300.
- McInnes, L., Healy, J., & Melville, J. (2018). UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction. *arXiv:1802.03426*.
- Campello, R. J. G. B., Moulavi, D., & Sander, J. (2013). Density-Based Clustering Based on Hierarchical Density Estimates. *PAKDD 2013*.
- Moulavi, D., Jaskowiak, P. A., Campello, R. J. G. B., Zimek, A., & Sander, J. (2014). Density-Based Clustering Validation. *Proceedings of the 2014 SIAM International Conference on Data Mining*.
- Lundberg, S. M., & Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions. *NeurIPS 2017*. (SHAP)

## Licence

MIT — voir `LICENSE`.
