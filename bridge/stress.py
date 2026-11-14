"""Stress feed for the serial bridge (Nandini). Standard library only.

The saved stress model output (held-out WESAD subject S17, ml/out/demo_predictions_physio.json)
goes out on the same WebSocket stream as the station readings, through Bridge.publish():

  - with_stress(scenario):  POST /scenario merges data/scenario_stress_s17.json into the
    Mars day 143 readings by timestamp (stress_prob, stress_label, one stress_mood_check).
  - replay_stress(...):     POST /stress streams the last n windows live, one window every
    interval_s seconds, timestamped now, source "ml_saved".

The stress model is one more indicator for the engine. It never sets a tier on its own.
"""
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))
import stress_feed  # noqa: E402  (ml/stress_feed.py, standard library only)

STRESS_SCENARIO = ROOT / "data" / "scenario_stress_s17.json"


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def available():
    return stress_feed.PREDICTIONS.exists()


def with_stress(readings):
    """Scenario readings plus the saved stress readings, sorted by timestamp."""
    if not STRESS_SCENARIO.exists():
        return readings
    extra = json.loads(STRESS_SCENARIO.read_text(encoding="utf-8-sig"))
    return sorted(readings + extra, key=lambda r: r["timestamp"])


def live_windows(crew_id, last_n):
    """[(stress_prob reading, stress_label reading)] for the last n windows, timestamps filled at send time."""
    rows = stress_feed.stress_readings(crew_id, last_n=last_n, source="ml_saved")
    return [(rows[i], rows[i + 1]) for i in range(0, len(rows), 2)]


async def replay_stress(publish, crew_id="C003", last_n=8, interval_s=1.0, mood=None):
    """Publish the last n windows, one every interval_s, then one stress_mood_check if a mood is known."""
    probs = []
    for prob, label in live_windows(crew_id, last_n):
        ts = _now_iso()
        publish({"kind": "reading", "data": {**prob, "timestamp": ts}})
        publish({"kind": "reading", "data": {**label, "timestamp": ts}})
        probs.append(prob["value"])
        await asyncio.sleep(interval_s)
    if mood is not None:
        publish({"kind": "reading",
                 "data": stress_feed.check_mismatch(mood, probs, crew_id, timestamp=_now_iso())})
    return len(probs)
