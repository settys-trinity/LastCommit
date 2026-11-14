# data

- `test_donki.py`: checks DONKI FLR and SEP on api.nasa.gov, falling back to kauai.ccmc.gsfc.nasa.gov.
- `test_donki_flr.py`: tries FLR variants in order to find one that works.

Both read `NASA_API_KEY` from `.env` in the repo root. Run with `.venv\Scripts\python.exe data\<script>.py`.

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
