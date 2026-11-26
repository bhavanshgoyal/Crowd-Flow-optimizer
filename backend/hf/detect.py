"""Person counting from a photo, used to calibrate simulation arrival rates.

Detection order:
1. Local RT-DETR via ``transformers`` (when installed and cached or Hub reachable).
2. Hugging Face Inference Providers via ``InferenceClient.object_detection``
   when ``HF_TOKEN`` is set — keeps RAM under ~150 MB on lightweight hosts
   like Render's 512 MB free tier without installing PyTorch locally.
3. Deterministic edge-density heuristic fallback so ``/api/calibrate`` never 500s.
"""

import importlib.util
import io
import os
import socket

from PIL import Image

_pipe = None
_pipe_failed = False
MODEL_ID = "PekingU/rtdetr_r50vd_coco_o365"
INFERENCE_FALLBACK_MODEL = "facebook/detr-resnet-50"


def _hub_reachable(timeout: float = 2.5) -> bool:
    try:
        with socket.create_connection(("huggingface.co", 443), timeout=timeout):
            return True
    except OSError:
        return False


def _get_pipe():
    global _pipe, _pipe_failed
    if _pipe is not None or _pipe_failed:
        return _pipe
    if importlib.util.find_spec("transformers") is None or importlib.util.find_spec("torch") is None:
        _pipe_failed = True
        return None
    try:
        from huggingface_hub import try_to_load_from_cache

        cached = isinstance(try_to_load_from_cache(MODEL_ID, "config.json"), str)
        if not cached and not _hub_reachable():
            _pipe_failed = True
            return None
        from transformers import pipeline

        _pipe = pipeline("object-detection", model=MODEL_ID, local_files_only=cached)
    except Exception:
        _pipe_failed = True
    return _pipe


def _remote_count(img: Image.Image, threshold: float) -> dict | None:
    token = os.environ.get("HF_TOKEN")
    if not token:
        return None
    try:
        from huggingface_hub import InferenceClient

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        jpeg_bytes = buf.getvalue()

        client = InferenceClient(provider="hf-inference", api_key=token)
        for model_id in (MODEL_ID, INFERENCE_FALLBACK_MODEL):
            try:
                results = client.object_detection(jpeg_bytes, model=model_id, threshold=threshold)
            except Exception:
                continue
            people = [r for r in results if str(r.label).lower() == "person"]
            boxes = [{
                "x": int(r.box.xmin), "y": int(r.box.ymin),
                "w": int(r.box.xmax - r.box.xmin),
                "h": int(r.box.ymax - r.box.ymin),
                "score": round(float(r.score), 3),
            } for r in people]
            return {
                "count": len(people), "boxes": boxes,
                "width": img.width, "height": img.height,
                "model": f"{model_id} (hf-inference)",
            }
    except Exception:
        return None
    return None


def _heuristic_count(img: Image.Image) -> dict:
    """Deterministic stand-in when local ML and HF Inference are unavailable."""
    import numpy as np

    small = img.convert("L").resize((160, 120))
    arr = np.asarray(small, dtype=np.float32)
    gx = np.abs(np.diff(arr, axis=1))
    gy = np.abs(np.diff(arr, axis=0))
    edge_energy = float(gx.mean() + gy.mean())
    count = max(0, int(round(edge_energy * 3.4)))
    return {
        "count": count, "boxes": [], "width": img.width, "height": img.height,
        "model": "heuristic-edge-density-v1 (offline fallback)",
    }


def count_people(image_bytes: bytes, threshold: float = 0.5) -> dict:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pipe = _get_pipe()
    if pipe is not None:
        try:
            results = pipe(img, threshold=threshold)
            people = [r for r in results if r["label"].lower() == "person"]
            boxes = [{
                "x": r["box"]["xmin"], "y": r["box"]["ymin"],
                "w": r["box"]["xmax"] - r["box"]["xmin"],
                "h": r["box"]["ymax"] - r["box"]["ymin"],
                "score": round(float(r["score"]), 3),
            } for r in people]
            return {
                "count": len(people), "boxes": boxes,
                "width": img.width, "height": img.height, "model": MODEL_ID,
            }
        except Exception:
            pass

    remote = _remote_count(img, threshold)
    if remote is not None:
        return remote

    return _heuristic_count(img)
