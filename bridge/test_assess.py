"""Offline tests for bridge/assess.py (no API key, no network). Run: python bridge/test_assess.py"""
import asyncio
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ.pop("ANTHROPIC_API_KEY", None)

import assess  # noqa: E402
from assess import AssessBody, SAMPLES, assess_body, load_cache, valid  # noqa: E402

FIELDS = {"crew_id", "mission", "tier", "who_acts", "summary", "findings", "do_now",
          "message_to_earth", "time_b_s", "source", "made_at"}

GOOD = {
    "summary": "You are tired.",
    "findings": [{"part": "head", "text": "Sleep 4 h."}],
    "do_now": ["Rest"],
    "message_to_earth": "C003 tired.",
}


def run(body, fake=None):
    real = assess.call_model
    if fake is not None:
        assess.call_model = fake
    try:
        return asyncio.run(assess_body(body))
    finally:
        assess.call_model = real


def mars(**kw):
    return AssessBody(mission="mars", tier=2, who_acts="crew_medical_officer", **kw)


class Cache(unittest.TestCase):
    def test_three_scenarios_valid(self):
        cache = load_cache()
        self.assertEqual(set(cache), {"nominal", "hypoxia", "fatigue"})
        for name, answer in cache.items():
            self.assertTrue(valid(answer), name)


class Live(unittest.TestCase):
    def test_live_shape(self):
        async def fake(body):
            return dict(GOOD)
        out = run(mars(), fake)
        self.assertEqual(set(out), FIELDS)
        self.assertEqual(out["source"], "live")

    def test_ai_cannot_change_tier(self):
        async def fake(body):
            return {**GOOD, "tier": 0, "who_acts": "none", "mission": "iss"}
        out = run(mars(), fake)
        self.assertEqual((out["tier"], out["who_acts"], out["mission"]), (2, "crew_medical_officer", "mars"))


class Fallback(unittest.TestCase):
    def test_timeout_uses_cache(self):
        async def slow(body):
            await asyncio.sleep(5)
            return dict(GOOD)
        old = assess.TIMEOUT_S
        assess.TIMEOUT_S = 0.2
        try:
            out = run(mars(), slow)
        finally:
            assess.TIMEOUT_S = old
        self.assertEqual(out["source"], "cache")
        self.assertIn("timeout", out["note"])
        self.assertLess(out["time_b_s"], 2)

    def test_no_key_uses_cache(self):
        out = run(mars())
        self.assertEqual(out["source"], "cache")
        self.assertEqual(out["tier"], 2)

    def test_bad_answer_uses_cache(self):
        async def bad(body):
            return {"summary": "x"}
        self.assertEqual(run(mars(), bad)["source"], "cache")

    def test_error_uses_cache(self):
        async def boom(body):
            raise ConnectionError("reset")
        self.assertEqual(run(mars(), boom)["source"], "cache")

    def test_pick_scenario(self):
        self.assertEqual(assess.pick_scenario(AssessBody(mission="iss", tier=0)), "nominal")
        self.assertEqual(assess.pick_scenario(mars()), "fatigue")
        self.assertEqual(assess.pick_scenario(mars(cabin_air={"value": 620, "baseline": 300})), "hypoxia")
        self.assertEqual(assess.pick_scenario(SAMPLES["hypoxia"]), "hypoxia")

    def test_use_cache_switch(self):
        async def never(body):
            raise AssertionError("live call made")
        out = run(mars(use_cache=True), never)
        self.assertEqual(out["source"], "cache")


class Endpoint(unittest.TestCase):
    def test_post_assess(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        app.include_router(assess.router)
        client = TestClient(app)
        r = client.post("/assess", json={"mission": "mars", "tier": 2, "who_acts": "crew_medical_officer"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), FIELDS | {"note"})
        self.assertEqual(client.post("/assess", json={"mission": "venus", "tier": 2}).status_code, 422)
        self.assertEqual(client.post("/assess", json={"mission": "mars", "tier": 7}).status_code, 422)


if __name__ == "__main__":
    unittest.main(verbosity=2)
