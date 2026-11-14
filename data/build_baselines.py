"""Build data/baselines.json from the OSDR Inspiration4 CBC file (OSD-569, LSDS-7).

Pre-flight = TEST_DATE starting with "L-" (days before launch). Per crew ID and marker:
mean, sample SD when there are 3+ pre-flight samples, else sd null + use_reference_range.
"""
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv"
OUT = HERE / "baselines.json"
SOURCE_URL = (
    "https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download"
    "?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv"
)
VALID_IDS = {"C001", "C002", "C003", "C004"}

df = pd.read_csv(RAW)
assert set(df["SUBJECT_ID"]) <= VALID_IDS, f"unexpected crew IDs {set(df['SUBJECT_ID']) - VALID_IDS}"
df["VALUE"] = pd.to_numeric(df["VALUE"], errors="raise")
pre = df[df["TEST_DATE"].str.startswith("L-")]

baselines = {}
# OSDR's anonymised IDs are kept as-is (file order is C001, C002, C004, C003); SEX is not stored.
for crew_id in sorted(pre["SUBJECT_ID"].unique()):
    markers = {}
    for analyte, g in pre[pre["SUBJECT_ID"] == crew_id].groupby("ANALYTE", sort=True):
        n = len(g)
        entry = {
            "mean": round(float(g["VALUE"].mean()), 4),
            "sd": round(float(g["VALUE"].std(ddof=1)), 4) if n >= 3 else None,
            "n_preflight": n,
            "unit": g["UNITS"].iloc[0],
            "reference_range": [float(g["RANGE_MIN"].iloc[0]), float(g["RANGE_MAX"].iloc[0])],
            "source_url": SOURCE_URL,
        }
        if n < 3:
            entry["use_reference_range"] = True
        markers[analyte] = entry
    baselines[crew_id] = markers

OUT.write_text(json.dumps(baselines, indent=2), encoding="utf-8")

counts = {c: sum(m["sd"] is None for m in v.values()) for c, v in baselines.items()}
print(f"Wrote {OUT.name}: {len(baselines)} crew, {sum(len(v) for v in baselines.values())} markers; sd null per crew: {counts}")
