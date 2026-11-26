import numpy as np
from scipy.ndimage import gaussian_filter

V_FREE = 1.34      # m/s, free walking speed
GAMMA = 1.913      # m^-2
RHO_MAX = 5.4      # p/m^2, jam density

RISK_BANDS = [
    (2.0, "safe"), (3.0, "watch"), (4.0, "warning"),
    (5.0, "critical"), (float("inf"), "emergency"),
]

LOS_BANDS = [
    (0.31, "A"), (0.43, "B"), (0.72, "C"),
    (1.08, "D"), (2.17, "E"), (float("inf"), "F"),
]


def band(value, table):
    for threshold, name in table:
        if value < threshold:
            return name
    return table[-1][1]


def density_grid(pos, grid, sigma_cells=2.0):
    """People per square metre, smoothed with a ~1 m measurement kernel."""
    counts = np.zeros((grid.H, grid.W), dtype=np.float32)
    if len(pos):
        c = np.clip((pos[:, 0] / grid.cell).astype(np.int32), 0, grid.W - 1)
        r = np.clip((pos[:, 1] / grid.cell).astype(np.int32), 0, grid.H - 1)
        np.add.at(counts, (r, c), 1.0)
    smoothed = gaussian_filter(counts, sigma=sigma_cells, mode="constant")
    return smoothed / (grid.cell ** 2)


def weidmann_speed(rho):
    """Walking speed as a function of local density (Weidmann 1993)."""
    r = np.clip(rho, 0.05, RHO_MAX - 0.01)
    return V_FREE * (1.0 - np.exp(-GAMMA * (1.0 / r - 1.0 / RHO_MAX)))


def sample(field, pos, grid):
    """Read a grid field at agent positions (nearest cell)."""
    if not len(pos):
        return np.zeros(0, dtype=np.float32)
    c = np.clip((pos[:, 0] / grid.cell).astype(np.int32), 0, grid.W - 1)
    r = np.clip((pos[:, 1] / grid.cell).astype(np.int32), 0, grid.H - 1)
    return field[r, c]
