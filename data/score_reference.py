"""Reference implementation of the knowledge.json scoring rules, plus tests.

Not the production engine (that is TypeScript, Part 1a). This file defines the
exact semantics, so the TypeScript engine can be tested against the same cases.

Run:  python data/score_reference.py
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
KNOWLEDGE = {i["type"]: i for i in json.loads((HERE / "knowledge.json").read_text())["indicators"]}
LEVELS = ["green", "amber", "red"]


def effective_spread(entry: dict, mean: float, spread: float) -> float:
    """Spread used for z: never below the per-measure floor from knowledge.json."""
    ms = entry["min_spread"]
    floor = ms["value"] if ms["mode"] == "absolute" else mean * ms["cv_pct"] / 100
    return max(spread, floor)


def bad_z(z: float, direction: str) -> float:
    """Deviation in the harmful direction (positive = worse)."""
    return {"low_is_bad": -z, "high_is_bad": z, "both": abs(z)}[direction]


def outside_normal(entry: dict, value: float) -> bool:
    nr = entry["normal_range"]
    return (nr["min"] is not None and value < nr["min"]) or (nr["max"] is not None and value > nr["max"])


def abs_hit(limit: dict, v: float) -> bool:
    return any([
        limit["below"] is not None and v < limit["below"],
        limit["at_or_below"] is not None and v <= limit["at_or_below"],
        limit["above"] is not None and v > limit["above"],
        limit["at_or_above"] is not None and v >= limit["at_or_above"],
    ])


def has_abs(limit: dict) -> bool:
    return any(limit[k] is not None for k in ("below", "at_or_below", "above", "at_or_above"))


def triggered(entry: dict, limit: dict, history: list, mean, spread) -> bool:
    """history = readings oldest..newest. Last item is the current reading."""
    value = history[-1]
    if limit["z"] is not None and mean is not None and spread is not None:
        z = (value - mean) / effective_spread(entry, mean, spread)
        if bad_z(z, entry["direction"]) >= limit["z"]:
            return True
    if limit["outside_normal"] and outside_normal(entry, value):
        return True
    if has_abs(limit):
        n = limit["streak"]
        recent = history[-n:]
        if len(recent) == n and all(abs_hit(limit, v) for v in recent):
            return True
    return False


def score(type_: str, history: list, mean=None, spread=None) -> str:
    """Return 'green' | 'amber' | 'red' for the latest value in history."""
    entry = KNOWLEDGE[type_]
    if triggered(entry, entry["red_limit"], history, mean, spread):
        return "red"
    if triggered(entry, entry["amber_limit"], history, mean, spread):
        return "amber"
    return "green"


def z_score(type_: str, value: float, mean: float, spread: float) -> float:
    return (value - mean) / effective_spread(KNOWLEDGE[type_], mean, spread)


# ---------------------------------------------------------------- tests
def run_tests():
    base = json.loads((HERE / "baselines.json").read_text())["crew"]
    g3 = base["C003"]["markers"]["lab_glucose"]
    gm, gs = g3["mean"], g3["spread"]
    cases = [
        # Demo scenario "Mars transit day 143": 3 nights of poor sleep (hours: 4.5, 5, 4)
        ("sleep night 1 (4.5 h)", "sleep_hours", [4.5], 7.5, 1.0, "amber"),
        ("sleep night 2 (5 h)", "sleep_hours", [4.5, 5], 7.5, 1.0, "amber"),
        ("sleep night 3 (4 h): 3 in a row <= 6 h", "sleep_hours", [4.5, 5, 4], 7.5, 1.0, "red"),
        ("sleep one bad night then recovery", "sleep_hours", [4.5, 5, 7.6], 7.5, 1.0, "green"),
        ("sleep 7.0 h exactly is normal", "sleep_hours", [7.0], 7.5, 1.0, "green"),
        ("sleep 6.5 h is amber (under 7)", "sleep_hours", [6.5], 7.5, 1.0, "amber"),
        # mood
        ("mood 3 amber", "mood", [3], 4.2, 0.4, "amber"),
        ("mood 2, 2 not yet red", "mood", [2, 2], 4.2, 0.4, "amber"),
        ("mood 2,2,2 red", "mood", [2, 2, 2], 4.2, 0.4, "red"),
        ("mood 5 green", "mood", [5], 4.2, 0.4, "green"),
        # reaction time (min spread 15 ms)
        ("RT +2 SD amber", "reaction_time_median", [340], 300, 20, "amber"),
        ("RT +3 SD red", "reaction_time_median", [360], 300, 20, "red"),
        ("RT faster than baseline is green", "reaction_time_median", [240], 300, 20, "green"),
        ("RT with tiny baseline spread uses floor (15 ms)", "reaction_time_median", [320], 300, 2, "green"),
        # lapses: zero baseline spread must not divide by zero
        ("lapses 0 -> 3 with zero spread, floor 1", "lapses", [3], 0, 0, "red"),
        ("lapses 0 -> 2", "lapses", [2], 0, 0, "amber"),
        ("lapses unchanged", "lapses", [0], 0, 0, "green"),
        # sway
        ("sway +3 SD red", "sway_rms", [0.056], 0.041, 0.005, "red"),
        # glucose with C003's real baseline from data/baselines.json
        ("C003 glucose 75 (baseline) green", "lab_glucose", [75], gm, gs, "green"),
        ("C003 glucose 62 lab-flagged low -> amber", "lab_glucose", [62], gm, gs, "amber"),
        ("C003 glucose 103 high: amber, NOT red", "lab_glucose", [103], gm, gs, "amber"),
        ("glucose 54 is not below 54: amber", "lab_glucose", [54], gm, gs, "amber"),
        ("glucose 53 red (ADA level 2)", "lab_glucose", [53], gm, gs, "red"),
        ("glucose 250 red (placeholder limit)", "lab_glucose", [250], gm, gs, "red"),
    ]
    fails = 0
    for name, t, hist, m, s, want in cases:
        got = score(t, hist, m, s)
        ok = got == want
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {got}" + ("" if ok else f" (expected {want})"))
    print(f"\n{len(cases) - fails}/{len(cases)} passed")
    return fails


if __name__ == "__main__":
    raise SystemExit(1 if run_tests() else 0)
