# bridge

Mock bridge for building the UI before the hardware works. It streams the cached DONKI event and the Mars day 143 scenario over a WebSocket. Message format: "Stream envelope" in `docs/schemas.md`.

## Setup (PowerShell, from the repo root)

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
pip install -r bridge\requirements.txt
```

## Start

```powershell
cd bridge
uvicorn mock_server:app --port 8000
```

- Health check: `http://localhost:8000/health` returns `{"ok": true}`.
- WebSocket: `ws://localhost:8000/ws/stream`
- `speed` query param (default `1.0`, must be above 0 and at most 100) divides the 2 s gap between readings, e.g. `ws://localhost:8000/ws/stream?speed=5` sends one every 0.4 s.

The stream sends one `solar_event`, then each reading, then pauses 5 s and loops the readings. CORS is open to all origins.

## Test

With the server running, in a second terminal:

```powershell
python bridge\test_client.py
```

It prints the first 4 messages.

## Stress feed (replayed stress model)

`data/scenario_stress_s17.json` holds the replayed stress model output for C003 (built by `python ml/stress_feed.py`, details in `docs/schemas.md`, section "Stress/mood check"). The mock bridge merges it into the Mars day 143 stream by timestamp, so the app gets `stress_prob`, `stress_label` and one `stress_mood_check` reading before the STAND-REACT readings.

The real bridge (`bridge/serial_bridge.py`) does the same in `POST /scenario`, and `POST /stress` streams the feed live (see `firmware/README.md` section 6). Logic: `bridge/stress.py`, tests: `python bridge/test_stress.py`.

For a live check-in typed into the app, `<StressMoodPanel>` (`web-components/`) works out the check from the stream itself.
