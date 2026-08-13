import copy

import numpy as np

from .density import band, density_grid, sample, weidmann_speed, LOS_BANDS, RISK_BANDS
from .flowfield import congestion_cost, direction_field, distance_field
from .grid import Grid

REPULSION = 0.35          # how hard agents push away from dense patches
FIELD_REFRESH_TICKS = 10  # recompute routes once per second at 10 Hz


class Simulation:
    """One running twin of a venue.

    ``congestion_k=0`` is the "baseline" twin — agents ignore congestion and
    follow the shortest geometric path, jamming exactly where geometry sends
    them. ``congestion_k>0`` is the "managed" twin — routes bend away from
    dense cells. Running the same venue through both is what produces the
    before/after headline number.
    """

    def __init__(self, venue: dict, congestion_k: float = 3.0, seed: int = 0):
        self.grid = Grid(venue)
        self.venue = venue
        self.k = congestion_k
        self.rng = np.random.default_rng(seed)

        self.pos = np.zeros((0, 2), dtype=np.float32)
        self.goal = np.zeros(0, dtype=np.int32)
        self.t = 0.0
        self.tick = 0
        self.cleared = 0

        self.goal_ids = [g["id"] for g in venue["goals"]]
        self.goal_cells = [
            self.grid.cells_of(g["x"], g["y"], g["width_m"]) for g in venue["goals"]
        ]

        self.spawn_ids = [s["id"] for s in venue.get("spawns", [])]
        self.spawn_debt = np.zeros(len(venue.get("spawns", [])), dtype=np.float64)
        self._spawn_multipliers: dict[str, float] = {}

        # Corridors are operator-controllable routes: rectangles in metres
        # with a default cost multiplier. "Opening" one (factor < 1) makes
        # the flow field prefer it; "holding" one (factor > 1) makes it
        # more expensive. This is what "Open Gate 5 corridor" does.
        self.corridor_defs = venue.get("corridors", [])
        self.corridor_ids = [c["id"] for c in self.corridor_defs]
        self._corridor_overrides: dict[str, float] = {}
        self._fields_dirty = True

        self.rho = np.zeros((self.grid.H, self.grid.W), dtype=np.float32)
        self._rebuild_fields()

    # ---------- operator controls ----------
    def set_multiplier(self, target_id: str, factor: float) -> str:
        """Route a control-panel 'hold' action to the right knob.

        Returns what kind of target it resolved to, so the API can report
        back something meaningful (spawn / corridor / unknown).
        """
        if target_id in self.spawn_ids:
            self._spawn_multipliers[target_id] = float(factor)
            return "spawn"
        if target_id in self.corridor_ids:
            self._corridor_overrides[target_id] = float(factor)
            self._fields_dirty = True
            return "corridor"
        # Unknown id: store harmlessly so a future venue/UI addition just
        # works without a backend change, but flag it as unresolved.
        self._spawn_multipliers[target_id] = float(factor)
        return "unknown"

    def clear_multipliers(self):
        self._spawn_multipliers.clear()
        self._corridor_overrides.clear()
        self._fields_dirty = True

    # ---------- routing ----------
    def _build_base_cost(self):
        cost = np.ones((self.grid.H, self.grid.W), dtype=np.float32)
        for c in self.corridor_defs:
            factor = self._corridor_overrides.get(c["id"], c.get("base_multiplier", 1.0))
            r0, r1, c0, c1 = self.grid.rect_cells(c["x0"], c["y0"], c["x1"], c["y1"])
            cost[r0:r1, c0:c1] = factor
        return cost

    def _rebuild_fields(self):
        base_cost = self._build_base_cost()
        cost = congestion_cost(base_cost, self.rho, k=self.k)
        self.fields = []
        for cells in self.goal_cells:
            d = distance_field(self.grid.walkable, cost, cells)
            self.fields.append(direction_field(d))
        self._fields_dirty = False

    # ---------- spawning ----------
    def _spawn(self, dt):
        new_pos, new_goal = [], []
        for i, sp in enumerate(self.venue.get("spawns", [])):
            rate = sp["rate_per_s"] * self._spawn_multipliers.get(sp["id"], 1.0)
            self.spawn_debt[i] += rate * dt
            n = int(self.spawn_debt[i])
            self.spawn_debt[i] -= n
            if n <= 0:
                continue
            angle = self.rng.uniform(0, 2 * np.pi, n)
            rad = sp["radius"] * np.sqrt(self.rng.uniform(0, 1, n))
            xs = np.clip(sp["x"] + rad * np.cos(angle), 0.5, self.grid.width_m - 0.5)
            ys = np.clip(sp["y"] + rad * np.sin(angle), 0.5, self.grid.height_m - 0.5)
            new_pos.append(np.stack([xs, ys], axis=1).astype(np.float32))
            new_goal.append(np.full(n, self.goal_ids.index(sp["goal"]), dtype=np.int32))
        if new_pos:
            self.pos = np.vstack([self.pos] + new_pos)
            self.goal = np.concatenate([self.goal] + new_goal)

    # ---------- main step ----------
    def step(self, dt=0.1):
        self._spawn(dt)
        if self._fields_dirty or self.tick % FIELD_REFRESH_TICKS == 0:
            self._rebuild_fields()

        self.rho = density_grid(self.pos, self.grid)

        if len(self.pos):
            speed = weidmann_speed(sample(self.rho, self.pos, self.grid))

            fx = np.zeros(len(self.pos), dtype=np.float32)
            fy = np.zeros(len(self.pos), dtype=np.float32)
            for gi, (dx, dy) in enumerate(self.fields):
                m = self.goal == gi
                if m.any():
                    fx[m] = sample(dx, self.pos[m], self.grid)
                    fy[m] = sample(dy, self.pos[m], self.grid)

            # push away from dense patches (cheap stand-in for social force)
            ry, rx = np.gradient(self.rho)
            px = -sample(rx, self.pos, self.grid) / self.grid.cell
            py = -sample(ry, self.pos, self.grid) / self.grid.cell

            vx = fx + REPULSION * px
            vy = fy + REPULSION * py
            mag = np.hypot(vx, vy)
            mag[mag == 0] = 1.0
            vx, vy = vx / mag, vy / mag

            cand = self.pos + np.stack([vx * speed, vy * speed], axis=1) * dt
            cand[:, 0] = np.clip(cand[:, 0], 0.1, self.grid.width_m - 0.1)
            cand[:, 1] = np.clip(cand[:, 1], 0.1, self.grid.height_m - 0.1)

            # reject moves into walls
            cc = (cand[:, 0] / self.grid.cell).astype(np.int32)
            rr = (cand[:, 1] / self.grid.cell).astype(np.int32)
            blocked = ~self.grid.walkable[rr, cc]
            cand[blocked] = self.pos[blocked]
            self.pos = cand

            self._remove_arrived()

        self.t += dt
        self.tick += 1

    def _remove_arrived(self):
        keep = np.ones(len(self.pos), dtype=bool)
        for gi, g in enumerate(self.venue["goals"]):
            d = np.hypot(self.pos[:, 0] - g["x"], self.pos[:, 1] - g["y"])
            arrived = (self.goal == gi) & (d < g["width_m"] / 2)
            keep &= ~arrived
        self.cleared += int((~keep).sum())
        self.pos = self.pos[keep]
        self.goal = self.goal[keep]

    # ---------- reporting ----------
    def zone_stats(self):
        out = []
        for z in self.venue.get("zones", []):
            r0, r1, c0, c1 = self.grid.rect_cells(z["x0"], z["y0"], z["x1"], z["y1"])
            patch = self.rho[r0:r1, c0:c1]
            peak = float(patch.max()) if patch.size else 0.0
            area = abs(z["x1"] - z["x0"]) * abs(z["y1"] - z["y0"])
            out.append({
                "id": z["id"],
                "label": z.get("label", z["id"]),
                "rho": round(peak, 2),
                "los": band(peak, LOS_BANDS),
                "risk": band(peak, RISK_BANDS),
                "n": int(round(float(patch.mean()) * area)) if patch.size else 0,
            })
        return out

    def clone(self):
        """Cheap copy for the forecast. Shares immutable geometry."""
        s = copy.copy(self)
        s.pos = self.pos.copy()
        s.goal = self.goal.copy()
        s.rho = self.rho.copy()
        s.spawn_debt = self.spawn_debt.copy()
        s._spawn_multipliers = dict(self._spawn_multipliers)
        s._corridor_overrides = dict(self._corridor_overrides)
        s.fields = list(self.fields)
        return s
