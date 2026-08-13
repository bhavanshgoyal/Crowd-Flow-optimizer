import heapq
import numpy as np

SQRT2 = 1.41421356
NEIGHBOURS = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
              (-1, -1, SQRT2), (-1, 1, SQRT2), (1, -1, SQRT2), (1, 1, SQRT2)]


def distance_field(walkable, cost, goal_cells):
    """Dijkstra from all goal cells at once. Returns cost-to-goal per cell."""
    H, W = walkable.shape
    dist = np.full((H, W), np.inf, dtype=np.float32)
    heap = []
    for (r, c) in goal_cells:
        if walkable[r, c]:
            dist[r, c] = 0.0
            heapq.heappush(heap, (0.0, r, c))

    while heap:
        d, r, c = heapq.heappop(heap)
        if d > dist[r, c]:
            continue
        for dr, dc, step in NEIGHBOURS:
            rr, cc = r + dr, c + dc
            if 0 <= rr < H and 0 <= cc < W and walkable[rr, cc]:
                nd = d + step * cost[rr, cc]
                if nd < dist[rr, cc]:
                    dist[rr, cc] = nd
                    heapq.heappush(heap, (nd, rr, cc))
    return dist


def direction_field(dist):
    """Unit vectors pointing downhill on the cost surface."""
    finite = np.where(np.isfinite(dist), dist, 1e6).astype(np.float32)
    gy, gx = np.gradient(finite)          # d/drow, d/dcol
    fx, fy = -gx, -gy                     # move down the gradient
    mag = np.hypot(fx, fy)
    mag[mag == 0] = 1.0
    return (fx / mag).astype(np.float32), (fy / mag).astype(np.float32)


def congestion_cost(base_cost, rho, k=3.0, rho_ref=4.0):
    """Make crowded cells expensive so routes bend around them.
    k=0 gives baseline routing (ignores congestion)."""
    penalty = 1.0 + k * np.square(np.clip(rho, 0, rho_ref) / rho_ref)
    return (base_cost * penalty).astype(np.float32)
