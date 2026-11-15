# Demo backups

Owner: Ansh (assigned tonight by the task sheet). Use these if the live demo fails (see `pitch/demo_instructions.md`, "If something fails"). Tick each item when done.

## 1. Screenshots (PNG, saved in this folder)

Take them from the stage laptop at the zoom used on stage, crew C003, after "Load Mars day 143".

- [x] `01-home-iss.png`: home screen on ISS (tier 3, message Earth)
- [x] `02-home-mars.png`: home screen on Mars (tier 2, crew acts now, outbox countdown running)
- [x] `03-chest-panel.png`: chest panel open on the astronaut
- [x] `04-head-panel.png`: head panel open on the astronaut
- [ ] `05-pdf-report.png`: the downloaded PDF report
- [ ] `06-ground-reply.png`: ground reply next to the on-board assessment
- [ ] `07-simulation-mode.png`: Simulation mode with all 8 channels
- [ ] `08-wokwi-hypoxia.png`: the Wokwi screen showing hypoxia

Taken 01-04 (plus a hands / reaction-taps panel) from `main` at `74cde88` with the mock bridge, one pass of the Mars day 143 scenario. They are not in git: kept in `Hackathon_shit/backup-screenshots/` on Ansh's laptop, to be shared in the team WhatsApp group. Browser pane size, 800 px wide; retake on the stage laptop if time allows.

Not taken (checked against `main` at `342afc4`): the PDF report and the ground-reply view have no UI on `main`. Simulation mode is in the bridge (`POST /sim`), but the sensor strip that shows it in the app is on `nandini/sensors-report` (no PR yet). 08 is Diksha's Wokwi project, outside the repo.

## 2. Cached AI responses

- [x] Copied after Om's `/assess` (PR #44) was merged.

The cache is one file, `bridge/assess_cache.json` (not `data/assess_cache/*.json` as first planned), with the cached on-board assessments for `nominal`, `hypoxia` and `fatigue` (fields `summary`, `findings`, `do_now`, `message_to_earth`). Refreshed after Om's PR #50 replaced it with live-recorded responses: copied unchanged to `pitch/backup/assess_cache/assess_cache.json` from `main` at `1159715`. If the cache on `main` changes again, copy it again.

## 3. Video

The video is **not in git** (CLAUDE.md bans video files). Keep the 30-second demo video and the backup station video in three places:

- [ ] USB stick: ________________________ (name / owner)
- [ ] Laptop 1: ________________________ (whose, file path)
- [ ] Laptop 2: ________________________ (whose, file path)

Check that each copy plays, offline, before the presentation.
