"""Simulation mode for the FARSIDE bridge: replays recorded Wokwi feed files. Standard library only.

The Wokwi ESP32 sketch prints one JSON line per second with all 8 channels. Diksha records 60 s of
that serial output per scenario into data/wokwi_feed_<scenario>.jsonl. The bridge replays a file over
/ws/stream as {"kind":"sim","data":{...}} messages, one per second (decision D-G: the browser Wokwi
sim cannot reach the laptop's bridge, so we record and replay).

Each sim message is display data for the sensor strip and the astronaut, like cabin_air: it is not a
crew `reading` and does not go to the rules engine. The UI tags these values "simulation".

Channel keys (aliases accepted, so small differences in the sketch's key names still work):
    spo2 %, hr bpm, rr breaths/min, sbp mmHg, skin_c degC, tilt_deg deg, co2_ppm ppm, rt_ms ms
Limits: plan Section 4 (NEWS2 for SpO2, HR, breathing, low BP; AHA crisis for high BP; PVT-B 355 ms
lapse for reaction; the rest are our design choices).
"""
import json
from datetime import datetime, timezone
from pathlib import Path

# key: (unit, label, aliases)
CHANNELS = {
    "spo2": ("%", "Blood oxygen", ("spo2", "SpO2", "sp_o2", "o2", "oxygen")),
    "hr": ("bpm", "Heart rate", ("hr", "heart_rate", "HR", "bpm", "pulse")),
    "rr": ("/min", "Breathing rate", ("rr", "resp", "resp_rate", "breathing_rate", "br")),
    "sbp": ("mmHg", "Blood pressure (systolic)", ("sbp", "bp", "bp_sys", "bp_systolic", "systolic")),
    "skin_c": ("degC", "Skin temperature", ("skin_c", "skin", "skin_temp", "temp", "temp_c", "t_skin")),
    "tilt_deg": ("deg", "Posture / tilt", ("tilt_deg", "tilt", "accel_tilt", "posture")),
    "co2_ppm": ("ppm", "Cabin CO2", ("co2_ppm", "co2", "CO2", "air", "cabin_co2")),
    "rt_ms": ("ms", "Reaction time", ("rt_ms", "rt", "reaction", "reaction_ms", "rt_median")),
}

# key: (amber test, red test). Red wins.
LIMITS = {
    "spo2": (lambda v: v <= 93, lambda v: v <= 91),
    "hr": (lambda v: v <= 50 or v >= 111, lambda v: v <= 40 or v >= 131),
    "rr": (lambda v: v <= 11 or v >= 21, lambda v: v <= 8 or v >= 25),
    "sbp": (lambda v: v <= 100 or v >= 140, lambda v: v <= 90 or v >= 180),
    "skin_c": (lambda v: v <= 30 or v >= 37, lambda v: v <= 28 or v >= 39),
    "tilt_deg": (lambda v: v >= 5, lambda v: v >= 10),
    "co2_ppm": (lambda v: v >= 4000, lambda v: v >= 5300),
    "rt_ms": (lambda v: v >= 356, lambda v: v >= 500),
}

PASS_THROUGH = ("mission", "scenario", "tier", "who", "who_acts", "rtt_s")
FEED_PREFIX = "wokwi_feed_"


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def status(key, value):
    amber, red = LIMITS[key]
    if red(value):
        return "red"
    if amber(value):
        return "amber"
    return "green"


def parse_feed_line(line):
    """One serial line from the Wokwi sketch -> dict, or None for anything that is not a JSON object."""
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        obj = json.loads(line)
    except ValueError:
        return None
    return obj if isinstance(obj, dict) else None


def normalise(raw):
    """Map the sketch's keys to our 8 channels, each with value, unit, label and status."""
    flat = dict(raw)
    for nested in ("ch", "channels", "vitals", "data"):  # accept {"vitals":{...}} too
        if isinstance(raw.get(nested), dict):
            flat.update(raw[nested])
    channels = {}
    for key, (unit, label, aliases) in CHANNELS.items():
        for alias in aliases:
            v = flat.get(alias)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                channels[key] = {"value": v, "unit": unit, "label": label, "status": status(key, v)}
                break
    return channels


def worst(channels):
    order = {"green": 0, "amber": 1, "red": 2}
    return max((c["status"] for c in channels.values()), key=order.get, default="green")


def sim_message(raw, scenario):
    channels = normalise(raw)
    data = {
        "timestamp": now_iso(),
        "source": "simulation",
        "scenario": scenario,
        "channels": channels,
        "worst": worst(channels),
        "raw": raw,
    }
    for k in PASS_THROUGH:
        if k in raw:
            data[k] = raw[k]
    data["scenario"] = scenario  # the file name wins, so the UI label matches what was clicked
    return {"kind": "sim", "data": data}


def feed_path(data_dir, scenario):
    return Path(data_dir) / f"{FEED_PREFIX}{scenario}.jsonl"


def list_feeds(data_dir):
    return sorted(p.stem[len(FEED_PREFIX):] for p in Path(data_dir).glob(f"{FEED_PREFIX}*.jsonl"))


def load_feed(path):
    lines = []
    for raw in Path(path).read_text(encoding="utf-8-sig", errors="replace").splitlines():
        obj = parse_feed_line(raw)
        if obj is not None:
            lines.append(obj)
    return lines
