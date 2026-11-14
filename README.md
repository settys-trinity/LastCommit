# LastCommit: FARSIDE

FARSIDE is a crew health station where the communication delay to Earth decides who acts on a health finding. The same reading means "message Earth" on the ISS and "act now" on Mars.

Built for HackAthlone 2026 (NASA Space Apps Challenge). This repo holds Part 1a (engine and data) so far: the shared schemas, the NASA data, a demo scenario and a mock bridge stream for the UI team.

## What's done

| Area | Status | Where |
|------|--------|-------|
| `reading` schema | Done | `docs/schemas.md` section 1 |
| `knowledge.json` schema | Done, example values UNSOURCED | `docs/schemas.md` section 2 |
| Serial format (Arduino to laptop) | Done | `docs/schemas.md` section 3 |
| WebSocket stream envelope | Done | `docs/schemas.md`, "Stream envelope" |
| NASA DONKI solar particle events (SEP) | Cached, 14 events for May 2024 | `data/donki_cache.json` |
| NASA DONKI solar flares (FLR) | Unreachable, dropped | `data/README.md`, "FLR status" |
| NASA OSDR Inspiration4 blood count baselines | Done, 4 crew, 79 markers | `data/baselines.json` |
| Mars day 143 demo scenario | Done, 10 readings for C003 | `data/scenario_mars_day143.json` |
| Mock bridge (WebSocket) | Done | `bridge/mock_server.py` |
| Decisions | Mars "crew acts now" shows the amber LED (Tier 2) | `docs/decisions.md` |

## Repo layout

```
docs/
  schemas.md        reading, knowledge.json, serial format, safe wait, stream envelope
  decisions.md      decisions the team has made
data/
  README.md         one line per file, FLR status, cached event, status
  raw/              raw NASA OSDR download (Inspiration4 CBC, OSD-569)
  baselines.json    pre-flight mean and SD per crew ID and blood marker
  donki_cache.json  cached DONKI SEP events
  scenario_mars_day143.json   demo readings
  *.py              fetch, build and check scripts
bridge/
  README.md         how to run the mock bridge
  mock_server.py    FastAPI server: /health and /ws/stream
  test_client.py    prints the first 4 stream messages
```

## Setup (Windows PowerShell)

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
pip install -r bridge\requirements.txt
pip install requests python-dotenv pandas   # for the data scripts
```

The DONKI scripts need a NASA API key (free at https://api.nasa.gov) in a `.env` file in the repo root:

```
NASA_API_KEY=your_key_here
```

`.env` is gitignored. Never commit it.

## Run

| Task | Command |
|------|---------|
| Start the mock bridge | `cd bridge; uvicorn mock_server:app --port 8000` |
| Stream URL | `ws://localhost:8000/ws/stream?speed=5` (`speed` divides the 2 s gap between readings) |
| Test the stream | `python bridge\test_client.py` (server must be running) |
| Check the demo scenario | `python data\check_readings.py` (prints `OK: 10 readings`) |
| Rebuild baselines | `python data\build_baselines.py` |
| Refresh the DONKI cache | `python data\cache_donki.py` |
| Check DONKI endpoints | `python data\test_donki.py` |

## Data sources

- **NASA DONKI** (solar particle events): https://api.nasa.gov/DONKI/SEP. Shown on screen as "cached".
- **NASA OSDR Inspiration4** (complete blood count, study OSD-569): https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv. Uses OSDR's anonymised crew IDs C001 to C004; no names are stored.

## Open items

- Placeholders still UNSOURCED: `knowledge.json` example values, the 10 minute safe wait (Tier 2 vs Tier 3), the lapse threshold.
- Owners for Parts 1a, 1b, 2 and 3 are not assigned yet.
- Still to build: `knowledge.json` v1, the rules engine, the triage router, the app, the firmware and the stress model.

## Workflow

Work happens on branch `Shreya`; pull requests go into `main`.
