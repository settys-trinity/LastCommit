# Engine contract

What the rules engine returns. One `engine_result` per incoming `reading` (`docs/schemas.md` section 1), for the crew member in that reading. It holds the latest status of every indicator, every body system and one triage decision.

The scoring rules live in `docs/knowledge_schema.md`. The tested reference implementation is `data/score_reference.py`. This file only fixes the shape of the output.

## `engine_result`

| Field | Type | Description |
|-------|------|-------------|
| `crew_id` | string | Same as the reading that triggered this result. |
| `timestamp` | string | ISO 8601 UTC `timestamp` of that reading. |
| `readings` | `indicator_result[]` | One entry per indicator in `knowledge.json` that has at least one reading for this crew member. |
| `body_systems` | `body_system_result[]` | One entry per `body_system` in `knowledge.json`. |
| `triage` | `triage` | The decision for the whole result. |

## Per reading: `indicator_result`

| Field | Type | Description |
|-------|------|-------------|
| `indicator` | string | The reading `type`, e.g. `sleep_hours`. Key of `knowledge.indicators`; the UI looks up the display name there. |
| `z` | number \| null | Bad-direction z score of the latest value (`bad_z` in `docs/knowledge_schema.md`). Positive is worse. `null` until a baseline exists. |
| `status` | `"green"` \| `"amber"` \| `"red"` | `red` if `red_limit` triggers, else `amber` if `amber_limit` triggers, else `green`. |

## Per body system: `body_system_result`

| Field | Type | Description |
|-------|------|-------------|
| `system` | string | A `body_system` value from `knowledge.json`. In v0: `brain_behaviour`, `neurovestibular`, `metabolism`. |
| `status` | `"green"` \| `"amber"` \| `"red"` | `red` if any of its indicators is red. Else `amber` if 2 or more are amber, counting indicators in the same `correlated_with` group as one. Else `green`. |

## Triage: `triage`

| Field | Type | Description |
|-------|------|-------------|
| `tier` | `0` \| `1` \| `2` \| `3` | `0`: all indicators green. `1`: any indicator amber, none red. `2` or `3`: any indicator red, decided by the delay router below. |
| `reason` | string | One line for the triage card naming the indicator and trigger, e.g. `"sleep_hours red: 3 nights at 6 h or less"`. `""` at tier 0. |
| `action` | string | Crew instruction: `action.amber` (tier 1) or `action.red` (tiers 2 and 3) from `knowledge.json` for the indicator in `reason`. `""` at tier 0. |
| `acts` | `"none"` \| `"crew"` \| `"crew_medical_officer"` \| `"flight_surgeon"` | Who acts. Tier 0 `none`, 1 `crew`, 2 `crew_medical_officer`, 3 `flight_surgeon`. |
| `round_trip_s` | number \| null | Round-trip signal delay for the mission in seconds (`docs/delay_table.md`, 2 x one-way). `null` means no link (solar conjunction). |
| `safe_wait_s` | number | Longest round trip at which waiting for Earth is safe. `600` (10 min placeholder, UNSOURCED, `docs/schemas.md` "Safe wait"). |

When several indicators trigger, `reason` and `action` come from the worst one: red over amber, then the higher `z`.

### Delay router

Applies only when an indicator is red (`escalation_tier.red` is `"router"`):

- `round_trip_s <= safe_wait_s`: tier 3, `acts: "flight_surgeon"`. Message Earth.
- `round_trip_s > safe_wait_s` or `round_trip_s` is `null`: tier 2, `acts: "crew_medical_officer"`. The crew acts now. The station shows the amber LED (`docs/decisions.md`).

## Example

Mars demo (round trip 44 min), crew C003, third short night (4 h). Values for `z` are illustrative.

```json
{
  "crew_id": "C003",
  "timestamp": "2026-11-15T07:30:00Z",
  "readings": [
    { "indicator": "sleep_hours", "z": 6.0, "status": "red" },
    { "indicator": "mood", "z": 1.2, "status": "green" },
    { "indicator": "reaction_time_median", "z": 2.4, "status": "amber" }
  ],
  "body_systems": [
    { "system": "brain_behaviour", "status": "red" },
    { "system": "neurovestibular", "status": "green" },
    { "system": "metabolism", "status": "green" }
  ],
  "triage": {
    "tier": 2,
    "reason": "sleep_hours red: 3 nights at 6 h or less",
    "action": "Crew medical officer reviews workload. Move safety-critical tasks off the next shift and re-run STAND-REACT before them.",
    "acts": "crew_medical_officer",
    "round_trip_s": 2640,
    "safe_wait_s": 600
  }
}
```

The same readings on the ISS (`round_trip_s: 0.5`) give `tier: 3` and `acts: "flight_surgeon"`.

## Functions (C5)

Three functions, three owners, one folder: `app/src/engine/`. The signatures are frozen; the bodies belong to their owners. The app imports only `evaluate`.

| Function | File | Owner |
|----------|------|-------|
| `evaluate(readings: Reading[], crewId: string, missionId: string): EngineResult` | `index.ts` | Shreya |
| `score(readings: Reading[], crewId: string): { readings: IndicatorResult[]; body_systems: BodySystemResult[]; worst: Worst \| null }` | `score.ts` (rules in `rules.ts`) | Ansh |
| `route(worst: Worst \| null, missionId: string): Triage` | `triage.ts` (missions in `delay.ts`) | Om |

## TypeScript

```ts
export type Status = "green" | "amber" | "red";

export interface IndicatorResult { indicator: string; z: number | null; status: Status }
export interface BodySystemResult { system: string; status: Status }
export interface Worst { indicator: string; status: Status; z: number | null; reason: string; action: string }

export interface Triage {
  tier: 0 | 1 | 2 | 3;
  reason: string;
  action: string;
  acts: "none" | "crew" | "crew_medical_officer" | "flight_surgeon";
  round_trip_s: number | null;
  safe_wait_s: number;
}

export interface EngineResult {
  crew_id: string;
  timestamp: string;
  readings: IndicatorResult[];
  body_systems: BodySystemResult[];
  triage: Triage;
}
```

## Tier to station (C7)

Decided in D2 and D12. The app computes the result with `evaluate()` in the browser and, whenever the tier changes, sends the tier number unchanged and one fixed message (Shreya's `useStationSync`). It sends nothing in replay mode. The bridge never runs the engine.

| Tier | Finding | `acts` | `POST /tier` | LED | `POST /msg` line 1 / line 2 | Earth outbox |
|------|---------|--------|--------------|-----|------------------------------|--------------|
| 0 | All green | `none` | `{"n":0}` | Off | `ALL CLEAR` | Nothing |
| 1 | Amber | `crew` | `{"n":1}` | Green | `SELF-CARE` / `FOLLOW APP STEPS` | Logged |
| 2 | Red, Earth too far or no link | `crew_medical_officer` | `{"n":2}` | Amber | `ACT NOW` / `CREW MED OFFICER` | Sent. Crew does not wait |
| 3 | Red, Earth in reach | `flight_surgeon` | `{"n":3}` | Red | `MESSAGE EARTH` / `FLIGHT SURGEON` | Sent. Crew waits for the reply |

The app pads line 1 to 16 characters so line 2 starts on the second OLED row. Tier 3 is the red LED only: the vibration module is a sensor, not a motor (`docs/decisions.md`).

## Settled questions

- Tier 0 with `acts: "none"` for an all-green result stays (D12).
- The engine result is computed in the app with `evaluate()`, not sent on the stream (D12).
