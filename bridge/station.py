"""Station logic for the FARSIDE serial bridge. Standard library only, so it is easy to test.

- parse_line: one line from the Uno -> dict, or None for anything that is not a station message
- Run: turns one STAND-REACT run's messages into `reading` objects (docs/schemas.md section 1)
- FakeUno: stands in for the Arduino when there is no hardware (same interface as pyserial)
"""
import json
import queue
import random
import statistics
import threading
import time
from datetime import datetime, timezone

CREW_IDS = {"C001", "C002", "C003", "C004", "GUEST"}

# A reaction slower than this counts as a lapse. 355 ms is the lapse threshold of the
# 3-minute brief PVT (PVT-B): Basner, Mollicone & Dinges (2011), Acta Astronautica 69:949-959,
# https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786 . Decision D7: must equal
# params.lapse_threshold_ms in data/knowledge.json.
LAPSE_MS = 355

MSG_MAX = 32  # LCD is 16 x 2


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def reading(crew_id, type_, value, unit, source="station", timestamp=None):
    return {
        "crew_id": crew_id,
        "timestamp": timestamp or now_iso(),
        "type": type_,
        "value": value,
        "unit": unit,
        "source": source,
    }


def parse_line(line):
    """Return the station message as a dict, or None (boot noise, partial lines, junk)."""
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        msg = json.loads(line)
    except ValueError:
        return None
    if isinstance(msg, dict) and isinstance(msg.get("t"), str):
        return msg
    return None


def clean_msg(text):
    """LCD-safe text: printable ASCII only, at most 32 characters."""
    text = "".join(c for c in str(text) if 32 <= ord(c) < 127)
    return text[:MSG_MAX]


def cabin_air(raw, timestamp=None):
    """Stream message for one gas-sensor sample. Cabin air is an environment hazard, like
    DONKI events, so it is its own stream kind, not a crew `reading`. The raw value is an
    uncalibrated 0..1023 index: compare it with the session's own baseline, never as ppm."""
    return {"kind": "cabin_air",
            "data": {"timestamp": timestamp or now_iso(), "value": int(raw), "unit": "adc_0_1023",
                     "source": "station"}}


class Run:
    """One STAND-REACT run for one crew member."""

    def __init__(self, crew_id):
        self.crew_id = crew_id
        self.rts = []
        self.readings = []
        self.done = False
        self.started = time.monotonic()

    def handle(self, msg):
        """Feed one parsed station message. Returns the new readings it produced."""
        t = msg.get("t")
        out = []
        if t == "rt":
            ms = int(msg["ms"])
            self.rts.append(ms)
            out.append(reading(self.crew_id, "reaction_time", ms, "ms"))
        elif t == "sway":
            out.append(reading(self.crew_id, "sway_rms", round(float(msg["rms"]), 4), "g"))
        elif t == "done":
            self.done = True
            if self.rts:
                median = statistics.median(self.rts)
                out.append(reading(self.crew_id, "reaction_time_median", round(median, 1), "ms"))
                lapses = sum(1 for ms in self.rts if ms > LAPSE_MS)
                out.append(reading(self.crew_id, "lapses", lapses, "count"))
        self.readings.extend(out)
        return out


class FakeUno:
    """Simulated station with the pyserial calls the bridge uses: write, readline, close.

    speed > 1 runs the test faster (used by the unit tests).
    """

    def __init__(self, seed=None, speed=1.0):
        self._q = queue.Queue()
        self._rng = random.Random(seed)
        self._running = False
        self.speed = speed
        self.sent = []  # every line the bridge wrote, for tests
        self._put('{"t":"ready"}')

    def _put(self, line):
        self._q.put((line + "\n").encode("ascii"))

    def write(self, data):
        for line in data.decode("ascii").splitlines():
            self.sent.append(line)
            if line.startswith("START") and not self._running:
                seconds = int(line.split(":", 1)[1]) if ":" in line else 60
                self._running = True
                threading.Thread(target=self._run, args=(seconds,), daemon=True).start()
            elif line == "PING":
                self._put('{"t":"ready"}')
            elif line == "BUTTON":  # test hook: pretend the start button was pressed
                self._put('{"t":"button"}')
        return len(data)

    def _run(self, seconds):
        self._put('{"t":"start"}')
        end = time.monotonic() + seconds / self.speed
        while True:
            time.sleep(self._rng.uniform(1.5, 4.0) / self.speed)
            if time.monotonic() >= end:
                break
            rt = max(150, int(self._rng.gauss(330, 60)))
            if self._rng.random() < 0.1:
                rt = self._rng.randint(520, 900)  # an occasional lapse
            self._put(json.dumps({"t": "rt", "ms": rt}, separators=(",", ":")))
        self._put('{"t":"sway","rms":%.4f}' % self._rng.uniform(0.02, 0.06))
        self._put('{"t":"air","raw":%d}' % self._rng.randint(180, 260))
        self._put('{"t":"done"}')
        self._running = False

    def readline(self):
        try:
            return self._q.get(timeout=0.5)
        except queue.Empty:
            return b""

    def close(self):
        pass
