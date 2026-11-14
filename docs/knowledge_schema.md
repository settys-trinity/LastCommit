## knowledge.json

Append this section to `docs/schemas.md`. Owner: Person 2. Machine-readable version: `data/knowledge.schema.json`. TypeScript types: `data/knowledge.types.ts`. Tested reference implementation of the rules below: `data/score_reference.py`.

One row per indicator, keyed by the reading `type` from the `reading` schema. The rules engine looks up `knowledge.indicators[type]` for every incoming reading. Run `python data/validate.py` after any edit.

### Fields

| Field | Type | Description |
|---|---|---|
| `type` | string | Reading type (e.g. `sleep_hours`, `lab_glucose`). Unique. Must exist in `reading` types. |
| `indicator` | string | Name shown on screen. |
| `body_system` | string | Body-map region. In v0: `brain_behaviour`, `neurovestibular`, `metabolism`. |
| `hazards` | string[] | NASA HRP hazards behind it: `space_radiation`, `isolation_confinement`, `distance_from_earth`, `gravity_fields`, `hostile_closed_environments`. The mapping is our reading of the HRP list. |
| `unit` | string | Same unit as the reading. |
| `input` | enum | `station`, `checkin`, `osdr`, `ml`. |
| `direction` | enum | `low_is_bad`, `high_is_bad`, `both`. Which deviation counts as a finding. |
| `correlated_with` | string[] | Types from the same test. The engine should not count them as separate amber indicators when it applies "2 or more amber indicators turn the body system amber". |
| `normal_range` | `{min, max, source}` | Either bound can be `null`. `null`/`null` means personal baseline only. |
| `min_spread` | `{mode, value, cv_pct, source}` | The floor for the baseline spread. `mode: "absolute"` uses `value` (in the indicator's unit). `mode: "cv_pct"` uses `cv_pct` percent of the person's baseline mean. |
| `amber_limit`, `red_limit` | limit | See below. |
| `action` | `{amber, red, sources}` | Crew instruction text per level. |
| `escalation_tier` | `{amber: 1, red: "router"}` | Amber is always tier 1. Red is decided by the delay router (tier 2 or 3, round trip vs safe wait). |
| `params` | object | Extra constants for one type (e.g. `lapse_threshold_ms` for `lapses`). |
| `notes` | string | Caveats. |

### Source rule

Every threshold-bearing field has a source: a URL, `UNSOURCED` (could not source yet) or `DESIGN_CHOICE` (our decision, written down in `meta.design_choices`). The validator lists every `UNSOURCED` item. Say `DESIGN_CHOICE` out loud on stage; never present `UNSOURCED` as evidence.

### Limit object

```json
{ "z": 2, "outside_normal": true,
  "below": null, "at_or_below": null, "above": null, "at_or_above": null,
  "streak": 1, "sources": { "z": "DESIGN_CHOICE" }, "note": "" }
```

A limit **triggers** if any of these is true:

1. `z` is not null and the bad-direction z score of the current value is at least `z`.
2. `outside_normal` is true and the current value is outside `normal_range`.
3. Any of `below` (`<`), `at_or_below` (`<=`), `above` (`>`), `at_or_above` (`>=`) is not null and holds for each of the last `streak` readings (including the current one). `streak` defaults to 1. Fewer than `streak` readings so far means no trigger.

Status for a reading: `red` if `red_limit` triggers, else `amber` if `amber_limit` triggers, else `green`.

### Scoring

```
spread_eff = max(person_spread, floor)          floor = min_spread.value, or mean x cv_pct / 100
z          = (value - person_mean) / spread_eff
bad_z      = -z (low_is_bad) | z (high_is_bad) | |z| (both)
```

`person_mean` and `person_spread` come from `data/baselines.json` for lab types. For other types, build them at run time from the astronaut's first STAND-REACT runs and check-ins (OSDR has no such data). Until a baseline exists, only the absolute and `outside_normal` triggers apply.

Body system turns amber when 2 or more of its indicators are amber (plan, triage rules).

### Design choices to confirm as a team

- The plan says `|z|`; we use the bad direction only, so a faster reaction time or longer sleep is not a finding.
- Red can come without z (`z: null`) where a clinical limit or a streak is the right signal. With 3 baseline draws, z-based red made 103 mg/dL glucose red, so `lab_glucose` red uses clinical limits only.
- Sleep red needs 3 nights at 6 h or less. That makes the demo scenario (4.5, 5, 4 h) amber on nights 1 and 2 and red on night 3.

### Example

```json
{
  "type": "lab_glucose", "indicator": "Blood glucose (fasting)", "body_system": "metabolism",
  "hazards": ["hostile_closed_environments", "distance_from_earth"],
  "unit": "mg/dL", "input": "osdr", "direction": "both", "correlated_with": [],
  "normal_range": { "min": 65, "max": 99, "source": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575" },
  "min_spread": { "mode": "cv_pct", "value": null, "cv_pct": 5.6, "source": "https://mail.westgard.com/biodatabase1.htm" },
  "amber_limit": { "z": 2, "outside_normal": true, "below": null, "at_or_below": null, "above": null, "at_or_above": null,
                   "streak": 1, "sources": { "z": "DESIGN_CHOICE" }, "note": "" },
  "red_limit": { "z": null, "outside_normal": false, "below": 54, "at_or_below": null, "above": null, "at_or_above": 250,
                 "streak": 1, "sources": { "below": "https://professional.diabetes.org/sites/dpro/files/2025-05/hypoglycemia-hcp-5-27-25.pdf", "at_or_above": "UNSOURCED" }, "note": "" },
  "action": { "amber": "...", "red": "...", "sources": { "amber": "https://diabetes.org/...", "red": "https://diabetes.org/..." } },
  "escalation_tier": { "amber": 1, "red": "router" }, "params": {}, "notes": ""
}
```

### baselines.json

```json
{ "meta": { ... }, "crew": { "C003": { "crew_id": "C003", "sex": "F",
    "markers": { "lab_glucose": { "analyte": "GLUCOSE", "unit": "mg/dL",
      "values": { "L-92": 77, "L-44": 62, "L-3": 75 }, "n": 3, "mean": 71.333, "sd": 8.145,
      "cvi_pct": 5.6, "min_spread": 3.995, "spread": 8.145, "spread_is_floor": false,
      "ref_range": [65, 99], "source": "NASA OSDR OSD-575" } } } } }
```

Use `mean` and `spread` for z. `spread` already includes the floor. Keys under `markers` are reading types. `data/osdr_readings.json` holds the same draws as `reading` objects (`source: "osdr"`).
