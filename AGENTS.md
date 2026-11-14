# Team rules for AI coding agents (FARSIDE, Team Last Commit)

`AGENTS.md` must be identical to this file. Owner of both: Om.
Full plan: https://claude.ai/artifact/BroEH2TQu7FPwR4JGntPjT (FARSIDE: No-Clash Project Plan). Where anything disagrees with that plan, the plan wins.

## Start and end of every session

1. Ask which teammate you are working for. Read this file, then their clan: `clan read agent <name>.clan`.
2. Run `git fetch origin` and compare branch heads with what the clan says.
3. At the end of each task, update `<name>.clan` with `clan patch-data` / `clan patch-state` (always `--agent "claude for <name>"` and `--action`), then `clan validate`. Never write a fact you did not verify this session.

## Who owns what (one writer per file)

Edit only your human's paths. For any other file, write the exact change for its owner instead of editing it.

- **Shreya** (`settys-trinity`), repo owner and frontend lead, the only person who merges: `app/src/App.tsx`, `main.tsx`, `index.css`, `theme.ts`, `types.ts`, `app/src/hooks/`, `app/src/engine/index.ts`, `app/src/components/shell/`, `standreact/`, `triage/`, `station/`, `bodymap/`, `solar/`, `cabin/`, `term/`, `astronaut/`, `landing/`, `app/package.json`, `app/package-lock.json`, `app/index.html`, `app/vite.config.ts`, `app/tsconfig*.json`, `app/README.md`, `app/vercel.json` (D17)
- **Om**, integrator, approves every PR: `app/src/engine/triage.ts`, `delay.ts`, `triage.test.ts`, `engine.test.ts`, `docs/schemas.md`, `docs/engine_contract.md`, `docs/decisions.md`, `CLAUDE.md`, `AGENTS.md`, `.github/`, `scripts/`, `.gitignore`, `.gitattributes`, `README.md`, `data/README.md`, `data/scenario_mars_day143.json` and its copy in `app/src/data/`, `data/check_readings.py`, `data/donki_cache.json`, `data/cache_donki.py`, `data/test_donki*.py`, `bridge/mock_server.py`, `bridge/test_client.py`
- **Ansh** (`Ansh-0403`), rules engine and evidence: `app/src/engine/score.ts`, `rules.ts`, `rules.test.ts`, `parity_cases.json`, `app/src/components/baseline/`, `app/src/data/knowledge.json`, `app/src/data/baselines.json`, `data/knowledge*`, `data/baselines.json`, `data/build_baselines.py`, `data/fetch_osdr.py`, `data/osdr_readings.json`, `data/raw/`, `data/score_reference.py`, `data/make_parity_cases.py`, `data/validate.py`, `docs/knowledge_schema.md`, `docs/delay_table.md`, `README_part2.md`
- **Nandini** (`NandiniLashkari`), ML, Earth-link components, deploy: `ml/`, `bridge/stress.py`, `bridge/test_stress.py`, `data/scenario_stress_s17.json` and its copy in `app/src/data/`, `app/src/components/mission/`, `outbox/`, `stress/`
- **Daksh**, station and bridge: `firmware/`, `bridge/serial_bridge.py`, `bridge/station.py`, `bridge/test_station.py`, `bridge/README.md`, `bridge/requirements.txt`
- **Diksha**, pitch: `pitch/`
- Any path not listed belongs to Om until he assigns it.

Consequences:

- Only Shreya edits `App.tsx` and `app/package.json`. Components take props only and arrive with an import line in the PR. Need an npm package: ask Shreya.
- Only Daksh edits `bridge/serial_bridge.py`. The stress feed extends through `bridge/stress.py`.
- Only Om edits the docs. Send him the text.
- `app/src/data/*` copies must equal `data/*`. After editing `knowledge.json` or `baselines.json`: copy it over and run `python data/make_parity_cases.py`.
- Before creating a file, check this list. Never add a second router, mission table, engine folder or rules file. The router is `app/src/engine/triage.ts` (`route(worst, missionId)`). The mission table is `app/src/engine/delay.ts`.

## Frozen contracts

Do not change these shapes in code. To change one, open a PR on its doc first and get Om's approval.

- Reading: exactly six fields `crew_id, timestamp, type, value, unit, source` (`docs/schemas.md` section 1).
- Stream kinds: `solar_event`, `reading`, `cabin_air` (`docs/schemas.md`, Stream envelope).
- Bridge endpoints and serial lines (`firmware/README.md` section 6, `docs/schemas.md` section 3). Additions only.
- Engine: `evaluate(readings, crewId, missionId)`, `score(readings, crewId)`, `route(worst, missionId)` and `EngineResult` (`docs/engine_contract.md`).
- Missions: ids `iss`, `moon`, `mars`, `conjunction`; round trips 0.5, 2.6, 2640 s and null; `SAFE_WAIT_S = 600`.
- Station: the app sends the engine tier unchanged. `TIER:0` off, `1` green (self-care), `2` amber (crew medical officer acts now), `3` red (message Earth).
- The stress model and the stress/mood check never set a tier. Cabin air is never a crew reading.

## Branches and pull requests

- Never push to `main`. Never force-push. Never rebase a pushed branch. Never merge a PR: Om approves, Shreya merges at :00 and :30.
- Branch from fresh main: `git fetch origin && git switch -c <name>/<topic> origin/main`. One task per branch. Open the PR within 10 minutes of the first push.
- Before starting, before every push and after every merge window: `git fetch origin && git merge origin/main`.
- Ask your human before every commit and every push. Stage files by name, never `git add .`.
- Never commit `.env`, `.venv`, `node_modules`, `.DS_Store`, `*.clan`, `WESAD/` or video files.
- After 20:30 (Sat 14 Nov) bug fixes only. After 21:30 only `pitch/` changes.

## Checks before opening a PR

- `app/`: `cd app && npm test && npm run build`
- `data/knowledge*`, `data/baselines*`: `python data/validate.py`, `python data/score_reference.py`, `python data/make_parity_cases.py`
- Any readings file: `python data/check_readings.py <file>`
- `bridge/`: `python bridge/test_station.py` and `python bridge/test_stress.py`

If output looks cut off through rtk, rerun with `rtk bypass <command>`.

## On a merge conflict

1. Stop. Do not resolve inside a file your human does not own.
2. Only your own files: resolve, rerun the checks, push.
3. Lockfile or generated file: take main's version and regenerate (`npm install` in `app/`, or the generator script).
4. Someone else's file: `git merge --abort`, run `bash scripts/report-conflicts.sh` (one GitHub issue per file, label `conflict`) and tell the owner the issue number. Om decides.
