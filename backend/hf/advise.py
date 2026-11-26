"""Turns a forecasted breach into a one-sentence steward instruction.

Uses a Hugging Face Inference Provider chat model when ``HF_TOKEN`` is set
and the network call succeeds. If either is missing — no token configured,
offline demo laptop, provider rate limit — ``advise()`` falls back to the
deterministic template string it was given. Read that twice: the
try/except returning a template is not laziness, it's the difference
between a demo that works and a demo that dies. Never let anything that
crosses the network be on the critical path of the live control room.
"""

import os

MODEL = "Qwen/Qwen2.5-7B-Instruct"
_client = None
_client_failed = False

SYSTEM = (
    "You are a crowd safety control room assistant. You receive density readings in "
    "people per square metre and a predicted breach time. Reply with ONE sentence "
    "of at most 25 words giving a concrete instruction to stewards: which gate to "
    "hold, which route to open, and for how long. No preamble, no hedging."
)


def _client_or_none():
    global _client, _client_failed
    if _client is not None or _client_failed:
        return _client
    token = os.environ.get("HF_TOKEN")
    if not token:
        _client_failed = True
        return None
    try:
        from huggingface_hub import InferenceClient
        _client = InferenceClient(api_key=token)
    except Exception:
        _client_failed = True
    return _client


def advise(breach: dict, zones: list[dict], fallback_action: str) -> str:
    client = _client_or_none()
    if client is None:
        return fallback_action

    context = ", ".join(f"{z['label']} {z['rho']} p/m2 (LOS {z['los']})" for z in zones)
    prompt = (f"Predicted breach: {breach['label']} reaching "
              f"{breach['predicted_rho']} p/m2 in {breach['eta_s']} seconds. "
              f"Current readings: {context}. Suggested measure: {fallback_action}.")
    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": SYSTEM},
                      {"role": "user", "content": prompt}],
            max_tokens=60, temperature=0.3,
        )
        text = r.choices[0].message.content.strip()
        return text or fallback_action
    except Exception:
        return fallback_action     # never let the demo depend on a network call
