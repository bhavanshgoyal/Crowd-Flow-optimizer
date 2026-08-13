"""Person counting from a photo, used to calibrate simulation arrival rates.

Real detection uses RT-DETR from the Hugging Face Hub (``transformers``).
That is a ~200MB first-download dependency, so this module degrades to a
deterministic heuristic estimator when ``torch``/``transformers`` aren't
installed or the model can't be fetched (no network on a hackathon floor,
cold Space, etc.) — the ``/api/calibrate`` endpoint must never 500 just
because the ML stack isn't available. The response JSON shape is identical
either way; only ``"model"`` tells you which path served it.
"""

import io

from PIL import Image

_pipe = None
_pipe_failed = False
MODEL_ID = "PekingU/rtdetr_r50vd_coco_o365"   # fallback model: "facebook/detr-resnet-50"


def _get_pipe():
    global _pipe, _pipe_failed
    if _pipe is not None or _pipe_failed:
        return _pipe
    try:
        from transformers import pipeline
        _pipe = pipeline("object-detection", model=MODEL_ID)
    except Exception:
        _pipe_failed = True
    return _pipe


def _heuristic_count(img: Image.Image) -> dict:
    """Deterministic stand-in when the real detector is unavailable.

    Not a person detector — a texture-density estimate (edge energy per
    tile) scaled to a plausible headcount for a crowd photo, so the rest of
    the calibration pipeline (density -> arrival rate) has something real
    to chew on and the demo never breaks on a missing model download.
    """
    import numpy as np

    small = img.convert("L").resize((160, 120))
    arr = np.asarray(small, dtype=np.float32)
    gx = np.abs(np.diff(arr, axis=1))
    gy = np.abs(np.diff(arr, axis=0))
    edge_energy = float(gx.mean() + gy.mean())
    # Calibrated so a busy crowd photo (high edge energy from many
    # heads/shoulders) lands in the low hundreds, not thousands.
    count = max(0, int(round(edge_energy * 3.4)))
    return {"count": count, "boxes": [], "width": img.width, "height": img.height,
            "model": "heuristic-edge-density-v1 (fallback — install torch+transformers for real detection)"}


def count_people(image_bytes: bytes, threshold: float = 0.5) -> dict:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pipe = _get_pipe()
    if pipe is None:
        return _heuristic_count(img)

    try:
        results = pipe(img, threshold=threshold)
    except Exception:
        return _heuristic_count(img)

    people = [r for r in results if r["label"].lower() == "person"]
    boxes = [{
        "x": r["box"]["xmin"], "y": r["box"]["ymin"],
        "w": r["box"]["xmax"] - r["box"]["xmin"],
        "h": r["box"]["ymax"] - r["box"]["ymin"],
        "score": round(float(r["score"]), 3),
    } for r in people]
    return {"count": len(people), "boxes": boxes,
            "width": img.width, "height": img.height, "model": MODEL_ID}
