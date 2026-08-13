"""FastAPI entrypoint for the Crowd Flow Optimiser.

Endpoints, and what each one expects / returns
------------------------------------------------
WS   /ws
     No request body. Pushes a "tick" JSON object 10x/second (see
     ``build_tick()``). This is the only channel the live map, KPI bar,
     alerts panel, zone table and density chart read from — matches
     ``frontend/src/store.ts``'s ``Tick`` type exactly.

GET  /api/venue
     -> the currently loaded venue JSON (geometry, spawns, goals, zones,
        corridors). Matches ``frontend/src/store.ts``'s ``Venue`` type.
        Called once on mount by ``useSocket.ts``.

GET  /api/scenarios
     -> [{"id": "stadium", "name": "Stadium — full-time egress"}, ...]
        Not yet wired to a frontend control (Controls.tsx hardcodes its
        two <option>s), but kept so a future scenario picker can list
        what's actually on disk instead of hardcoding it twice.

POST /api/load/{name}
     Loads scenarios/{name}.json as both twins. -> {"ok": true, "venue": {...}}

POST /api/control
     Body: {"action": "pause"|"resume"|"reset"|"hold", ...}
       - pause / resume: no extra fields.
       - reset: {"scenario": "stadium"} (defaults to the current one).
       - hold: {"spawn": "<spawn-or-corridor-id>", "factor": 0.3}
         Applied ONLY to the managed twin — this is "the operator uses the
         tool's advice", so it must never touch the baseline comparison.
         ``spawn`` may name a real spawn (throttles arrival rate) or a
         corridor (e.g. "gate_5_corridor" — factor < 1 opens/cheapens it,
         > 1 narrows it). Matches every button in Controls.tsx:
         Pause/Resume, Reset, "Hold Stand A · 40s", "Open Gate 5 corridor".
     -> {"ok": true, "resolved": "spawn"|"corridor"|"unknown"|None,
         "multipliers": {"spawns": {...}, "corridors": {...}}}

POST /api/calibrate  (multipart/form-data)
     Fields: file (image), spawn_id (str), area_m2 (float),
             gate_width_m (float, default 4.0)
     Runs HF person-detection on the photo, converts to an arrival rate,
     and applies it to the named spawn. No upload UI calls this yet (the
     Landing page's video rail is static placeholders) — implemented so
     the contract exists and the endpoint is demoable from /docs today.
     -> {"count", "boxes", "width", "height", "model",
         "observed_density", "arrival_rate", "spawn_id"}

GET  /api/health
     -> {"ok": true, "running": bool, "t": float} — cheap liveness probe,
        also useful for warming a sleeping HF Space before a demo.
"""

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from sim.agents import Simulation
from sim.forecast import forecast

SCENARIOS = Path(__file__).parent / "scenarios"
DEFAULT_SCENARIO = "stadium"

state = {
    "scenario": DEFAULT_SCENARIO,
    "venue": None,
    "baseline": None,
    "managed": None,
    "running": True,
    "alerts": [],
    "peak_baseline": 0.0,
    "peak_managed": 0.0,
}


def load(name: str):
    path = SCENARIOS / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"no such scenario: {name}")
    venue = json.loads(path.read_text())
    state["scenario"] = name
    state["venue"] = venue
    state["baseline"] = Simulation(venue, congestion_k=0.0, seed=1)
    state["managed"] = Simulation(venue, congestion_k=3.0, seed=1)
    state["alerts"] = []
    state["peak_baseline"] = state["peak_managed"] = 0.0
    state["running"] = True


load(DEFAULT_SCENARIO)


