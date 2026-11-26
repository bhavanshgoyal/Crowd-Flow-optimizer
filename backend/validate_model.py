r"""Offline physics, forecast accuracy, and dataset-export helper.

Run inside ``backend/``:
    .\.venv\Scripts\python.exe validate_model.py
    .\.venv\Scripts\python.exe validate_model.py --export-csv traces.csv
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np

from sim.agents import Simulation
from sim.density import weidmann_speed
from sim.forecast import forecast

SCENARIOS = Path(__file__).parent / "scenarios"


def check_weidmann_curve():
    rhos = np.array([0.5, 1.0, 2.0, 2.5, 3.0, 4.0, 5.0])
    speeds = weidmann_speed(rhos)
    flows = rhos * speeds  # p / m / s
    peak_idx = int(np.argmax(flows))
    print("Weidmann check:")
    for r, v, q in zip(rhos, speeds, flows):
        print(f"  rho={r:4.1f} p/m2 -> v={v:.2f} m/s, flow={q:.2f} p/m/s")
    print(f"  flow peaks at rho={rhos[peak_idx]:.1f} p/m2 (q={flows[peak_idx]:.2f} p/m/s)")


def evaluate_scenario(name: str, duration_s: float = 120.0, writer=None):
    venue = json.loads((SCENARIOS / f"{name}.json").read_text())
    baseline = Simulation(venue, congestion_k=0.0, seed=1)
    managed = Simulation(venue, congestion_k=3.0, seed=1)

    dt = 0.1
    steps = int(round(duration_s / dt))
    zone_history: dict[int, dict[str, float]] = {}
    predictions: list[tuple[int, str, float, int]] = []  # (target_tick, zone_id, pred_rho, eta_s)

    for step in range(steps):
        baseline.step(dt)
        managed.step(dt)

        m_zones = managed.zone_stats()
        b_zones = baseline.zone_stats()
        zone_history[step] = {z["id"]: z["rho"] for z in m_zones}

        if step % 100 == 0 and step < steps - 100:
            for br in forecast(managed, horizon_s=90.0, dt=0.5):
                target = step + int(round(br["eta_s"] / dt))
                if target < steps:
                    predictions.append((target, br["zone"], br["predicted_rho"], br["eta_s"]))

        if writer and step % 10 == 0:
            for mode, sim, zs in [("baseline", baseline, b_zones), ("managed", managed, m_zones)]:
                for z in zs:
                    writer.writerow([
                        name, round(sim.t, 1), mode, z["id"], z["rho"],
                        z["los"], z["risk"], sim.cleared, len(sim.pos),
                    ])

    errors = []
    for target, zid, pred_rho, eta_s in predictions:
        actual = zone_history[target][zid]
        errors.append(abs(pred_rho - actual))

    mae = float(np.mean(errors)) if errors else 0.0
    print(
        f"{name:8s} | t={duration_s:.0f}s | baseline_peak={baseline.rho.max():.2f} "
        f"| managed_peak={managed.rho.max():.2f} | forecast_MAE={mae:.2f} p/m2 ({len(errors)} checks)"
    )


def main():
    parser = argparse.ArgumentParser(description="Validate crowd physics and forecast accuracy.")
    parser.add_argument("--duration", type=float, default=120.0, help="Simulated seconds per scenario.")
    parser.add_argument("--export-csv", type=str, default=None, help="Optional CSV path for HF dataset export.")
    args = parser.parse_args()

    check_weidmann_curve()

    f_out = None
    writer = None
    try:
        if args.export_csv:
            f_out = open(args.export_csv, "w", newline="", encoding="utf-8")
            writer = csv.writer(f_out)
            writer.writerow(["scenario", "t_s", "mode", "zone", "rho", "los", "risk", "cleared", "remaining"])
        for sc in ["stadium", "ghat"]:
            evaluate_scenario(sc, duration_s=args.duration, writer=writer)
    finally:
        if f_out:
            f_out.close()


if __name__ == "__main__":
    main()
