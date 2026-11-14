# Team rules for AI coding agents (FARSIDE, Team Last Commit)

Codex reads `AGENTS.md`; keep it identical to this file.

## Who owns what

Ask the owner before changing their files. Owners from the continuation plan and the commit history; correct this list if it is wrong.

- **Shreya** (settys-trinity), integrator: merges to `main`, `app/` (shell, `app/src/engine/index.ts`, `triage.ts`, `delay.ts`, `hooks/`, `types.ts`), `bridge/mock_server.py`, `docs/schemas.md`, `docs/engine_contract.md`, `docs/decisions.md`, `README.md`, `data/scenario_*.json`, `data/*donki*`, `data/check_readings.py`
- **Ansh** (Ansh-0403), rules engine: `app/src/engine/score.ts`, `engine/`, `data/knowledge*`, `data/baselines.json`, `data/build_baselines.py`, `data/fetch_osdr.py`, `data/osdr_readings.json`, `data/raw/`, `data/score_reference.py`, `data/validate.py`, `docs/knowledge_schema.md`, `README_part2.md`
- **Nandini** (NandiniLashkari), ML and bridge: `ml/`, `web-components/`, `bridge/stress.py`, `bridge/test_stress.py`, `docs/delay_table.md`
- **Daksh** (Daksh Singla), hardware: `firmware/`, `bridge/serial_bridge.py`, `bridge/station.py`, `bridge/test_station.py`
- **Om** (Om Juvekar): role to confirm. Has committed to `firmware/`, `bridge/` and `docs/`.

Shared files (`docs/schemas.md`, `docs/decisions.md`, `README.md`, `.gitignore`, `bridge/requirements.txt`): change only your own section or line, and say so in the PR.

Copies to keep in step: `app/src/data/knowledge.json` must equal `data/knowledge.json` (owner Ansh). After editing one, copy it over the other in the same PR.

## Branches

- Never push to `main` directly. Work on your own branch and open a small PR. Shreya merges.
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
- `node --test engine/score.test.ts` (rules engine)
- `cd app && npm test && npm run build` (app)
- `python bridge/test_stress.py` and `python bridge/test_station.py` (bridge)

## Lockfiles

For conflicts in `app/package-lock.json` and similar: take main's version, run `npm install` in `app/`, and commit the regenerated file.
