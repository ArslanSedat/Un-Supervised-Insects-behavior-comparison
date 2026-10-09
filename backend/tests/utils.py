import numpy as np

def make_traj(points_xyz, dt=0.1, speed=None):
    pts = np.asarray(points_xyz, dtype=float)
    if speed is None:
        deltas = np.diff(pts, axis=0)
        step_speed = np.linalg.norm(deltas, axis=1) / dt
        speed = np.concatenate([[0.0], step_speed])
    traj = []
    for i, (x, y, z) in enumerate(pts):
        traj.append({"x": float(x), "y": float(y), "z": float(z), "t": i * dt, "vitesse_ms": float(speed[i]), "acceleration_ms2": 0.0})
    return traj

def straight_line(n=50, length=5.0, dt=0.1):
    xs = np.linspace(0, length, n)
    return make_traj(np.column_stack([xs, np.zeros(n), np.zeros(n)]), dt=dt)

def out_and_back(n=50, length=5.0, dt=0.1):
    half = n // 2
    out = np.linspace(0, length, half)
    back = np.linspace(length, 0, n - half)
    xs = np.concatenate([out, back])
    return make_traj(np.column_stack([xs, np.zeros(n), np.zeros(n)]), dt=dt)

def circle(n=80, radius=1.0, dt=0.1):
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
    xs = radius * np.cos(angles)
    ys = radius * np.sin(angles)
    return make_traj(np.column_stack([xs, ys, np.zeros(n)]), dt=dt)

def still(n=20, at=(0.0, 0.0, 0.0), dt=0.1):
    pts = np.tile(np.array(at, dtype=float), (n, 1))
    return make_traj(pts, dt=dt, speed=np.zeros(n))