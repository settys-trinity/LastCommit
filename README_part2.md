## Person 2: OSDR and thresholds

**What worked**
- Both Inspiration4 clinical files (OSD-575 CMP, OSD-569 CBC) download and parse with pandas.
- 48/48 pre-flight rows in `data/raw/*_extract.csv` match NASA's rows exactly (checked 2026-11-14). The SHA-256 of both full files is recorded in `baselines.json`.
- `baselines.json` (C001-C004: glucose, calcium, WBC, haemoglobin), `osdr_readings.json` (same draws as `reading` objects), `knowledge.json` v0.2 (5 indicators plus `lapses`).
- `python data/validate.py` checks all of it against the schemas. `python data/score_reference.py` runs 24 tests of the scoring rules.

**What failed / watch**
- `fetch_osdr.py` ran on 2026-11-14 and downloaded both full files; checksums match. `baselines.json` is now built from the full files (same numbers as the extracts). If NASA's URL breaks, save the files into `data/raw/` by hand.
- C003 L-92 CBC columns are shifted in NASA's file (platelets 12.9, MPV 330). Excluded. C003 CBC uses male reference ranges.
- R+45 glucose is 36-44 mg/dL for 3 of 4 crew. Unexplained; not used.
- 24 knowledge.json fields are UNSOURCED (list: `python data/validate.py`). Mood, sway, min spreads and action text are the biggest gaps. High-glucose red limit (250) is a placeholder.

**Rebuild:** `python data/fetch_osdr.py && python data/build_baselines.py && python data/validate.py`

**Needs a team decision:** see "Design choices to confirm" in `docs/knowledge_schema.md` (bad-direction z instead of |z|; red without z; sleep red = 3 nights at 6 h or less).
