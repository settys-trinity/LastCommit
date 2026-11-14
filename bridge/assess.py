"""FARSIDE on-board AI assessment: POST /assess.

Owner: Om. Plugged into the bridge by Daksh with two lines in make_app():
    from assess import router as assess_router
    app.include_router(assess_router)

What it does
    The app sends the engine result (tier, who acts), the latest crew readings,
    the questionnaire answers and the cabin air index. Claude writes a plain-language
    assessment as JSON. Time B = seconds from request to answer on board.

Rules (never break)
    - The AI never changes the tier. The engine's tier and who_acts are written
      back over whatever the model returns.
    - Plain language, JSON only.
    - No answer in 15 s, no API key, or a bad answer -> the cached answer for the
      closest scenario (nominal, hypoxia, fatigue), with "source": "cache".
    - The API key lives only in .env (ANTHROPIC_API_KEY). Never commit .env.

Record the cache (needs the key):  python bridge/assess.py --record
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

try:  # .env next to the repo root or the bridge folder
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:  # dotenv is optional; a real env var works too
    pass

MODEL = "claude-opus-5-5"
TIMEOUT_S = 15.0
CACHE_PATH = Path(__file__).resolve().parent / "assess_cache.json"
PARTS = ["head", "chest", "arm", "legs", "air"]
SCENARIOS = ["nominal", "hypoxia", "fatigue"]
REQUIRED = ["summary", "findings", "do_now", "message_to_earth"]

router = APIRouter()


# ---------- request ----------

class Questionnaire(BaseModel):
    mood: Optional[int] = None
    sleep_h: Optional[float] = None
    stress: Optional[int] = None
    focus: Optional[int] = None
    symptom: Optional[str] = None


class CabinAir(BaseModel):
    value: float                      # uncalibrated index 0-1023, not ppm
    baseline: Optional[float] = None  # session's own baseline (e.g. first-minute mean)


class AssessBody(BaseModel):
    crew_id: str = "C003"
    mission: Literal["iss", "moon", "mars", "conjunction"]
    tier: int = Field(ge=0, le=3)
    who_acts: str = "none"            # none | crew | crew_medical_officer | flight_surgeon
    readings: list[dict[str, Any]] = Field(default_factory=list)
    engine_findings: list[str] = Field(default_factory=list)
    questionnaire: Optional[Questionnaire] = None
    cabin_air: Optional[CabinAir] = None
    scenario: Optional[Literal["nominal", "hypoxia", "fatigue"]] = None  # cache hint
    use_cache: bool = False           # demo switch: skip the live call


# ---------- prompt ----------

SYSTEM = """You are the on-board medical assistant for FARSIDE, a crew health station on a spacecraft.
You write a short assessment for the astronaut and the crew medical officer.

Rules:
- The tier and who acts are decided by the rules engine. Repeat them; never change, argue with or soften them.
- Plain language a tired non-doctor understands. Short sentences. No jargon, no diagnosis names you cannot support from the data.
- Use only the data given. If something is missing, say so; do not invent values.
- Cabin air is an uncalibrated sensor index (0-1023), not ppm. Talk only about change from its baseline.
- Findings go to body parts: head (sleep, mood, reaction time, focus, stress), chest (heart, breathing), arm (taps, grip), legs (balance, sway), air (cabin air).
- do_now: 1 to 4 concrete actions the crew can take in the next 30 minutes.
- message_to_earth: one or two sentences for the ground team, factual.
- Reply with JSON only, matching the schema."""

SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "part": {"type": "string", "enum": PARTS},
                    "text": {"type": "string"},
                },
                "required": ["part", "text"],
                "additionalProperties": False,
            },
        },
        "do_now": {"type": "array", "items": {"type": "string"}},
        "message_to_earth": {"type": "string"},
    },
    "required": REQUIRED,
    "additionalProperties": False,
}


def user_prompt(body: AssessBody) -> str:
    data = {
        "crew_id": body.crew_id,
        "mission": body.mission,
        "tier_from_engine": body.tier,
        "who_acts_from_engine": body.who_acts,
        "engine_findings": body.engine_findings,
        "readings": body.readings[-40:],  # latest first-class readings only
        "questionnaire": body.questionnaire.model_dump() if body.questionnaire else None,
        "cabin_air": body.cabin_air.model_dump() if body.cabin_air else None,
    }
    return "Assess this crew member now.\n" + json.dumps(data, indent=1)


# ---------- model call (tests replace this) ----------

async def call_model(body: AssessBody) -> dict:
    """One live Claude call. Returns the parsed JSON. Raises on any problem."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("no ANTHROPIC_API_KEY")
    import anthropic

    client = anthropic.AsyncAnthropic(max_retries=0, timeout=TIMEOUT_S)
    response = await client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_prompt(body)}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
    )
    if response.stop_reason != "end_turn":
        raise RuntimeError(f"stop_reason {response.stop_reason}")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


# ---------- cache ----------

def load_cache() -> dict:
    return json.loads(CACHE_PATH.read_text(encoding="utf-8"))


