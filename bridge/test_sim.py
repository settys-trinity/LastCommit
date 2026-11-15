"""Offline tests for bridge/sim.py (Simulation mode). Run: python bridge/test_sim.py"""
import json
import tempfile
import unittest
from pathlib import Path

import sim

DATA = Path(__file__).resolve().parent.parent / "data"


class Limits(unittest.TestCase):
    def test_boundaries(self):
        cases = [
            ("spo2", 94, "green"), ("spo2", 93, "amber"), ("spo2", 91, "red"),
            ("hr", 72, "green"), ("hr", 111, "amber"), ("hr", 131, "red"), ("hr", 40, "red"),
            ("rr", 14, "green"), ("rr", 21, "amber"), ("rr", 25, "red"),
            ("sbp", 118, "green"), ("sbp", 140, "amber"), ("sbp", 180, "red"), ("sbp", 90, "red"),
            ("rt_ms", 355, "green"), ("rt_ms", 356, "amber"), ("rt_ms", 500, "red"),
            ("co2_ppm", 3949, "green"), ("co2_ppm", 3950, "amber"), ("co2_ppm", 6999, "amber"), ("co2_ppm", 7000, "red"),
        ]
        for key, value, want in cases:
            self.assertEqual(sim.status(key, value), want, (key, value))


class Parse(unittest.TestCase):
    def test_junk_lines_skipped(self):
        self.assertIsNone(sim.parse_feed_line("ets Jun  8 2016 boot..."))
        self.assertIsNone(sim.parse_feed_line('{"spo2": 9'))
        self.assertIsNone(sim.parse_feed_line("[1,2]"))
        self.assertEqual(sim.parse_feed_line(' {"spo2": 97}\r\n'), {"spo2": 97})

    def test_aliases_and_nested(self):
        ch = sim.normalise({"SpO2": 90, "vitals": {"heart_rate": 102}, "temp": 33.1, "mission": "mars"})
        self.assertEqual(ch["spo2"]["status"], "red")
        self.assertEqual(ch["hr"]["value"], 102)
        self.assertEqual(ch["skin_c"]["unit"], "degC")
        self.assertNotIn("mission", ch)

    def test_message_shape(self):
        msg = sim.sim_message({"spo2": 92, "hr": 80, "mission": "mars", "tier": 2}, "hypoxia")
        self.assertEqual(msg["kind"], "sim")
        d = msg["data"]
        self.assertEqual(d["source"], "simulation")
        self.assertEqual(d["scenario"], "hypoxia")
        self.assertEqual(d["worst"], "amber")
        self.assertEqual(d["mission"], "mars")
        self.assertEqual(d["tier"], 2)
        json.dumps(msg)  # must be JSON-serialisable for the WebSocket


class WokwiSketch(unittest.TestCase):
    # Real line format from firmware/wokwi/sketch.ino (v2), shortened
    LINE = ('{"t":"vitals","scenario":"Hypoxia","mission":"Mars","round_trip_s":2640.0,"spo2":89.5,"hr":104,'
            '"rr":22,"sys":118,"skin_c":33.4,"co2_ppm":2600,"reaction_ms":420,"tilt_deg":1.2,"tier":2,'
            '"acts":"crew_medical_officer","worst":"SpO2","source":"preset","status":[2,0,1,0,0,0,0,1]}')

    def test_all_8_channels(self):
        ch = sim.normalise(sim.parse_feed_line(self.LINE))
        self.assertEqual(len(ch), 8)
        self.assertEqual(ch["sbp"]["value"], 118)
        self.assertEqual(ch["rt_ms"]["value"], 420)

    def test_event_lines_skipped(self):
        for line in ('{"t":"decision","n":3,"tier":2}', '{"t":"packet_tx","seq":1}', '{"t":"ground_reply","seq":1}'):
            self.assertIsNone(sim.parse_feed_line(line))

    def test_pass_through(self):
        d = sim.sim_message(sim.parse_feed_line(self.LINE), "hypoxia")["data"]
        self.assertEqual(d["acts"], "crew_medical_officer")
        self.assertEqual(d["round_trip_s"], 2640.0)
        self.assertEqual(d["source"], "simulation")
        self.assertEqual(d["worst"], "red")  # our grading of the channels, not the sketch's channel name


class Feeds(unittest.TestCase):
    def test_load_skips_noise(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = sim.feed_path(tmp, "x")
            p.write_text('boot\n{"spo2":97}\n\n{"spo2":96}\nrst:0x1\n', encoding="utf-8")
            self.assertEqual(len(sim.load_feed(p)), 2)
            self.assertEqual(sim.list_feeds(tmp), ["x"])

    def test_repo_feeds_cover_8_channels(self):
        feeds = sim.list_feeds(DATA)
        self.assertTrue(feeds, "no data/wokwi_feed_*.jsonl files")
        for name in feeds:
            lines = sim.load_feed(sim.feed_path(DATA, name))
            self.assertGreaterEqual(len(lines), 10, name)
            self.assertEqual(len(sim.normalise(lines[-1])), 8, f"{name}: not all 8 channels found")


if __name__ == "__main__":
    unittest.main(verbosity=2)
