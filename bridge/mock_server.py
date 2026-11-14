"""Mock bridge: streams the cached DONKI event and the Mars day 143 scenario over WebSocket.

Run: python -m uvicorn mock_server:app --app-dir bridge --port 8000
"""
import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

DATA = Path(__file__).resolve().parent.parent / "data"
DONKI_CACHE = DATA / "donki_cache.json"
SCENARIO = DATA / "scenario_mars_day143.json"
INTERVAL_S = 2.0
LOOP_PAUSE_S = 5.0

app = FastAPI(title="FARSIDE mock bridge")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))  # -sig: Windows tools may add a BOM


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws/stream")
async def stream(ws: WebSocket, speed: float = Query(1.0, gt=0, le=100)):
    await ws.accept()
    # Read on connect, so edits to the data files apply without a restart.
    solar = load(DONKI_CACHE)["events"][0]
    readings = load(SCENARIO)
    try:
        await ws.send_json({"kind": "solar_event", "data": solar, "cached": True})
        while True:
            for reading in readings:
                await asyncio.sleep(INTERVAL_S / speed)
                await ws.send_json({"kind": "reading", "data": reading})
            await asyncio.sleep(LOOP_PAUSE_S)
    except WebSocketDisconnect:
        pass
