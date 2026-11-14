# engine

Rules engine in TypeScript (owner: Ansh). Port of `data/score_reference.py`; output shape is `docs/engine_contract.md`. Plain TypeScript with no dependencies, so the React app can import it directly.

```ts
import { Engine } from "../engine/engine.ts";
const engine = new Engine(knowledge, baselines, { round_trip_s: 2640 }); // Mars demo
const result = engine.ingest(reading);   // engine_result, or null if the type is not scored
engine.setRoundTrip(0.5);                // mission selector: ISS
engine.result("C003");                   // re-triage without a new reading
```

| File | What |
|------|------|
| `score.ts` | One indicator: z with spread floor, amber/red limits, streaks. Same rules as `score_reference.py`. |
| `engine.ts` | Per-crew history and baselines, body systems (2+ amber, a `correlated_with` group counts once), triage tier 0 to 3. |
| `score.test.ts` | The 24 `score_reference.py` cases, 720 generated parity cases, body systems, Mars and ISS triage. |
| `make_parity_cases.py` | Regenerates `parity_cases.json` from the Python reference. Re-run after editing `knowledge.json`. |
| `run_stream.ts` | Runs the engine on the bridge WebSocket and prints a tier per reading. |

## Run

Node 22.18 or newer runs `.ts` files directly (no install).

```
node --test engine/score.test.ts
python -m uvicorn mock_server:app --app-dir bridge --port 8000
node engine/run_stream.ts mars        # or iss, moon, conjunction, or a round trip in seconds
```

## Behaviour to know

- **Baselines.** Lab types use `data/baselines.json`. Other types build a personal baseline from the first 3 readings for that crew member (`baseline_runs`, DESIGN_CHOICE). Until then `z` is `null` and only normal-range and absolute limits apply. `setBaseline()` overrides it.
- **Not scored.** Types not in `knowledge.json` return `null`: per-tap `reaction_time`, `symptom`, `stress_prob`, `stress_label`, `heart_rate`, and lab markers other than glucose.
- **Delay router.** `defaultRouter` follows the contract (round trip <= safe wait: tier 3 flight surgeon, otherwise tier 2 crew medical officer). Shreya's router can replace it with the `router` option.
- **Reason text.** Built from the limit that fired, e.g. `sleep_hours red: 3 readings in a row at 6 h or less`.
