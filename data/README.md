# data

- `test_donki.py`: checks DONKI FLR and SEP on api.nasa.gov, falling back to kauai.ccmc.gsfc.nasa.gov.
- `test_donki_flr.py`: tries FLR variants in order to find one that works.
- `cache_donki.py`: fetches SEP events from api.nasa.gov and writes `donki_cache.json`.
- `donki_cache.json`: 14 cached DONKI SEP events for May 2024, with `cached`, `source_url` (no API key), `fetched_at` and `window`; the mock bridge streams the first one.
- `scenario_mars_day143.json`: demo readings for crew C003, source `replay` (`docs/schemas.md` reading format). Mission day 143 is 2026-11-15; the three sleep readings fall on the mornings of days 141 to 143 (2026-11-13 to 2026-11-15).
- `raw/LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv`: Inspiration4 complete blood count from NASA OSDR study OSD-569 (anonymised crew IDs C001 to C004, 7 timepoints each: L-92, L-44, L-3, R+1, R+45, R+82, R+194).
- `build_baselines.py`: turns the CBC file into `baselines.json` (pre-flight = `L-` dates). OSDR's crew IDs are kept; sex is not stored.
- `baselines.json`: per crew ID and marker, pre-flight `mean`, `sd` (3+ samples, else `null` with `use_reference_range: true`), `n_preflight`, `unit`, `reference_range` and `source_url`.
- `check_readings.py`: validates a readings file against the schema and sort order (`python data\check_readings.py [file]`).

The DONKI scripts read `NASA_API_KEY` from `.env` in the repo root. Run any script with `.venv\Scripts\python.exe data\<script>.py`.

## Status

- **Worked:** DONKI SEP on api.nasa.gov (cached in `donki_cache.json`), the Mars day 143 scenario (passes `check_readings.py`), and the mock stream in `bridge/`.
- **Failed or unsourced:** DONKI FLR is unreachable (see FLR status); the scenario values are invented demo numbers, not measurements, and the sway unit `g` and lapse threshold are not yet confirmed (`docs/schemas.md` open questions).

## FLR status

As of 2026-11-14, DONKI FLR (solar flares) is unreachable from our network. SEP (solar particle events) works on api.nasa.gov (HTTP 200, 14 events for May 2024).

Attempts in `test_donki_flr.py`, all failed:

| # | Attempt | Result |
|---|---------|--------|
| 1 | api.nasa.gov FLR, our key, no dates | HTTP 404 |
| 2 | api.nasa.gov FLR, 2024-05-01 to 2024-05-31, `DEMO_KEY` | HTTP 429 (DEMO_KEY rate limit) |
| 3 | api.nasa.gov FLR, our key, 2024-05-10 to 2024-05-17 | HTTP 404 |
| 4 | kauai.ccmc.gsfc.nasa.gov FLR over https, `User-Agent: Mozilla/5.0`, 3 retries 3 s apart: no dates, May 2024, 2024-05-10 to 17 | Connection reset each time |
| 5 | kauai.ccmc.gsfc.nasa.gov FLR over plain http, May 2024 | Connection reset |

The 404 comes from NASA's DONKI service behind the api.nasa.gov gateway, so our key is not the cause. The kauai host resets every connection from this network, while other NASA hosts answer.

**Decision:** the project uses SEP only for the cached demo data. FLR is not used.

## Cached DONKI event

`donki_cache.json` holds the 14 DONKI SEP events from 2024-05-01 to 2024-05-31, fetched 2026-11-14T02:19:02Z from `https://api.nasa.gov/DONKI/SEP?startDate=2024-05-01&endDate=2024-05-31` (API key stripped).

The first event is `2024-05-09T13:59:00-SEP-001`, a solar particle event on **9 May 2024 at 13:59 UTC**. Show this data on screen labelled "cached".
