"""Offline tests for bridge/station.py. Run: python bridge/test_station.py"""
import time
import unittest

import sys
import types

from station import LAPSE_MS, FakeUno, Run, cabin_air, clean_msg, parse_line

TYPES_UNITS = {
    "reaction_time": "ms",
    "reaction_time_median": "ms",
    "lapses": "count",
    "sway_rms": "g",
}


class ParseLine(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(parse_line('{"t":"rt","ms":312}\r\n'), {"t": "rt", "ms": 312})

    def test_junk(self):
        for line in ["", "garbage", '{"t":', "[1,2]", '{"ms":3}', "\x00\xff"]:
            self.assertIsNone(parse_line(line), line)


class CleanMsg(unittest.TestCase):
    def test_cut_and_strip(self):
        self.assertEqual(clean_msg("Rest+hydrate"), "Rest+hydrate")
        self.assertEqual(len(clean_msg("x" * 50)), 32)
        self.assertEqual(clean_msg("a\nb\u00e9c"), "abc")


class RunTest(unittest.TestCase):
    def test_full_run(self):
        run = Run("C003")
        out = []
        for ms in [300, 320, 340, 900]:
            out += run.handle({"t": "rt", "ms": ms})
        out += run.handle({"t": "sway", "rms": 0.04123})
        self.assertFalse(run.done)
        out += run.handle({"t": "done"})
        self.assertTrue(run.done)

        by_type = {r["type"]: r for r in out if r["type"] != "reaction_time"}
        self.assertEqual(by_type["reaction_time_median"]["value"], 330.0)
        self.assertEqual(by_type["lapses"]["value"], 1)
        self.assertGreater(900, LAPSE_MS)
        self.assertEqual(by_type["sway_rms"]["value"], 0.0412)
        self.assertEqual(sum(r["type"] == "reaction_time" for r in out), 4)

        for r in out:  # matches the reading schema
            self.assertEqual(set(r), {"crew_id", "timestamp", "type", "value", "unit", "source"})
            self.assertEqual(r["crew_id"], "C003")
            self.assertEqual(r["source"], "station")
            self.assertEqual(r["unit"], TYPES_UNITS[r["type"]])
            self.assertRegex(r["timestamp"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")

    def test_no_taps_no_imu(self):
        run = Run("GUEST")
        self.assertEqual(run.handle({"t": "done"}), [])
        self.assertTrue(run.done)

    def test_status_lines_ignored(self):
        run = Run("C001")
        for t in ["ready", "start", "err"]:
            self.assertEqual(run.handle({"t": t}), [])


class FakeUnoTest(unittest.TestCase):
    def test_run_end_to_end(self):
        uno = FakeUno(seed=1, speed=50)
        self.assertEqual(parse_line(uno.readline().decode()), {"t": "ready"})
        uno.write(b"START:20\n")
        run = Run("C002")
        deadline = time.monotonic() + 10
        while not run.done and time.monotonic() < deadline:
            msg = parse_line(uno.readline().decode())
            if msg:
                run.handle(msg)
        self.assertTrue(run.done)
        types = [r["type"] for r in run.readings]
        self.assertIn("sway_rms", types)
        self.assertIn("reaction_time_median", types)
        self.assertGreaterEqual(types.count("reaction_time"), 3)
        self.assertEqual(uno.sent, ["START:20"])


class LapseThreshold(unittest.TestCase):
    def test_pvt_b_threshold(self):
        self.assertEqual(LAPSE_MS, 355)  # D7, PVT-B (Basner et al. 2011)

    def test_boundary(self):
        run = Run("C001")
        for ms in [354, 355, 356, 2000]:
            run.handle({"t": "rt", "ms": ms})
        out = run.handle({"t": "done"})
        lapses = [r for r in out if r["type"] == "lapses"][0]["value"]
        self.assertEqual(lapses, 2)  # strictly slower than 355 ms: 356 and 2000


class CabinAir(unittest.TestCase):
    def test_message(self):
        m = cabin_air(312)
        self.assertEqual(m["kind"], "cabin_air")
        self.assertEqual(m["data"]["value"], 312)
        self.assertEqual(m["data"]["unit"], "adc_0_1023")


def import_bridge():
    """Import serial_bridge; stub its web libraries if they are not installed."""
    try:
        import fastapi  # noqa: F401
    except ImportError:
        class HTTPException(Exception):
            def __init__(self, status_code, detail=""):
                super().__init__(detail)
                self.status_code = status_code

        stub = lambda name, **attrs: sys.modules.setdefault(name, types.SimpleNamespace(**attrs))
        stub("uvicorn")
        stub("fastapi", FastAPI=object, HTTPException=HTTPException, WebSocket=object,
             WebSocketDisconnect=Exception, Query=lambda *a, **k: None)
        stub("fastapi.middleware")
        stub("fastapi.middleware.cors", CORSMiddleware=object)
        stub("pydantic", BaseModel=object, Field=lambda *a, **k: None)
    import serial_bridge
    return serial_bridge


class BridgeLogic(unittest.TestCase):
    def test_button_starts_armed_run_and_air_is_published(self):
        sb = import_bridge()
        bridge = sb.Bridge(fake=True)
        bridge.open_serial()
        bridge.ser.speed = 50
        published = []
        bridge.publish = published.append
        bridge.armed = ("C004", 20)

        bridge.ser.write(b"BUTTON\n")
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            msg = parse_line(bridge.ser.readline().decode())
            if msg:
                bridge.on_station_msg(msg)
            if bridge.last_run is not None:
                break

        self.assertIn("START:20", bridge.ser.sent)
        self.assertIsNotNone(bridge.last_run)
        self.assertIsNone(bridge.run)
        kinds = [m["kind"] for m in published]
        self.assertIn("cabin_air", kinds)
        crews = {m["data"]["crew_id"] for m in published if m["kind"] == "reading"}
        self.assertEqual(crews, {"C004"})
        types_ = [m["data"]["type"] for m in published if m["kind"] == "reading"]
        self.assertEqual(types_[-2:], ["reaction_time_median", "lapses"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
