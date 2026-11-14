# Team rules for AI coding agents (FARSIDE, Team Last Commit)

Codex reads `AGENTS.md`; keep it identical to this file.

## Who owns what

One writer per file. Ask the owner before changing their files: write the exact change in your PR description or message them. Full plan, timeline and per-person prompts: https://claude.ai/artifact/Ny4tfB4zVTLg9kmMsMysn4

- **Shreya** (settys-trinity), integrator and app shell. Only person who merges to `main`. `app/src/App.tsx`, `main.tsx`, `hooks/`, `types.ts`, `engine/index.ts`, styles, `app/package.json`, `app/package-lock.json`, `app/src/data/scenario_mars_day143.json`, `bridge/mock_server.py`, `data/scenario_*.json`, `data/*donki*`, `data/check_readings.py`, `docs/schemas.md`, `docs/engine_contract.md`, `docs/decisions.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`
- **Ansh** (Ansh-0403), rules engine and evidence. `app/src/engine/score.ts`, `rules.ts`, `rules.test.ts`, `parity_cases.json`, `app/src/data/knowledge.json`, `app/src/data/baselines.json`, `app/src/components/baseline/`, `data/knowledge*`, `data/baselines.json`, `data/build_baselines.py`, `data/fetch_osdr.py`, `data/osdr_readings.json`, `data/raw/`, `data/score_reference.py`, `data/make_parity_cases.py`, `data/validate.py`, `docs/knowledge_schema.md`, `docs/delay_table.md`, `README_part2.md`
- **Om** (Om Juvekar), triage and crew display (role to confirm). `app/src/engine/triage.ts`, `delay.ts`, `triage.test.ts`, `app/src/components/triage/`, `app/src/station/`
- **Nandini** (NandiniLashkari), ML stress and Earth link. `ml/`, `bridge/stress.py`, `bridge/test_stress.py`, `app/src/components/mission/`, `outbox/`, `stress/`, `app/src/data/demo_predictions.json`, `web-components/` until moved, Vercel deploy
- **Daksh** (Daksh Singla), station hardware and serial bridge. `firmware/`, `bridge/serial_bridge.py`, `bridge/station.py`, `bridge/test_station.py`

Only Shreya edits `App.tsx`. Everyone else builds components in their own `app/src/components/<area>/` folder, taking `EngineResult`, crew or mission as props, and sends Shreya the import line.

Shared files (`bridge/requirements.txt`, `.gitignore`): add only your own line and say so in the PR.

One copy rule: `app/src/data/knowledge.json` = `data/knowledge.json` and `app/src/data/baselines.json` = `data/baselines.json` (Ansh; after editing, copy over and run `python data/make_parity_cases.py`); `app/src/data/scenario_mars_day143.json` = `data/scenario_mars_day143.json` (Shreya). One mission table: `app/src/engine/delay.ts` (Om); do not add another.

## Branches

- Never push to `main` directly. Work on your own branch named `<name>/<topic>` and open a small PR (one task). Shreya merges at :00 and :30.
- Before starting work and before every push: `git fetch origin && git merge origin/main`. Do this at least every hour.
- Merge, do not rebase, once a branch is pushed: rebasing a pushed branch needs a force-push.
- Never commit `.env`, `.DS_Store`, `.venv`, `node_modules` or `*.clan`.

## When a pull or merge hits conflicts

1. Stop. Do not resolve conflicts in files owned by someone else without telling them first.
2. Run `bash scripts/report-conflicts.sh`. It opens one GitHub issue per conflicted file, labelled `conflict` (it skips files that already have an open issue).
3. On each new issue, add a comment (`gh issue comment <n> --body "..."`) with:
   - what our side changes, in one or two lines
   - what their side changes, in one or two lines
   - a proposed resolution that keeps both working
4. Resolve it yourself only if it is trivial (imports, formatting, lockfiles) or every file involved belongs to the current user. Then run the checks below and close the issue: `gh issue close <n> --comment "Resolved: <how>"`.
5. Otherwise, leave the issue open for the file owner and tell the user which issue to send them. To back out of the merge meanwhile: `git merge --abort`.
6. Never commit, push or force-push without asking the user. Never force-push `main`.

Open conflicts: https://github.com/settys-trinity/LastCommit/issues?q=is:open+label:conflict

## Checks before closing a conflict or opening a PR

- `python data/validate.py` and `python data/score_reference.py` (knowledge, baselines)
- `cd app && npm test && npm run build` (app, including the rules engine tests)
- `python bridge/test_stress.py` and `python bridge/test_station.py` (bridge)

## Lockfiles

For conflicts in `app/package-lock.json` and similar: take main's version, run `npm install` in `app/`, and commit the regenerated file.
