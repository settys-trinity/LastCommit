# FARSIDE schemas

Source: *FARSIDE: Final Project Plan* (14 Nov 2026), section "Three schemas to agree before anyone codes".

## 1. `reading`

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
| `sway_rms` | number | `g` | STAND-REACT, end of test | From serial `{"t":"sway","rms":0.041}`. RMS of acceleration magnitude minus gravity, ~100 Hz. Unit to confirm against firmware. |
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

- Sway unit: `g` or `m/s^2`? Must match what the firmware sends.
- Lapse threshold value and source (Part 3).
- Whether typed heart rate and blood pressure are in scope (proposed, team to confirm).
