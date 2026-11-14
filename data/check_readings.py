"""Validate a JSON array of readings against the reading schema in docs/schemas.md.

Usage: python data/check_readings.py [file.json]   (default: data/scenario_mars_day143.json)
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# Copied from docs/schemas.md; update both together. type -> (value type, unit)
TYPES = {
    "reaction_time": (float, "ms"),
    "reaction_time_median": (float, "ms"),
    "lapses": (float, "count"),
    "sway_rms": (float, "g"),
    "sleep_hours": (float, "h"),
    "mood": (float, "score_1_5"),
    "symptom": (str, ""),
    "heart_rate": (float, "bpm"),
    "bp_systolic": (float, "mmHg"),
    "bp_diastolic": (float, "mmHg"),
    "stress_prob": (float, "prob_0_1"),
    "stress_label": (str, ""),
}
SOURCES = {"station", "replay", "checkin", "ml_live", "ml_saved", "osdr"}
FIELDS = {"crew_id", "timestamp", "type", "value", "unit", "source"}
CREW_ID = re.compile(r"C00[1-4]|GUEST")
TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")  # ISO 8601 UTC, as in the schema examples


def check(r):
    """Return a list of problems with one reading (empty if valid)."""
    if not isinstance(r, dict):
        return ["not an object"]
    errs = []
    if set(r) != FIELDS:
        errs.append(f"fields {sorted(r)} != {sorted(FIELDS)}")
        return errs
    if not CREW_ID.fullmatch(str(r["crew_id"])):
        errs.append(f"bad crew_id {r['crew_id']!r}")
    if not TIMESTAMP.fullmatch(str(r["timestamp"])):
        errs.append(f"bad timestamp {r['timestamp']!r}")
    if r["source"] not in SOURCES:
        errs.append(f"unknown source {r['source']!r}")
    t, v = r["type"], r["value"]
    if t.startswith("lab_"):  # unit varies per analyte, as in OSDR
        expected = (float, r["unit"])
    elif t in TYPES:
        expected = TYPES[t]
    else:
        return errs + [f"unknown type {t!r}"]
    kind, unit = expected
    is_number = isinstance(v, (int, float)) and not isinstance(v, bool)
    if (kind is float and not is_number) or (kind is str and not isinstance(v, str)):
        errs.append(f"value {v!r} should be {'number' if kind is float else 'string'}")
    if r["unit"] != unit:
        errs.append(f"unit {r['unit']!r} should be {unit!r}")
    if t == "mood" and v not in (1, 2, 3, 4, 5):
        errs.append(f"mood {v!r} not an integer 1 to 5")
    if t == "stress_label" and v not in ("baseline", "stress"):
        errs.append(f"stress_label {v!r} not baseline or stress")
    return errs


def main(path):
    readings = json.loads(Path(path).read_text(encoding="utf-8-sig"))  # -sig: Windows tools may add a BOM
    assert isinstance(readings, list), "file must be a JSON array"
    problems = [f"#{i}: {e}" for i, r in enumerate(readings) for e in check(r)]
    stamps = [r.get("timestamp", "") for r in readings if isinstance(r, dict)]
    if not problems and stamps != sorted(stamps, key=lambda s: datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")):
        problems.append("readings not sorted by timestamp")
    for p in problems:
        print(p)
    if problems:
        raise SystemExit(f"FAIL: {len(problems)} problem(s) in {path}")
    print(f"OK: {len(readings)} readings in {path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("scenario_mars_day143.json"))
