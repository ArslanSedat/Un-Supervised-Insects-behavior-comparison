import sys
import os
import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from features import compute_features, wrap_angle, circular_entropy, nearest_flower
from backend.tests.utils import straight_line, out_and_back, circle, still

#à compléter

def test_straight_line_is_maximally_efficient():
    traj = straight_line(n=60, length=6.0)
    feats, _ = compute_features(traj)
    assert feats["path_efficiency"] == pytest.approx(1.0, abs=1e-3)
    assert feats["sinuosity"] == pytest.approx(0.0, abs=1e-6)


def test_out_and_back_has_low_efficiency():
    traj = out_and_back(n=60, length=6.0)
    feats, _ = compute_features(traj)
    assert feats["path_efficiency"] < 0.05


def test_circle_gyration_radius_matches_geometry():
    radius = 2.0
    traj = circle(n=100, radius=radius)
    feats, _ = compute_features(traj)
    assert feats["rayon_giration"] == pytest.approx(radius, rel=1e-2)


def test_stationary_bee_does_not_crash():
    traj = still(n=20)
    feats, vec = compute_features(traj)
    assert feats is not None
    assert feats["vitesse_moy"] == 0.0
    assert all(np.isfinite(v) for v in vec)


def test_too_short_trajectory_returns_none():
    traj = still(n=3)
    feats, vec = compute_features(traj)
    assert feats is None
    assert vec is None


def test_bee_visits_a_flower():
    outbound = straight_line(n=20, length=2.0)
    at_flower = [{"x": 2.0, "y": 0.0, "z": 0.0, "t": (20 + i) * 0.1, "vitesse_ms": 0.0, "acceleration_ms2": 0.0} for i in range(15)]
    inbound = out_and_back(n=20, length=2.0)
    traj = outbound + at_flower + inbound

    feats, _ = compute_features(traj, ruche=[0, 0, 0], flowers=[(2.0, 0.0, 0.0, "f1")])
    assert feats["nb_visites_plantes"] >= 1
    assert feats["temps_proche_plantes"] > 1.0


def test_flower_detection_ignores_distant_flowers():
    traj = straight_line(n=30, length=3.0)
    feats, _ = compute_features(traj, ruche=[0, 0, 0], flowers=[(50.0, 50.0, 0.0, "far")])
    assert feats["nb_visites_plantes"] == 0
    assert feats["nb_fleurs_distinctes_visitees"] == 0


def test_wrap_angle_stays_in_range():
    values = np.array([0, np.pi / 2, -np.pi / 2, 3 * np.pi, -3 * np.pi, 5.5, -5.5])
    wrapped = wrap_angle(values)
    assert np.all(wrapped >= -np.pi - 1e-9)
    assert np.all(wrapped <= np.pi + 1e-9)


def test_wrap_angle_matches_expected_values():
    assert wrap_angle(np.array([3 * np.pi + 0.3]))[0] == pytest.approx(-np.pi + 0.3, abs=1e-9)
    assert wrap_angle(np.array([-3 * np.pi - 0.3]))[0] == pytest.approx(np.pi - 0.3, abs=1e-9)
    assert wrap_angle(np.array([np.pi + 0.2]))[0] == pytest.approx(-np.pi + 0.2, abs=1e-9)
    assert wrap_angle(np.array([0.5]))[0] == pytest.approx(0.5, abs=1e-9)


def test_circular_entropy_uniform_beats_concentrated():
    concentrated = np.full(200, 0.3)
    uniform = np.linspace(-np.pi, np.pi, 200, endpoint=False)
    assert circular_entropy(uniform) > circular_entropy(concentrated)


def test_nearest_flower_picks_the_closest_one():
    flowers = np.array([[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [1.0, 1.0, 0.0]])
    idx, dist = nearest_flower(np.array([1.0, 0.9, 0.0]), flowers)
    assert idx == 2
    assert dist == pytest.approx(0.1, abs=1e-6)


def test_grid_floor_handles_negative_coordinates():
    xs = [-0.05, 0.05] + list(np.linspace(1, 2, 20))
    traj = [{"x": float(x), "y": 0.0, "z": 0.0, "t": i * 0.1, "vitesse_ms": 1.0, "acceleration_ms2": 0.0} for i, x in enumerate(xs)]
    feats, _ = compute_features(traj)
    assert feats["confusion_spatiale"] < 0.5
