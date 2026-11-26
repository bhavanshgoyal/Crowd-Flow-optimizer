import numpy as np


class Grid:
    """Rasterised venue. Arrays are indexed [row=y, col=x]."""

    def __init__(self, venue: dict):
        self.cell = float(venue["cell_m"])
        self.width_m = float(venue["width_m"])
        self.height_m = float(venue["height_m"])
        self.W = int(round(self.width_m / self.cell))
        self.H = int(round(self.height_m / self.cell))

        self.walkable = np.ones((self.H, self.W), dtype=bool)
        for ob in venue.get("obstacles", []):
            self._fill(ob["x0"], ob["y0"], ob["x1"], ob["y1"], False)

        self.venue = venue

    def _fill(self, x0, y0, x1, y1, value):
        c0, r0 = self.to_cell(x0, y0)
        c1, r1 = self.to_cell(x1, y1)
        self.walkable[min(r0, r1):max(r0, r1) + 1,
                      min(c0, c1):max(c0, c1) + 1] = value

    def to_cell(self, x, y):
        """metres -> (col, row), clamped inside the grid."""
        c = int(np.clip(x / self.cell, 0, self.W - 1))
        r = int(np.clip(y / self.cell, 0, self.H - 1))
        return c, r

    def cells_of(self, x, y, width_m):
        """All walkable cells within width_m/2 of a point. Used for goals."""
        rad = max(1, int(width_m / 2 / self.cell))
        c, r = self.to_cell(x, y)
        out = []
        for dr in range(-rad, rad + 1):
            for dc in range(-rad, rad + 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < self.H and 0 <= cc < self.W and self.walkable[rr, cc]:
                    out.append((rr, cc))
        return out

    def rect_cells(self, x0, y0, x1, y1):
        """Row/col slice (inclusive) covering a metres rectangle. Used for zones/corridors."""
        c0, r0 = self.to_cell(x0, y0)
        c1, r1 = self.to_cell(x1, y1)
        r_lo, r_hi = min(r0, r1), max(r0, r1) + 1
        c_lo, c_hi = min(c0, c1), max(c0, c1) + 1
        return r_lo, r_hi, c_lo, c_hi
