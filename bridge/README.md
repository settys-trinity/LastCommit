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