def coarse_density(rho: np.ndarray, cell_m: float, target_m: float = 2.0):
    """Downsample the density grid for transmission. Returns (w, h, flat uint8 list)."""
    f = max(1, int(round(target_m / cell_m)))
    H, W = rho.shape
    rho = rho[:H // f * f, :W // f * f]
    small = rho.reshape(H // f, f, W // f, f).max(axis=(1, 3))
    scaled = np.clip(small / 6.0 * 255.0, 0, 255).astype(np.uint8)
    return scaled.shape[1], scaled.shape[0], scaled.flatten().tolist()


def build_tick():
    m, b = state["managed"], state["baseline"]
    state["peak_managed"] = max(state["peak_managed"], float(m.rho.max()) if m.rho.size else 0.0)
    state["peak_baseline"] = max(state["peak_baseline"], float(b.rho.max()) if b.rho.size else 0.0)

    pts = m.pos
    if len(pts) > 1500:
        idx = np.linspace(0, len(pts) - 1, 1500).astype(int)
        pts = pts[idx]

    w, h, dens = coarse_density(m.rho, m.grid.cell)
    return {
        "t": round(m.t, 1),
        "running": state["running"],
        "agents": np.round(pts, 1).tolist(),
        "density_w": w, "density_h": h, "density": dens,
        "zones": m.zone_stats(),
        "alerts": state["alerts"],
        "kpi": {
            "peak_rho_baseline": round(state["peak_baseline"], 2),
            "peak_rho_managed": round(state["peak_managed"], 2),
            "cleared": m.cleared,
            "remaining": int(len(m.pos)),
            # Not modelled per-tick (would need a matched-throughput
            # comparison, not an instantaneous one) — reserved so the
            # frontend can display it once that analysis exists.
            "time_saved_s": 0.0,
        },
    }


async def sim_loop():
    dt = 0.1
    while True:
        t0 = asyncio.get_event_loop().time()
        if state["running"]:
            state["managed"].step(dt)
            state["baseline"].step(dt)
        elapsed = asyncio.get_event_loop().time() - t0
        await asyncio.sleep(max(0.0, dt - elapsed))


async def forecast_loop():
    """Runs the 120s-ahead ghost sim + advisory text off the event loop."""
    from hf.advise import advise
    loop = asyncio.get_running_loop()
    while True:
        await asyncio.sleep(3.0)
        if not state["running"]:
            continue
        try:
            managed = state["managed"]
            breaches = await loop.run_in_executor(None, forecast, managed)
            zones = managed.zone_stats()
            out = []
            for br in breaches[:3]:
                fallback = f"Hold arrivals into {br['label']} and open an alternate corridor for {br['eta_s']} s."
                text = await loop.run_in_executor(None, advise, br, zones, fallback)
                out.append({**br, "action": fallback, "text": text})
            state["alerts"] = out
        except Exception as e:
            print("forecast error:", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(sim_loop())
    asyncio.create_task(forecast_loop())
    yield


app = FastAPI(title="Crowd Flow Optimiser", lifespan=lifespan)


@app.websocket("/ws")
async def ws(sock: WebSocket):
    await sock.accept()
    try:
        while True:
            await sock.send_json(build_tick())
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass


@app.get("/api/venue")
def venue():
    return state["venue"]


@app.get("/api/scenarios")
def scenarios():
    out = []
    for p in sorted(SCENARIOS.glob("*.json")):
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue
        out.append({"id": data.get("id", p.stem), "name": data.get("name", p.stem)})
    return out


@app.post("/api/load/{name}")
def api_load(name: str):
    load(name)
    return {"ok": True, "venue": state["venue"]}


@app.post("/api/control")
def control(payload: dict):
    a = payload.get("action")
    resolved = None
    if a == "pause":
        state["running"] = False
    elif a == "resume":
        state["running"] = True
    elif a == "reset":
        load(payload.get("scenario", state["scenario"]))
    elif a == "hold":
        spawn = payload.get("spawn")
        factor = payload.get("factor", 1.0)
        if spawn is not None:
            resolved = state["managed"].set_multiplier(spawn, factor)
    return {
        "ok": True,
        "resolved": resolved,
        # A "reset" swaps in a whole new venue (different geometry, possibly
        # different width/height) — the frontend only fetches /api/venue
        # once on mount, so it needs this back to re-sync the canvas and
        # header instead of silently rendering stale walls/zones.
        "venue": state["venue"] if a == "reset" else None,
        "multipliers": {
            "spawns": state["managed"]._spawn_multipliers,
            "corridors": state["managed"]._corridor_overrides,
        },
    }


@app.post("/api/calibrate")
async def calibrate(file: UploadFile = File(...),
                     spawn_id: str = Form(...),
                     area_m2: float = Form(...),
                     gate_width_m: float = Form(4.0)):
    from hf.detect import count_people
    res = count_people(await file.read())
    density = res["count"] / max(area_m2, 1.0)
    rate = density * gate_width_m * 1.2  # standard planning figure: p/m-width/s
    for sp in state["venue"].get("spawns", []):
        if sp["id"] == spawn_id:
            sp["rate_per_s"] = round(float(rate), 2)
    return {**res, "observed_density": round(density, 2),
            "arrival_rate": round(rate, 2), "spawn_id": spawn_id}


@app.get("/api/health")
def health():
    return {"ok": True, "running": state["running"], "t": round(state["managed"].t, 1)}


# Serve the built React app. Must be LAST — it catches every other path.
DIST = Path(__file__).parent / "static"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="static")
