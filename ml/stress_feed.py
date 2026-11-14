"""FARSIDE stress feed + stress/mood mismatch check. Standard library only (the bridge imports it).

Two jobs:
  1. stress_readings(): turn the saved S17 predictions (ml/out/demo_predictions_physio.json)
     into `reading` objects (docs/schemas.md): one stress_prob + one stress_label per 60 s window.
     S17 was never in training; the feed stands in for a Bio-Monitor (Astroskin) shirt.
  2. check_mismatch(): compare recent predicted stress with the self-reported mood (1-5)
     and return one `stress_mood_check` reading.

The result is one more indicator for the rules engine. It NEVER sets a triage tier on its own.

CLI (writes the demo scenario file the bridges stream after the Mars day 143 scenario):
    python ml/stress_feed.py                # -> data/scenario_stress_s17.json
    python ml/stress_feed.py --mood 4       # preview the check with a different mood
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREDICTIONS = ROOT / "ml" / "out" / "demo_predictions_physio.json"
SCENARIO = ROOT / "data" / "scenario_mars_day143.json"
OUT = ROOT / "data" / "scenario_stress_s17.json"

# --- mismatch rules (DESIGN_CHOICE, recorded here and in docs/schemas.md) ---
WINDOW_COUNT = 5        # judge stress on the last 5 windows (about 2 minutes, windows slide 15 s)
STRESSED_AT = 0.6       # mean p_stress >= 0.6 -> body says stressed
CALM_AT = 0.4           # mean p_stress <= 0.4 -> body says calm (between: uncertain, no flag)
MOOD_FINE_AT = 4        # mood 4-5 -> "I'm fine"
MOOD_LOW_AT = 2         # mood 1-2 -> "I feel bad"

MESSAGES = {
    "hidden_stress": "Body signals show stress but self-reported mood is good. "
                     "Self-report can miss strain: take a 5-minute break and re-check.",
    "low_mood_no_stress": "Mood is low but body signals look calm. "
                          "Consider a private behavioural-health check-in with the crew medical officer.",
    "consistent": "Body signals and self-reported mood agree.",
    "uncertain": "Stress signal is borderline; no comparison made.",
    "no_data": "Not enough stress data or no mood check-in yet.",
}


def _iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse(ts):
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def load_predictions(path=PREDICTIONS):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def stress_readings(crew_id="C003", end_time=None, last_n=None, source="ml_saved", path=PREDICTIONS):
    """Readings for the saved windows, one window every 15 s, the last one ending at end_time.

    last_n: only the last n windows (the S17 file ends in its stress period).
    """
    windows = load_predictions(path)["windows"]
    if last_n:
        windows = windows[-last_n:]
    end_time = end_time or datetime.now(timezone.utc)
    out = []
    for i, w in enumerate(windows):
        ts = _iso(end_time - timedelta(seconds=15 * (len(windows) - 1 - i)))
        out.append({"crew_id": crew_id, "timestamp": ts, "type": "stress_prob",
                    "value": w["p_stress"], "unit": "prob_0_1", "source": source})
        out.append({"crew_id": crew_id, "timestamp": ts, "type": "stress_label",
                    "value": w["predicted"], "unit": "", "source": source})
    return out


def assess(mood, stress_probs):
    """(result, stress_level). mood: 1-5 or None. stress_probs: recent p_stress values, oldest first."""
    recent = list(stress_probs)[-WINDOW_COUNT:]
    if mood is None or len(recent) < WINDOW_COUNT:
        return "no_data", None
    level = sum(recent) / len(recent)
    if level >= STRESSED_AT:
        return ("hidden_stress" if mood >= MOOD_FINE_AT else "consistent"), level
    if level <= CALM_AT:
        return ("low_mood_no_stress" if mood <= MOOD_LOW_AT else "consistent"), level
    return "uncertain", level


def is_flag(result):
    """True -> show the flag (amber) on the brain & behaviour panel."""
    return result in ("hidden_stress", "low_mood_no_stress")


def check_mismatch(mood, stress_probs, crew_id="C003", timestamp=None, source="ml_saved"):
    """One `stress_mood_check` reading (the 6 schema fields only). The app shows MESSAGES[value]."""
    result, _ = assess(mood, stress_probs)
    return {"crew_id": crew_id, "timestamp": timestamp or _iso(datetime.now(timezone.utc)),
            "type": "stress_mood_check", "value": result, "unit": "", "source": source}


def build_demo_scenario(crew_id="C003", last_n=8, mood=None):
    """Stress readings that fit the Mars day 143 timeline: they end 1 minute before the
    STAND-REACT test, and the check uses the scenario's mood (or `mood` if given)."""
    scenario = json.loads(SCENARIO.read_text(encoding="utf-8-sig"))
    mine = [r for r in scenario if r["crew_id"] == crew_id]
    test_start = min(_parse(r["timestamp"]) for r in mine if r["type"] == "reaction_time")
    end = test_start - timedelta(minutes=1)
    if mood is None:
        moods = [r for r in mine if r["type"] == "mood"]
        mood = moods[-1]["value"] if moods else None
    feed = stress_readings(crew_id, end_time=end, last_n=last_n)
    probs = [r["value"] for r in feed if r["type"] == "stress_prob"]
    check = check_mismatch(mood, probs, crew_id, timestamp=_iso(end))
    return feed + [check], mood, assess(mood, probs)[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--crew", default="C003")
    ap.add_argument("--last-n", type=int, default=8)
    ap.add_argument("--mood", type=int, help="override the scenario mood for the check (preview only)")
    args = ap.parse_args()
    readings, mood, level = build_demo_scenario(args.crew, args.last_n, args.mood)
    result = readings[-1]["value"]
    print(f"{len(readings) - 1} stress readings, check: {result} "
          f"(stress level {level if level is None else round(level, 3)}, mood {mood}, flag {is_flag(result)})")
    print(f"App message: {MESSAGES[result]}")
    if args.mood is None:
        OUT.write_text(json.dumps(readings, indent=1) + "\n", encoding="utf-8")
        print(f"Saved -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
