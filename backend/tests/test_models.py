import sys
import os
import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import analyze_bees, epsilon_squared, dbcv_score, hdbscan_labels

def two_well_separated_groups(n_per_group=20, n_features=44, gap=8.0, seed=0):
    rng = np.random.default_rng(seed)
    a = rng.normal(loc=0.0, scale=0.3, size=(n_per_group, n_features))
    b = rng.normal(loc=gap, scale=0.3, size=(n_per_group, n_features))
    feats = np.vstack([a, b]).tolist()
    ids = [f"bee_{i}" for i in range(2 * n_per_group)]
    return feats, ids

def test_finds_two_clusters_when_two_exist():
    feats, ids = two_well_separated_groups()
    result = analyze_bees(feats, ids)
    assert result["clustering"]["n_clusters"] == 2

def test_dbcv_is_high_for_well_separated_clusters():
    feats, ids = two_well_separated_groups()
    result = analyze_bees(feats, ids)
    assert result["clustering"]["dbcv_score"] > 0.5

def test_dbcv_none_below_two_clusters():
    labels = np.array([-1, -1, -1, -1])
    assert dbcv_score(np.zeros((4, 3)), labels) is None
    assert dbcv_score(None, np.array([0, 0, 1, 1])) is None

def test_feature_ranking_flags_the_discriminative_feature():
    feats, ids = two_well_separated_groups()
    result = analyze_bees(feats, ids)
    top = result["clustering"]["feature_ranking"][0]
    assert top["effect_size"] > 0.5
    assert top["p_value_corrigee"] <= 0.05

def test_bh_correction_never_lowers_a_p_value():
    feats, ids = two_well_separated_groups()
    result = analyze_bees(feats, ids)
    for row in result["clustering"]["feature_ranking"]:
        assert row["p_value_corrigee"] >= row["p_value"] - 1e-9

def test_epsilon_squared_is_zero_when_samples_dont_exceed_groups():
    assert epsilon_squared(h=10.0, n=3, k=3) == 0.0

def test_small_sample_hdbscan_does_not_crash():
    coords = np.random.default_rng(1).normal(size=(8, 5))
    labels, warnings = hdbscan_labels(coords, n_bees=8)
    assert len(labels) == 8

def test_output_has_one_entry_per_bee():
    feats, ids = two_well_separated_groups(n_per_group=10)
    result = analyze_bees(feats, ids)
    assert set(result["per_bee"].keys()) == set(ids)