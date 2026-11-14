"""Build data/baselines.json and data/osdr_readings.json from the NASA OSDR Inspiration4 clinical files.

Uses the full OSDR files in data/raw/ if fetch_osdr.py has been run, otherwise the
pre-flight extracts committed in data/raw/ (checked row-for-row against NASA, see
meta.verified_against_osdr in baselines.json).

Baseline = the three pre-flight draws (L-92, L-44, L-3) per crew member.
spread   = max(sample SD, minimum spread), minimum spread = CVI% x personal mean.
CVI      = within-subject biological variation, 2014 Ricos/Westgard database
           (https://mail.westgard.com/biodatabase1.htm), now maintained by EFLM
           (https://biologicalvariation.eu/).
"""
import json
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "raw"
PREFLIGHT = ["L-92", "L-44", "L-3"]

# Inspiration4 launch and return (OSDR mission page: 09/16/2021 to 09/18/2021).
# OSDR gives draws as days relative to these, with no clock time, so readings use 00:00:00Z.
LAUNCH, RETURN = date(2021, 9, 16), date(2021, 9, 18)


def timepoint_to_iso(tp: str) -> str:
    day = LAUNCH - timedelta(days=int(tp[2:])) if tp.startswith("L-") else RETURN + timedelta(days=int(tp[2:]))
    return f"{day.isoformat()}T00:00:00Z"


# analyte name in file -> (reading type from docs/schemas.md, CVI %)
MARKERS = {
    "CMP": {"GLUCOSE": ("lab_glucose", 5.6), "CALCIUM": ("lab_calcium", 2.1)},
    "CBC": {"WHITE BLOOD CELL COUNT": ("lab_wbc", 11.4), "HEMOGLOBIN": ("lab_hemoglobin", 2.85)},
}

SOURCES = {
    "CMP": {"full": "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv",
            "extract": "LSDS-8_CMP_preflight_extract.csv", "study": "OSD-575", "time_col": "timepoint"},
    "CBC": {"full": "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv",
            "extract": "LSDS-7_CBC_preflight_extract.csv", "study": "OSD-569", "time_col": "TEST_DATE"},
}

# SHA-256 of the files as downloaded from NASA OSDR on 2026-11-14 (checked in the browser).
OSDR_SHA256 = {
    "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv":
        "dab247eb794edab59aaaa683c85fd1f2dbf4ae3684872739338e10ead4192a0c",
    "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv":
        "10a878b009eb2ea11a13fe92ad698098858639e8ed02f5ee849431313b9457d3",
}

# Known problem in the submitted OSD-569 file: C003's L-92 CBC rows are shifted by one
# column from MCHC onward (MCH missing), e.g. PLATELET COUNT = 12.9, MPV = 330.
# Values up to MCV are before the shift and correct. Anything after it is dropped.
SHIFTED = {("CBC", "C003", "L-92")}
SAFE_BEFORE_SHIFT = {"WHITE BLOOD CELL COUNT", "RED BLOOD CELL COUNT", "HEMOGLOBIN", "HEMATOCRIT", "MCV"}


