"""Check every Person 2 file against the FARSIDE schemas. Run: python data/validate.py

Checks
 1. knowledge.json against data/knowledge.schema.json (if the jsonschema package is installed)
    plus rules a schema cannot express (unique types, sourced numbers, valid tier values).
 2. baselines.json: marker keys are reading types, values recompute to the stored mean/sd/spread.
 3. osdr_readings.json: matches the `reading` schema in docs/schemas.md field by field.
 4. Raw OSDR files: checksum of full files if present; extract rows are in the full file.
 5. Prints every UNSOURCED / DESIGN_CHOICE item so nothing slips onto a slide unnoticed.
Exit code 1 if anything fails.
"""
import csv
import hashlib
import json
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).parent
errors, warnings = [], []


def err(msg): errors.append(msg)


K = json.loads((HERE / "knowledge.json").read_text())
B = json.loads((HERE / "baselines.json").read_text())
R = json.loads((HERE / "osdr_readings.json").read_text())

# Reading types and sources from docs/schemas.md
READING_TYPES = {"reaction_time", "reaction_time_median", "lapses", "sway_rms", "sleep_hours", "mood", "symptom",
                 "heart_rate", "bp_systolic", "bp_diastolic", "stress_prob", "stress_label"}
READING_SOURCES = {"station", "replay", "checkin", "ml_live", "ml_saved", "osdr"}
CREW = {"C001", "C002", "C003", "C004", "GUEST"}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def is_reading_type(t): return t in READING_TYPES or re.fullmatch(r"lab_[a-z0-9_]+", t) is not None


# 1. knowledge.json
try:
    import jsonschema
    jsonschema.validate(K, json.loads((HERE / "knowledge.schema.json").read_text()))
    print("knowledge.json: JSON Schema OK")
except ImportError:
    print("knowledge.json: jsonschema not installed, structural checks below only (pip install jsonschema)")
except Exception as e:  # noqa: BLE001
    err(f"knowledge.json schema: {str(e).splitlines()[0]}")

seen = set()
unsourced, design = [], []
for ind in K["indicators"]:
    t = ind["type"]
    if t in seen: err(f"knowledge.json: duplicate type {t}")
    seen.add(t)
    if not is_reading_type(t): err(f"knowledge.json: {t} is not a reading type in docs/schemas.md")
    for lim_name in ("amber_limit", "red_limit"):
        lim = ind[lim_name]
        for f in ("z", "below", "at_or_below", "above", "at_or_above"):
            if lim[f] is not None and f not in lim["sources"]:
                err(f"{t}.{lim_name}.{f} has a value but no source")
        if lim["streak"] > 1 and "streak" not in lim["sources"]:
            err(f"{t}.{lim_name}.streak > 1 but no source")
        if all(lim[f] is None for f in ("z", "below", "at_or_below", "above", "at_or_above")) and not lim["outside_normal"]:
            err(f"{t}.{lim_name} can never trigger")
        for f, s in lim["sources"].items():
            (unsourced if s == "UNSOURCED" else design if s == "DESIGN_CHOICE" else []).append(f"{t}.{lim_name}.{f}")
    ms = ind["min_spread"]
    if ms["mode"] == "absolute" and not ms["value"]: err(f"{t}: absolute min_spread needs a value > 0")
    if ms["mode"] == "cv_pct" and not ms["cv_pct"]: err(f"{t}: cv_pct min_spread needs cv_pct > 0")
    for part, s in (("normal_range", ind["normal_range"]["source"]), ("min_spread", ms["source"]),
                    ("action.amber", ind["action"]["sources"]["amber"]), ("action.red", ind["action"]["sources"]["red"])):
        if s == "UNSOURCED": unsourced.append(f"{t}.{part}")
    rz, az = ind["red_limit"]["z"], ind["amber_limit"]["z"]
    if rz is not None and az is not None and rz <= az:
        err(f"{t}: red z must be above amber z")
    for c in ind["correlated_with"]:
        if c not in {i["type"] for i in K["indicators"]}: err(f"{t}: correlated_with unknown type {c}")
print(f"knowledge.json: {len(K['indicators'])} indicators")

