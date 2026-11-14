"""FARSIDE serial bridge: Arduino STAND-REACT station <-> WebSocket for the app.

Same port and stream format as bridge/mock_server.py, so the app only switches servers.

Run from the repo root:
    python bridge/serial_bridge.py --port COM5     # real station (close the Arduino Serial Monitor first)
    python bridge/serial_bridge.py --fake          # no hardware: simulated station

Endpoints (all JSON):
    GET  /health                       {"ok", "serial", "connected", "running"}
    WS   /ws/stream                    solar_event first, then {"kind":"reading","data":{...}} per reading
    POST /start    {"crew_id":"C003","duration_s":20}   begin a run (duration 5 to 120 s, default 60)
    POST /tier     {"n":2}             0 off, 1 green, 2 amber, 3 red plus buzzer
    POST /msg      {"text":"Rest+hydrate"}              LCD text, cut to 32 characters
    POST /replay                       re-send the last run's readings with source "replay"
    POST /scenario                     send the Mars day 143 scenario readings once
"""
import argparse
import asyncio
import json
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from station import CREW_IDS, FakeUno, Run, clean_msg, parse_line

DATA = Path(__file__).resolve().parent.parent / "data"
DONKI_CACHE = DATA / "donki_cache.json"
SCENARIO = DATA / "scenario_mars_day143.json"
BAUD = 115200


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))  # -sig: Windows tools may add a BOM


class Bridge:
    def __init__(self, port=None, fake=False):
        self.port = port
        self.fake = fake
        self.ser = None
        self.connected = False
        self.write_lock = threading.Lock()
        self.clients = set()
        self.run = None
        self.last_run = None
        self.loop = None
        self.outbox = None

    # ---- serial side (background thread) ----
    def open_serial(self):
        if self.fake:
            self.ser = FakeUno()
        else:
            import serial  # pyserial

            self.ser = serial.Serial(self.port, BAUD, timeout=0.5)
            time.sleep(2)  # the Uno resets when the port opens
        self.connected = True
        print(f"[bridge] station connected on {self.label}")

    @property
    def label(self):
        return "fake" if self.fake else self.port

    def reader(self):
        while True:
            try:
                if not self.connected:
                    self.open_serial()
                raw = self.ser.readline()
            except Exception as exc:  # unplugged, wrong port, port busy
                if self.connected:
                    print(f"[bridge] serial error: {exc}. Retrying every 2 s.")
                self.connected = False
                try:
                    if self.ser:
                        self.ser.close()
                except Exception:
                    pass
                time.sleep(2)
                continue
            if not raw:
                continue
            msg = parse_line(raw.decode("ascii", errors="replace"))
            if msg is not None:
                self.loop.call_soon_threadsafe(self.on_station_msg, msg)

    def send_serial(self, line):
        if not self.connected:
            raise HTTPException(503, f"station not connected on {self.label}")
        with self.write_lock:
            self.ser.write((line + "\n").encode("ascii"))

    # ---- app side (event loop) ----
    def on_station_msg(self, msg):
        t = msg["t"]
        if t in ("ready", "start", "err"):
            print(f"[bridge] station: {json.dumps(msg)}")
        if self.run is None:
            return
        for r in self.run.handle(msg):
            self.publish({"kind": "reading", "data": r})
        if self.run.done:
            self.last_run, self.run = self.run, None

    def publish(self, message):
        self.outbox.put_nowait(message)

    async def broadcaster(self):
        while True:
            message = await self.outbox.get()
            for ws in list(self.clients):
                try:
                    await ws.send_json(message)
                except Exception:
                    self.clients.discard(ws)


class StartBody(BaseModel):
    crew_id: str
    duration_s: int = Field(60, ge=5, le=120)


class TierBody(BaseModel):
    n: int = Field(..., ge=0, le=3)


class MsgBody(BaseModel):
    text: str


def make_app(bridge):
    @asynccontextmanager
    async def lifespan(app):
        bridge.loop = asyncio.get_running_loop()
        bridge.outbox = asyncio.Queue()
        task = asyncio.create_task(bridge.broadcaster())
        threading.Thread(target=bridge.reader, daemon=True).start()
        yield
        task.cancel()

    app = FastAPI(title="FARSIDE serial bridge", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    @app.get("/health")
    def health():
        return {"ok": True, "serial": bridge.label, "connected": bridge.connected,
                "running": bridge.run is not None}

    @app.websocket("/ws/stream")
    async def stream(ws: WebSocket):
        await ws.accept()
        solar = load(DONKI_CACHE)["events"][0]
        await ws.send_json({"kind": "solar_event", "data": solar, "cached": True})
        bridge.clients.add(ws)
        try:
            while True:
                await ws.receive_text()  # keeps the socket open; the app sends nothing here
        except WebSocketDisconnect:
            pass
        finally:
            bridge.clients.discard(ws)

    @app.post("/start")
    def start(body: StartBody):
        if body.crew_id not in CREW_IDS:
            raise HTTPException(400, f"crew_id must be one of {sorted(CREW_IDS)}")
        if bridge.run is not None:
            stale = time.monotonic() - bridge.run.started > 130  # longest run plus margin
            if not stale:
                raise HTTPException(409, "a run is already in progress")
        bridge.send_serial("START" if body.duration_s == 60 else f"START:{body.duration_s}")
        bridge.run = Run(body.crew_id)
        return {"ok": True, "crew_id": body.crew_id, "duration_s": body.duration_s}

    @app.post("/tier")
    def tier(body: TierBody):
        bridge.send_serial(f"TIER:{body.n}")
        return {"ok": True}

    @app.post("/msg")
    def msg(body: MsgBody):
        text = clean_msg(body.text)
        bridge.send_serial(f"MSG:{text}")
        return {"ok": True, "sent": text}

    @app.post("/replay")
    def replay():
        if bridge.last_run is None:
            raise HTTPException(404, "no finished run to replay yet")
        for r in bridge.last_run.readings:
            bridge.publish({"kind": "reading", "data": {**r, "source": "replay"}})
        return {"ok": True, "count": len(bridge.last_run.readings)}

    @app.post("/scenario")
    def scenario():
        readings = load(SCENARIO)
        for r in readings:
            bridge.publish({"kind": "reading", "data": r})
        return {"ok": True, "count": len(readings)}

    return app


def main():
    parser = argparse.ArgumentParser(description="FARSIDE serial bridge")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--port", help="serial port, e.g. COM5")
    group.add_argument("--fake", action="store_true", help="simulate the station")
    parser.add_argument("--http-port", type=int, default=8000)
    args = parser.parse_args()

    bridge = Bridge(port=args.port, fake=args.fake)
    uvicorn.run(make_app(bridge), host="127.0.0.1", port=args.http_port)


if __name__ == "__main__":
    main()
