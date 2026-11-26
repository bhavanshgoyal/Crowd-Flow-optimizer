---
title: Crowd Flow Optimiser
emoji: 🚦
colorFrom: teal
colorTo: red
sdk: docker
app_port: 7860
---

# Crowd Flow Optimiser

Predictive crowd bottleneck detection and rerouting. A twin agent-based
simulation (Weidmann walking-speed model, Dijkstra flow-field routing,
Fruin Level-of-Service risk bands) forecasts crush density up to 120
seconds ahead and tells an operator what to do about it — calibrated by
RT-DETR person detection from the Hugging Face Hub.

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev -- --open
```

The Vite dev server proxies `/api` and `/ws` to `localhost:8000`, so the
live control room populates automatically — no CORS setup needed.

## Run in Docker (what Hugging Face Spaces runs)

```bash
cd frontend && npm run build && cd ..
docker build -t crowd-flow-optimiser .
docker run -p 7860:7860 crowd-flow-optimiser
```

Visit `http://localhost:7860`. The image bakes in whatever is currently in
`frontend/dist/` — rebuild the frontend before rebuilding the image.

## API

See the docstring at the top of `backend/app.py` for the full endpoint
contract (`/ws`, `/api/venue`, `/api/scenarios`, `/api/load/{name}`,
`/api/control`, `/api/calibrate`, `/api/health`), or run the server and
open `/docs` for the interactive FastAPI explorer.
