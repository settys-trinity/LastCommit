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

For a live check-in typed into the app, `<StressMoodPanel>` (`app/src/components/stress/`) works out the check from the stream itself.

## Simulation mode (Wokwi feed replay)

The ideal 8-channel system runs in Wokwi (ESP32). A browser sim cannot reach the laptop's bridge, so we record its serial output and replay it (decision D-G). Logic: `bridge/sim.py`, tests: `python bridge/test_sim.py`.

**Recording a feed (Diksha):** run the Wokwi project on a scenario for 60 s, copy the Serial Monitor output into `data/wokwi_feed_<scenario>.jsonl` (for example `wokwi_feed_hypoxia.jsonl`). Boot noise and partial lines are skipped; only lines that are JSON objects count. The files in the repo now are **placeholders** (`"placeholder": true`) until the real recordings replace them.

**Replay (works with `--port COM5` or `--fake`, alongside the live station):**

```powershell
Invoke-RestMethod http://localhost:8000/sim                         # list feeds + what is running
Invoke-RestMethod http://localhost:8000/sim -Method Post -ContentType "application/json" -Body '{"scenario":"hypoxia"}'
Invoke-RestMethod http://localhost:8000/sim/stop -Method Post        # back to Station mode
```

`POST /sim` body: `scenario` (file name part), `speed` (default 1.0 = one line per second), `loop` (default true).

**Stream message (one per second):**

```json
{"kind":"sim","data":{
  "timestamp":"2026-11-14T23:05:00Z","source":"simulation","scenario":"hypoxia","worst":"red",
  "channels":{
    "spo2":{"value":90,"unit":"%","label":"Blood oxygen","status":"red"},
    "hr":{"value":102,"unit":"bpm","label":"Heart rate","status":"green"}
  },
  "raw":{"...":"the sketch's line as recorded"}}}
```

Channels: `spo2`, `hr`, `rr`, `sbp`, `skin_c`, `tilt_deg`, `co2_ppm`, `rt_ms`. `status` is green / amber / red against the plan's Section 4 limits. `mission`, `tier`, `who_acts` are copied through if the sketch prints them. Like `cabin_air`, a `sim` message is display data for the sensor strip and the astronaut: it is not a crew `reading` and does not go to the rules engine. Tag these values "simulation" on screen.
