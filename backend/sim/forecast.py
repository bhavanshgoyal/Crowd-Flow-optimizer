from .density import band, RISK_BANDS

BREACH_RHO = 4.0        # crush-risk threshold, p/m^2


def forecast(sim, horizon_s=120.0, dt=0.5):
    """Run a ghost copy of ``sim`` ahead in time. Return the first breach per zone.

    Called from a worker thread (see app.py) — never on the event loop,
    since ~240 ghost steps takes on the order of a second.
    """
    ghost = sim.clone()
    seen, breaches = set(), []
    steps = int(horizon_s / dt)
    for k in range(steps):
        ghost.step(dt)
        for z in ghost.zone_stats():
            if z["rho"] >= BREACH_RHO and z["id"] not in seen:
                seen.add(z["id"])
                breaches.append({
                    "zone": z["id"],
                    "label": z["label"],
                    "eta_s": round((k + 1) * dt),
                    "predicted_rho": z["rho"],
                    "severity": band(z["rho"], RISK_BANDS),
                })
    breaches.sort(key=lambda b: b["eta_s"])
    return breaches