def load(panel: str):
    src = SOURCES[panel]
    path = RAW / src["full"]
    used = "full OSDR file"
    if not path.exists():
        path = RAW / src["extract"]
        used = "pre-flight extract of OSDR file"
    df = pd.read_csv(path)
    df = df.rename(columns={src["time_col"]: "timepoint"})
    for c in ("VALUE", "RANGE_MIN", "RANGE_MAX"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df[df["timepoint"].isin(PREFLIGHT)].dropna(subset=["VALUE"])
    bad = df.apply(lambda r: (panel, r["SUBJECT_ID"], r["timepoint"]) in SHIFTED
                   and r["ANALYTE"] not in SAFE_BEFORE_SHIFT, axis=1)
    df = df[~bad]
    print(f"{panel}: {path.name} ({used}), {len(df)} pre-flight rows, crew {sorted(df.SUBJECT_ID.unique())}")
    return df, f"{used}: {src['study']} / {src['full']}"


def main():
    crew: dict = {}
    provenance = {}
    readings = []
    for panel, markers in MARKERS.items():
        df, provenance[panel] = load(panel)
        df = df[df["ANALYTE"].isin(markers)]
        for (cid, analyte), g in df.groupby(["SUBJECT_ID", "ANALYTE"]):
            key, cvi = markers[analyte]
            for _, r in g.iterrows():
                readings.append({"crew_id": cid, "timestamp": timepoint_to_iso(r["timepoint"]),
                                 "type": key, "value": float(r["VALUE"]), "unit": r["UNITS"], "source": "osdr"})
            mean = g["VALUE"].mean()
            sd = g["VALUE"].std(ddof=1) if len(g) > 1 else 0.0
            floor = mean * cvi / 100
            crew.setdefault(cid, {"crew_id": cid, "sex": g["SEX"].iloc[0], "markers": {}})
            crew[cid]["markers"][key] = {
                "analyte": analyte,
                "unit": g["UNITS"].iloc[0],
                "values": {t: float(v) for t, v in zip(g["timepoint"], g["VALUE"])},
                "n": int(len(g)),
                "mean": round(mean, 3),
                "sd": round(sd, 3),
                "cvi_pct": cvi,
                "min_spread": round(floor, 3),
                "spread": round(max(sd, floor), 3),
                "spread_is_floor": bool(floor > sd),
                "ref_range": [float(g["RANGE_MIN"].iloc[0]), float(g["RANGE_MAX"].iloc[0])],
                "source": f"NASA OSDR {SOURCES[panel]['study']}",
            }

    out = {
        "meta": {
            "description": "Per-crew pre-flight baselines from Inspiration4 clinical labs. "
                           "Method demo only: 4 people, 3 pre-flight draws each. Not a medical finding.",
            "crew_ids": "OSDR anonymised IDs. Never show astronaut names.",
            "licence": "OSDR Inspiration4 studies are CC0-1.0 per the study pages (check the page before the sources slide).",
            "baseline_window": PREFLIGHT,
            "spread_rule": "spread = max(sample SD of the pre-flight draws, CVI% x personal mean). SD uses n-1 on 3 points, so it is a rough estimate.",
            "marker_keys": "Reading types from docs/schemas.md (lab_<analyte>).",
            "files": provenance,
            "study_pages": ["https://osdr.nasa.gov/bio/repo/data/studies/OSD-575",
                            "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"],
            "cvi_source": "https://mail.westgard.com/biodatabase1.htm (2014 edition: glucose 5.6, calcium 2.1, leukocytes 11.4, haemoglobin 2.85)",
            "verified_against_osdr": {
                "date": "2026-11-14",
                "method": "All 48 rows in data/raw/*_preflight_extract.csv compared with the rows served by osdr.nasa.gov (in-browser fetch): 48/48 identical.",
                "source_file_sha256": OSDR_SHA256,
            },
            "data_issues": [
                "OSD-569 C003 L-92: CBC columns shifted from MCHC onward; those values are excluded (WBC and haemoglobin sit before the shift).",
                "OSD-569 C003: the CBC file lists male reference ranges for this female crew member. Reference ranges are shown as in the file.",
                "OSD-575 R+45: glucose is 36-44 mg/dL for 3 of 4 crew at the same visit. Not used for baselines. Unexplained: check the OSDR sample metadata before showing it as a spaceflight effect.",
                "Pre-flight glucose varies a lot for C004 (100, 83, 56 mg/dL) and C003 (77, 62, 75), so these baselines are wide. C001 and C002 are tighter.",
            ],
        },
        "crew": dict(sorted(crew.items())),
    }
    (HERE / "baselines.json").write_text(json.dumps(out, indent=2) + "\n")
    readings.sort(key=lambda r: (r["crew_id"], r["timestamp"], r["type"]))
    (HERE / "osdr_readings.json").write_text(json.dumps(readings, indent=1) + "\n")
    print(f"Wrote data/baselines.json and data/osdr_readings.json ({len(readings)} readings)")
    print("\ncrew  marker          mean     sd   floor  spread  (floor used?)")
    for cid, c in out["crew"].items():
        for k, m in c["markers"].items():
            print(f"{cid}  {k:<14} {m['mean']:>7} {m['sd']:>6} {m['min_spread']:>6} {m['spread']:>7}  "
                  f"{'FLOOR' if m['spread_is_floor'] else 'sd'}")


if __name__ == "__main__":
    main()