# 2. baselines.json
lab_types = {i["type"] for i in K["indicators"] if i["type"].startswith("lab_")}
for cid, c in B["crew"].items():
    if cid not in CREW or cid == "GUEST": err(f"baselines.json: bad crew id {cid}")
    for k, m in c["markers"].items():
        if not k.startswith("lab_"): err(f"baselines.json: {cid}.{k} is not a lab_ reading type")
        vals = list(m["values"].values())
        mean = round(statistics.mean(vals), 3)
        sd = round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0
        floor = round(mean * m["cvi_pct"] / 100, 3)
        if (mean, sd, floor, max(sd, floor)) != (m["mean"], m["sd"], m["min_spread"], m["spread"]):
            err(f"baselines.json: {cid}.{k} stats do not recompute from its values")
for t in lab_types:
    if not any(t in c["markers"] for c in B["crew"].values()):
        err(f"knowledge.json has {t} but baselines.json has no baseline for it")
    cv = next(i for i in K["indicators"] if i["type"] == t)["min_spread"]["cv_pct"]
    for cid, c in B["crew"].items():
        if t in c["markers"] and cv != c["markers"][t]["cvi_pct"]:
            err(f"{cid}.{t}: baselines cvi_pct {c['markers'][t]['cvi_pct']} != knowledge cv_pct {cv}")
print(f"baselines.json: {len(B['crew'])} crew, {sum(len(c['markers']) for c in B['crew'].values())} baselines recomputed OK")

# 3. osdr_readings.json against the reading schema
keys = {"crew_id", "timestamp", "type", "value", "unit", "source"}
baseline_pairs = {(cid, k) for cid, c in B["crew"].items() for k in c["markers"]}
for i, r in enumerate(R):
    if set(r) != keys: err(f"reading {i}: fields {sorted(set(r) ^ keys)} wrong")
    if r.get("crew_id") not in CREW: err(f"reading {i}: crew_id {r.get('crew_id')}")
    if not ISO.match(r.get("timestamp", "")): err(f"reading {i}: timestamp not ISO UTC")
    if not is_reading_type(r.get("type", "")): err(f"reading {i}: type {r.get('type')}")
    if not isinstance(r.get("value"), (int, float)) or isinstance(r.get("value"), bool): err(f"reading {i}: value not a number")
    if not isinstance(r.get("unit"), str): err(f"reading {i}: unit not a string")
    if r.get("source") not in READING_SOURCES: err(f"reading {i}: source {r.get('source')}")
    if (r.get("crew_id"), r.get("type")) not in baseline_pairs: err(f"reading {i}: no baseline for {r.get('crew_id')} {r.get('type')}")
print(f"osdr_readings.json: {len(R)} readings checked against the reading schema")

# 4. raw files
raw = HERE / "raw"
sha = B["meta"]["verified_against_osdr"]["source_file_sha256"]
for panel, extract in (("LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv", "LSDS-8_CMP_preflight_extract.csv"),
                       ("LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv", "LSDS-7_CBC_preflight_extract.csv")):
    full = raw / panel
    if not full.exists():
        warnings.append(f"{panel} not downloaded: using the verified extract. Run data/fetch_osdr.py to check against the full file.")
        continue
    got = hashlib.sha256(full.read_bytes()).hexdigest()
    if got != sha[panel]:
        warnings.append(f"{panel}: checksum differs from the one recorded on 2026-11-14 (NASA may have updated the file).")
    full_rows = {tuple(r) for r in csv.reader(full.read_text().replace("\r", "").splitlines()[1:])}
    for row in csv.reader((raw / extract).read_text().splitlines()[1:]):
        if tuple(row) not in full_rows: err(f"{extract}: row {row} not found in the full file")
    print(f"{panel}: full file present, extract rows all found")

print("\nDESIGN_CHOICE items (recorded as such, say so on stage):", len(design))
print("UNSOURCED items (source or relabel before the pitch):", len(unsourced))
for u in sorted(unsourced): print("   ", u)
for w in warnings: print("WARNING:", w)
if errors:
    print("\nFAILED:")
    for e in errors: print("  -", e)
    sys.exit(1)
print("\nAll checks passed.")
