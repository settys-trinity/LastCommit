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
| `lapses` | number | `count` | STAND-REACT, end of test | Taps slower than 355 ms (D7): the 3-minute PVT-B lapse threshold, Basner, Mollicone & Dinges 2011 (https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786). Same value as `LAPSE_MS` in `bridge/station.py` and `params.lapse_threshold_ms` in `data/knowledge.json`. |
| `sway_rms` | number | `g` | STAND-REACT, end of test | From serial `{"t":"sway","rms":0.041}`. RMS of acceleration magnitude minus gravity, ~100 Hz. Firmware sends `g` (section 3). |
| `sleep_hours` | number | `h` | Daily check-in | |
| `mood` | number | `score_1_5` | Daily check-in | Integer 1 to 5. |
| `symptom` | string | `""` | Daily check-in | One reading per reported symptom. |
| `heart_rate` | number | `bpm` | Daily check-in (proposed) | Typed in. Team to confirm. |
| `bp_systolic` | number | `mmHg` | Daily check-in (proposed) | Typed in. Team to confirm. |
| `bp_diastolic` | number | `mmHg` | Daily check-in (proposed) | Typed in. Team to confirm. |
| `stress_prob` | number | `prob_0_1` | Stress classifier | Probability the 60 s window is stress. Replayed held-out WESAD subject, not the person on stage. |
| `stress_label` | string | `""` | Stress classifier | `baseline` or `stress`. One more indicator for the engine; never sets a tier on its own. |
| `stress_mood_check` | string | `""` | Stress/mood check (`ml/stress_feed.py`, `app/src/components/stress/stressMoodCheck.ts`) | `hidden_stress`, `low_mood_no_stress`, `consistent`, `uncertain` or `no_data`. The first two are a flag on the brain and behaviour panel. Never sets a tier on its own. See [Stress/mood check](#stressmood-check). |
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

### Settled questions

- Lapse threshold: 355 ms (D7, `docs/decisions.md`).
- Typed heart rate and blood pressure are out of scope (No-Clash plan, "Not building").

## 2. `knowledge.json`

The thresholds the rules engine uses. File: `data/knowledge.json`. Full spec: [`docs/knowledge_schema.md`](knowledge_schema.md). Machine-readable schema: `data/knowledge.schema.json`. TypeScript types: `data/knowledge.types.ts`. Run `python data/validate.py` after any edit.

## 3. Serial format

Arduino Uno to laptop over USB serial at **115200 baud**. One line per message, ending in a newline.

| Direction | Message | Meaning |
|-----------|---------|---------|
| App to Uno | `START` | Begin a STAND-REACT run of 60 s (kept for backwards compatibility). |
| App to Uno | `START:n` | Begin a run of `n` seconds, 5 to 120. The demo uses `START:20`. |
| App to Uno | `TIER:n` | `n` = 0 all tier LEDs off, 1 green LED (crew self-care), 2 amber LED (crew medical officer acts now), 3 red LED (message Earth). The app sends the engine tier unchanged (D2, `docs/engine_contract.md` "Tier to station"). No buzzer and no vibration: the vibration module is a sensor. |
| App to Uno | `MSG:text` | OLED text, up to 32 characters (16 per line), e.g. `MSG:Rest+hydrate`. |
| App to Uno | `PING` | Uno answers `{"t":"ready"}`. |
| Uno to app | `{"t":"ready"}` | Uno booted, or answer to `PING`. |
| Uno to app | `{"t":"start"}` | A run has started. |
| Uno to app | `{"t":"rt","ms":312}` | One reaction time in ms. Becomes a `reaction_time` reading. |
| Uno to app | `{"t":"sway","rms":0.041}` | Sway score at end of test. Becomes a `sway_rms` reading. |
| Uno to app | `{"t":"done"}` | Always the last line of a run. |
| Uno to app | `{"t":"button"}` | Station button pressed. The bridge starts a run for the crew set with `POST /arm`. |
| Uno to app | `{"t":"air","raw":n}` | Gas sensor sample, 0 to 1023. The bridge turns it into a `cabin_air` stream message (see Stream envelope). |
| Uno to app | `{"t":"err","msg":"acl"\|"oled"}` | Accelerometer or OLED not found at boot. A run still works; sway is left out without the accelerometer. |

The bridge ignores lines it does not know. The sway `rms` value is in `g`, to match the `sway_rms` unit in the reading schema. Full details: `firmware/README.md`.

## Safe wait

The round-trip delay that splits Tier 2 (crew medical officer acts now) from Tier 3 (flight surgeon on Earth) is **600 s, a DESIGN_CHOICE** (`SAFE_WAIT_S` in `app/src/engine/delay.ts`), informed by NASA's notional figure in NASA/TM-20250003885. Round trip is twice the one-way delay. Evidence and wording for the stage: `docs/delay_table.md` (Ansh).

## Stream envelope

Every WebSocket message from the bridge (`ws://<host>:8000/ws/stream`) is one JSON object with a `kind` field that says how to read `data`.
The mock bridge (`bridge/mock_server.py`) takes an optional `speed` query parameter (default `1.0`) that divides the 2 s gap between readings.

| `kind` | `data` | Other fields | When |
|--------|--------|--------------|------|
| `solar_event` | One DONKI SEP event, exactly as DONKI returns it | `cached`: `true` when it comes from `data/donki_cache.json` | First message after connect |
| `reading` | One `reading` object (section 1) | none | Then one per reading, in timestamp order; the mock loops after a 5 s pause |
| `cabin_air` | `{"timestamp","value","unit":"adc_0_1023","source":"station"}` | none | Every 5 s from `bridge/serial_bridge.py` (gas sensor). Not sent by the mock bridge |

Show `solar_event` messages with `cached: true` labelled "cached" on screen.

`cabin_air` is an environment hazard, like DONKI, not a crew `reading`: it has no `crew_id` and does not go to the rules engine. The value is an **uncalibrated sensor index** (0 to 1023), not ppm. Show it only as change from the session's own baseline (for example the mean of the first minute), never as an absolute concentration.

### Examples

```json
{"kind":"solar_event","data":{"sepID":"2024-05-09T13:59:00-SEP-001","eventTime":"2024-05-09T13:59Z","instruments":[{"displayName":"MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV"}],"link":"https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/30609/-1","linkedEvents":[{"activityID":"2024-05-09T08:45:00-FLR-001"}],"sentNotifications":[{"messageID":"20240509-AL-004","messageIssueTime":"2024-05-09T14:00Z","messageURL":"https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/30611/1"}],"submissionTime":"2024-05-09T13:54Z","versionId":1},"cached":true}
{"kind":"reading","data":{"crew_id":"C003","timestamp":"2026-11-13T07:30:00Z","type":"sleep_hours","value":4.5,"unit":"h","source":"replay"}}
{"kind":"cabin_air","data":{"timestamp":"2026-11-15T11:42:05Z","value":312,"unit":"adc_0_1023","source":"station"}}
```

### TypeScript

```ts
export type StreamMessage =
  | { kind: "solar_event"; data: Record<string, unknown>; cached: boolean }
  | { kind: "reading"; data: Reading }
  | { kind: "cabin_air"; data: { timestamp: string; value: number; unit: "adc_0_1023"; source: "station" } };
```

## Stress/mood check

Compares the stress model with the daily mood check-in. Same logic in Python (`ml/stress_feed.py`, used for the replay file) and TypeScript (`app/src/components/stress/stressMoodCheck.ts`, for the stress panel when a live check-in arrives). It is a flag only and never sets a tier (D13).

- Stress level = mean `stress_prob` over the last 5 windows (about 2 minutes).
- Stressed at >= 0.6, calm at <= 0.4, in between is `uncertain` (no flag).
- Mood 4 to 5 counts as "fine", 1 to 2 as "low".

| Body | Mood | `value` | Flag | Message to crew |
|------|------|---------|------|-----------------|
| stressed | 4 to 5 | `hidden_stress` | yes (amber) | Body signals show stress but self-reported mood is good. Self-report can miss strain: take a 5-minute break and re-check. |
| calm | 1 to 2 | `low_mood_no_stress` | yes (amber) | Mood is low but body signals look calm. Consider a private behavioural-health check-in with the crew medical officer. |
| stressed / calm | other | `consistent` | no | Body signals and self-reported mood agree. |
| in between | any | `uncertain` | no | Stress signal is borderline; no comparison made. |
| fewer than 5 windows or no mood | | `no_data` | no | Not enough stress data or no mood check-in yet. |

All thresholds are DESIGN_CHOICE. The check is one more indicator and never sets a tier on its own.

### Replay file

`data/scenario_stress_s17.json` (built by `python ml/stress_feed.py`): the last 8 windows of held-out WESAD subject S17 as `stress_prob` + `stress_label` readings for `C003`, 15 s apart, ending 1 minute before the STAND-REACT test, then one `stress_mood_check` reading against the scenario mood. Source `ml_saved`. The mock bridge merges it into the Mars day 143 stream by timestamp.
