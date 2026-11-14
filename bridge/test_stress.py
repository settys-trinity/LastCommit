"""Offline tests for bridge/stress.py. Run: python bridge/test_stress.py"""
import asyncio
import json
import sys
import unittest
from pathlib import Path

import stress

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
from check_readings import check  # noqa: E402  (the team's reading validator)

SCENARIO = ROOT / "data" / "scenario_mars_day143.json"


def run_replay(**kw):
    sent = []
    n = asyncio.run(stress.replay_stress(sent.append, interval_s=0, **kw))
    return n, [m["data"] for m in sent]


class Stress(unittest.TestCase):
    def test_available(self):
        self.assertTrue(stress.available())

    def test_scenario_merge_sorted_and_valid(self):
        base = json.loads(SCENARIO.read_text(encoding="utf-8-sig"))
        merged = stress.with_stress(base)
        self.assertGreater(len(merged), len(base))
        stamps = [r["timestamp"] for r in merged]
        self.assertEqual(stamps, sorted(stamps))
        for r in merged:
            self.assertEqual(check(r), [], r)
        # stress feed ends before the STAND-REACT test starts
        last_stress = max(r["timestamp"] for r in merged if r["type"] == "stress_prob")
        first_rt = min(r["timestamp"] for r in merged if r["type"] == "reaction_time")
        self.assertLess(last_stress, first_rt)

    def test_replay_without_mood(self):
        n, readings = run_replay(crew_id="C002", last_n=6)
        self.assertEqual(n, 6)
        self.assertEqual(len(readings), 12)
        for r in readings:
            self.assertEqual(check(r), [], r)
            self.assertEqual(r["crew_id"], "C002")
            self.assertEqual(r["source"], "ml_saved")
        self.assertEqual({r["type"] for r in readings}, {"stress_prob", "stress_label"})

    def test_replay_with_mood_adds_check(self):
        _, readings = run_replay(last_n=8, mood=4)
        last = readings[-1]
        self.assertEqual(last["type"], "stress_mood_check")
        self.assertEqual(check(last), [])
        self.assertEqual(last["value"], "hidden_stress")  # S17 ends stressed, mood 4 says fine

    def test_replay_mood_low_is_consistent(self):
        _, readings = run_replay(last_n=8, mood=2)
        self.assertEqual(readings[-1]["value"], "consistent")


if __name__ == "__main__":
    unittest.main(verbosity=2)
