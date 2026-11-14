# FARSIDE schemas

Source: *FARSIDE: Final Project Plan* (14 Nov 2026), section "Three schemas to agree before anyone codes".

## 1. `reading`

> `data/check_readings.py` copies the type, unit and source lists below. Update it whenever they change.

One measurement about one crew member at one moment. Every input to the engine
(station test, daily check-in, stress model, lab baseline) is turned into readings
before the rules engine sees it.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `crew_id` | string | yes | Anonymised OSDR crew ID picked in the app (`C001`–`C004`), or `GUEST`. Never an astronaut's name. |
| `timestamp` | string | yes | ISO 8601 in UTC, e.g. `2026-11-15T11:42:07Z`. Time the value was measured, not time it was received. |
| `type` | string | yes | What was measured. One of the values in [Reading types](#reading-types). |
| `value` | number \| string \| boolean | yes | The measurement. Type depends on `type` (see table). |
| `unit` | string | yes | Unit of `value`. Use `""` for unitless values (counts, labels, flags). |
| `source` | string | yes | Where the value came from. One of the values in [Sources](#sources). |

### Reading types

| `type` | `value` type | `unit` | Produced by | Notes |
|--------|--------------|--------|-------------|-------|
| `reaction_time` | number | `ms` | STAND-REACT, per tap | From serial `{"t":"rt","ms":312}`. |
| `reaction_time_median` | number | `ms` | STAND-REACT, end of test | Median of the run's `reaction_time` readings. |
| `lapses` | number | `count` | STAND-REACT, end of test | Taps slower than the lapse threshold. Threshold still open (Part 3, PVT source). |
| `sway_rms` | number | `g` | STAND-REACT, end of test | From serial `{"t":"sway","rms":0.041}`. RMS of acceleration magnitude minus gravity, ~100 Hz. Firmware sends `g` (section 3). |
| `sleep_hours` | number | `h` | Daily check-in | |
| `mood` | number | `score_1_5` | Daily check-in | Integer 1 to 5. |
| `symptom` | string | `""` | Daily check-in | One reading per reported symptom. |
| `heart_rate` | number | `bpm` | Daily check-in (proposed) | Typed in. Team to confirm. |
| `bp_systolic` | number | `mmHg` | Daily check-in (proposed) | Typed in. Team to confirm. |
| `bp_diastolic` | number | `mmHg` | Daily check-in (proposed) | Typed in. Team to confirm. |
| `stress_prob` | number | `prob_0_1` | Stress classifier | Probability the 60 s window is stress. Replayed held-out WESAD subject, not the person on stage. |
| `stress_label` | string | `""` | Stress classifier | `baseline` or `stress`. One more indicator for the engine; never sets a tier on its own. |
| `lab_<analyte>` | number | per analyte, as in OSDR | Inspiration4 labs | e.g. `lab_hemoglobin` in `g/dL`. Feeds `baselines.json`. |

New types are added here first, then in `knowledge.json` (which keys indicators by `type`).

### Sources

| `source` | Meaning |
|----------|---------|
| `station` | Live Arduino STAND-REACT run via the Python bridge. |
| `replay` | "Replay last test" button or the scenario loader. |
| `checkin` | Daily check-in typed into the app. |
| `ml_live` | Stress model served by the bridge. |
| `ml_saved` | Saved held-out predictions JSON (fallback and Vercel version). |
| `osdr` | NASA OSDR Inspiration4 / SOMA clinical data. |

DONKI solar events are hazards, not body measurements, so they are not readings.
The engine reads them from the DONKI cache directly.

### Examples

```json
{"crew_id":"C003","timestamp":"2026-11-15T11:42:07Z","type":"reaction_time","value":312,"unit":"ms","source":"station"}
{"crew_id":"C003","timestamp":"2026-11-15T11:42:27Z","type":"sway_rms","value":0.041,"unit":"g","source":"station"}
{"crew_id":"C003","timestamp":"2026-11-15T07:30:00Z","type":"sleep_hours","value":4.5,"unit":"h","source":"checkin"}
{"crew_id":"C003","timestamp":"2026-11-15T07:30:00Z","type":"mood","value":2,"unit":"score_1_5","source":"checkin"}
{"crew_id":"C003","timestamp":"2026-11-15T11:41:00Z","type":"stress_label","value":"stress","unit":"","source":"ml_saved"}
```

### TypeScript

```ts
export type ReadingSource = "station" | "replay" | "checkin" | "ml_live" | "ml_saved" | "osdr";

export interface Reading {
  crew_id: string;          // "C001".."C004" | "GUEST"
  timestamp: string;        // ISO 8601 UTC
  type: string;             // see Reading types
  value: number | string | boolean;
  unit: string;             // "" when unitless
  source: ReadingSource;
}
```

### Open questions

- Lapse threshold value and source (Part 3).
- Whether typed heart rate and blood pressure are in scope (proposed, team to confirm).

## 2. `knowledge.json`

The thresholds the rules engine uses. A JSON array, one object per indicator. Indicators are keyed by the reading `type` (section 1).

| Field | Type | Description |
|-------|------|-------------|
| `hazard` | string | Spaceflight hazard the indicator belongs to. |
| `indicator` | string | A reading `type` from section 1, e.g. `sleep_hours`. |
| `unit` | string | Same unit as the reading type. |
| `normal_range` | [number, number] | `[low, high]` normal values. |
| `minimum_spread` | number | Floor for the personal spread in the z-score, in `unit`. The spread is never allowed below this. |
| `amber_limit` | number | \|z\| at or above which the indicator is amber. |
| `red_limit` | number | \|z\| at or above which the indicator is red. |
| `action` | string | Step-by-step crew instruction shown on the triage card. |
| `escalation_tier` | integer 1 to 3 | Tier this indicator escalates to when red (see the plan tier table). |
| `source_url` | string | URL backing the thresholds, or the string `"UNSOURCED"`. |

Rules:

- Score: `z = (value - personal mean) / max(personal spread, minimum_spread)`, per person and per indicator.
- Amber at `|z| >= 2` and red at `|z| >= 3`. These are design choices, not clinical limits, and are recorded as such.
- Every threshold must carry a `source_url` or the string `"UNSOURCED"`. Show `UNSOURCED` values as such on the sources slide.

Example row:

```json
[
  {
    "hazard": "sleep loss and fatigue",
    "indicator": "sleep_hours",
    "unit": "h",
    "normal_range": [7, 9],
    "minimum_spread": 0.5,
    "amber_limit": 2,
    "red_limit": 3,
    "action": "Rest and hydrate. Schedule a full sleep period before the next task.",
    "escalation_tier": 1,
    "source_url": "UNSOURCED"
  }
]
```

The example values for `normal_range`, `minimum_spread`, `action` and `escalation_tier` are placeholders until Part 3 sources them.

## 3. Serial format

Arduino Uno to laptop over USB serial at **115200 baud**. One line per message, ending in a newline.

| Direction | Message | Meaning |
|-----------|---------|---------|
| App to Uno | `START` | Begin a STAND-REACT run. |
| Uno to app | `{"t":"rt","ms":312}` | One reaction time in ms. Becomes a `reaction_time` reading. |
| Uno to app | `{"t":"sway","rms":0.041}` | Sway score at end of test. Becomes a `sway_rms` reading. |
| App to Uno | `TIER:n` | `n` = 1 green LED, 2 amber LED, 3 red LED plus buzzer. |
| App to Uno | `MSG:text` | LCD text, 16 characters per line, e.g. `MSG:Rest+hydrate`. |

The sway `rms` value is in `g`, to match the `sway_rms` unit in the reading schema. The firmware must convert from m/s² if the IMU library reports that.

## Safe wait

The round-trip delay that splits Tier 2 (crew medical officer acts now) from Tier 3 (flight surgeon on Earth) is a **10 minute placeholder, marked UNSOURCED**. Round trip is twice the one-way delay. Part 3 owns finding a source.

## Stream envelope

Every WebSocket message from the bridge (`ws://<host>:8000/ws/stream`) is one JSON object with a `kind` field that says how to read `data`.
The mock bridge (`bridge/mock_server.py`) takes an optional `speed` query parameter (default `1.0`) that divides the 2 s gap between readings.

| `kind` | `data` | Other fields | When |
|--------|--------|--------------|------|
| `solar_event` | One DONKI SEP event, exactly as DONKI returns it | `cached`: `true` when it comes from `data/donki_cache.json` | First message after connect |
| `reading` | One `reading` object (section 1) | none | Then one per reading, in timestamp order; the mock loops after a 5 s pause |

Show `solar_event` messages with `cached: true` labelled "cached" on screen.

### Examples

```json
{"kind":"solar_event","data":{"sepID":"2024-05-09T13:59:00-SEP-001","eventTime":"2024-05-09T13:59Z","instruments":[{"displayName":"MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV"}],"link":"https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/30609/-1","linkedEvents":[{"activityID":"2024-05-09T08:45:00-FLR-001"}],"sentNotifications":[{"messageID":"20240509-AL-004","messageIssueTime":"2024-05-09T14:00Z","messageURL":"https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/30611/1"}],"submissionTime":"2024-05-09T13:54Z","versionId":1},"cached":true}
{"kind":"reading","data":{"crew_id":"C003","timestamp":"2026-11-13T07:30:00Z","type":"sleep_hours","value":4.5,"unit":"h","source":"replay"}}
```

### TypeScript

```ts
export type StreamMessage =
  | { kind: "solar_event"; data: Record<string, unknown>; cached: boolean }
  | { kind: "reading"; data: Reading };
```