def pick_scenario(body: AssessBody) -> str:
    if body.scenario:
        return body.scenario
    air = body.cabin_air
    if air and air.baseline and air.value > air.baseline * 1.3:
        return "hypoxia"
    return "nominal" if body.tier <= 1 else "fatigue"


def valid(answer: Any) -> bool:
    if not isinstance(answer, dict) or any(k not in answer for k in REQUIRED):
        return False
    if not isinstance(answer["summary"], str) or not isinstance(answer["message_to_earth"], str):
        return False
    if not isinstance(answer["do_now"], list) or not isinstance(answer["findings"], list):
        return False
    return all(isinstance(f, dict) and f.get("part") in PARTS and isinstance(f.get("text"), str)
               for f in answer["findings"])


def finish(body: AssessBody, answer: dict, source: str, started: float, note: str = "") -> dict:
    """Build the reply. The engine's tier and who_acts always win."""
    out = {
        "crew_id": body.crew_id,
        "mission": body.mission,
        "tier": body.tier,
        "who_acts": body.who_acts,
        "summary": answer["summary"],
        "findings": [{"part": f["part"], "text": f["text"]} for f in answer["findings"]],
        "do_now": [str(x) for x in answer["do_now"]][:4],
        "message_to_earth": answer["message_to_earth"],
        "time_b_s": round(time.perf_counter() - started, 2),
        "source": source,
        "made_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if note:
        out["note"] = note
    return out


async def assess_body(body: AssessBody) -> dict:
    started = time.perf_counter()
    note = "use_cache"
    if not body.use_cache:
        try:
            answer = await asyncio.wait_for(call_model(body), timeout=TIMEOUT_S)
            if valid(answer):
                return finish(body, answer, "live", started)
            note = "bad answer"
        except asyncio.TimeoutError:
            note = f"timeout {TIMEOUT_S:g} s"
        except Exception as e:  # network, key, refusal, JSON: the demo must not stop
            note = f"{type(e).__name__}: {e}"[:120]
    cached = load_cache()[pick_scenario(body)]
    return finish(body, cached, "cache", started, note)


@router.post("/assess")
async def assess(body: AssessBody):
    return await assess_body(body)


# ---------- record the 3 cached answers ----------

SAMPLES = {
    "nominal": AssessBody(
        mission="iss", tier=0, who_acts="none", scenario="nominal",
        readings=[
            {"crew_id": "C003", "timestamp": "2026-11-15T07:30:00Z", "type": "sleep_hours", "value": 7.5, "unit": "h", "source": "checkin"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "reaction_time_median", "value": 340, "unit": "ms", "source": "station"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "lapses", "value": 0, "unit": "count", "source": "station"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "sway_rms", "value": 0.049, "unit": "g", "source": "station"},
        ],
        questionnaire=Questionnaire(mood=4, sleep_h=7.5, stress=2, focus=4, symptom=""),
        cabin_air=CabinAir(value=300, baseline=300),
    ),
    "hypoxia": AssessBody(
        mission="mars", tier=2, who_acts="crew_medical_officer", scenario="hypoxia",
        engine_findings=["Cabin air index well above this session's baseline", "Reaction time slower than baseline"],
        readings=[
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "reaction_time_median", "value": 390, "unit": "ms", "source": "station"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "lapses", "value": 3, "unit": "count", "source": "station"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "sway_rms", "value": 0.064, "unit": "g", "source": "station"},
        ],
        questionnaire=Questionnaire(mood=3, sleep_h=6.5, stress=3, focus=2, symptom="headache, dizzy"),
        cabin_air=CabinAir(value=620, baseline=300),
    ),
    "fatigue": AssessBody(
        mission="mars", tier=2, who_acts="crew_medical_officer", scenario="fatigue",
        engine_findings=["Sleep 4.0 h, red", "Reaction time and lapses amber", "Sway amber"],
        readings=[
            {"crew_id": "C003", "timestamp": "2026-11-15T07:30:00Z", "type": "sleep_hours", "value": 4.0, "unit": "h", "source": "replay"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "reaction_time_median", "value": 380, "unit": "ms", "source": "replay"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "lapses", "value": 3, "unit": "count", "source": "replay"},
            {"crew_id": "C003", "timestamp": "2026-11-15T11:42:20Z", "type": "sway_rms", "value": 0.062, "unit": "g", "source": "replay"},
        ],
        questionnaire=Questionnaire(mood=4, sleep_h=4.0, stress=4, focus=2, symptom=""),
        cabin_air=CabinAir(value=305, baseline=300),
    ),
}


async def record() -> None:
    cache = {}
    for name, body in SAMPLES.items():
        started = time.perf_counter()
        answer = await call_model(body)  # raises if the key or network is missing
        if not valid(answer):
            raise SystemExit(f"{name}: model answer failed the shape check")
        cache[name] = {k: answer[k] for k in REQUIRED}
        print(f"{name}: {time.perf_counter() - started:.1f} s")
    CACHE_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {CACHE_PATH}")


if __name__ == "__main__":
    import sys

    if "--record" in sys.argv:
        asyncio.run(record())
    else:
        print(__doc__)
