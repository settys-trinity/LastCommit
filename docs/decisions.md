# Decisions

## 2026-11-14: Mars "crew acts now" LED

Mars crew-acts-now shows the amber LED (Tier 2), per the plan tier table. The older red plus buzzer script is superseded.

## 2026-11-14: No buzzer

The kit has no buzzer. Tier 3 is the red LED only. Update 15:20: Daksh confirmed the vibration module is a sensor, not a motor, so there is no vibration (`HAS_VIBE_MOTOR` stays off in `firmware/stand_react/stand_react.ino`).

## 2026-11-14: Cabin air is environment, not a crew reading

The gas sensor goes on the stream as its own kind `cabin_air`, like DONKI. Its value is an uncalibrated 0 to 1023 index, shown only as change from the session's own baseline (`docs/schemas.md`, Stream envelope).

## 2026-11-14: No-Clash Project Plan decisions (D1 to D18)

Source: FARSIDE No-Clash Project Plan (Team Last Commit). It replaces the v2 PDF and every earlier role list. D2, D5 to D8 and D14 were proposals for Shreya to confirm at the 14:00 check-in; with no change, they stand as written.

| # | Decision |
|---|----------|
| D1 | Om approves every PR. Shreya presses Merge at :00 and :30. Nobody else merges, including their own PR. Om's own PRs are approved by Shreya. |
| D2 | The station LED shows the tier, meaning who acts, not the finding colour. `TIER:0` off, `1` green (crew self-care), `2` amber (crew medical officer acts now), `3` red (message Earth). The app sends the engine tier unchanged. The screen labels each LED by who acts. |
| D3 | One router file: `app/src/engine/triage.ts`, `route(worst, missionId)`. There is no `router.ts`. |
| D4 | One mission table: `app/src/engine/delay.ts`. `web-components/` was deleted in #26. |
| D5 | The Mars day 143 scenario has three baseline STAND-REACT summaries on days 140 to 142 and a day 143 summary (`reaction_time_median`, `lapses`, `sway_rms`). Values from Ansh (A3). |
| D6 | Scenario mood is 4 on day 143, so the stress check returns `hidden_stress`. Sleep still drives the red finding. |
| D7 | Lapse threshold 355 ms (3-minute PVT-B, Basner, Mollicone & Dinges 2011, https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786), in both `params.lapse_threshold_ms` in `data/knowledge.json` and `LAPSE_MS` in `bridge/station.py`. Closed: Ansh and Daksh agree (#19). |
| D8 | Sway and reaction time stay green until a person has 3 runs. At the 18:30 run the stage astronaut does three real 20 s runs, and Om replaces the D5 baseline days with them. On stage, say the live run is compared with that person's own baseline. |
| D9 | Shreya owns the triage card and station sync. Om keeps only the engine side (`triage.ts`, `delay.ts`, their tests). |
| D10 | Ansh owns `docs/delay_table.md` (evidence). Om owns `delay.ts`. Ansh sends changed numbers to Om. |
| D11 | One `CLAUDE.md` (identical `AGENTS.md`), owned by Om. |
| D12 | The app computes the engine result in the browser with `evaluate()`, then calls `POST /tier` and `POST /msg`. The bridge never runs the engine. Tier 0 with `acts: "none"` stays. |
| D13 | The stress and mood check never changes the tier. It is a flag on the stress panel only. |
| D14 | Feature freeze 20:30. Code freeze 21:30. After that only `pitch/` changes. |
| D15 | Mars is always shown as the round trip: 44 minutes, run at 60 times speed so it counts down in 44 seconds. Never show 22 minutes on screen or slides without the words "one way". |
| D16 | The No-Clash Project Plan is the current plan. The v2 PDF and Ansh's artifact are history. |
| D17 | `app/vercel.json` belongs to Shreya (moved from Nandini in #32). Nandini sends deploy changes to Shreya. |
| D18 | The app uses the terminal look: palette in `app/src/theme.ts`, kept in step with the `@theme` block in `index.css`; components use it (#23, #30, #31). |

Earlier decisions that still stand: sway unit is `g`; Mars "crew acts now" is tier 2 and amber; no buzzer; cabin air is environment, never a crew reading; DONKI flares dropped, particle events cached; the stress model never sets a tier.

## 2026-11-14: Safe wait is a design choice

`SAFE_WAIT_S = 600` is a DESIGN_CHOICE, informed by NASA's notional figure in NASA/TM-20250003885 (Ansh, #29, `docs/delay_table.md`). On stage: "our choice, informed by NASA's notional figure". The tier result does not depend on the exact value.

## 2026-11-14: Not building

Typed heart rate and blood pressure, live DONKI calls, trend charts, live model inference, a local LLM, a buzzer. Cut order if a gate slips: cabin air panel, Moon profile, vibration motor (now moot), body map detail panel. Never cut STAND-REACT, the triage tiers or the Earth outbox.
