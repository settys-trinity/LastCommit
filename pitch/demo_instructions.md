# FARSIDE: 3-minute demo instructions

Owner: Ansh (assigned tonight by the task sheet). Timings are fixed. `CONFIRM:` marks a speaker or step the team should double-check before the dry run.

## Before we start (checklist)

- [ ] Bridge running (`python bridge/serial_bridge.py --port COMn`), or the mock bridge if the station is not used.
- [ ] App open in the browser on `/demo`, crew C003, mission ISS, zoom checked at 125 %.
- [ ] Station plugged in, tier LED and OLED respond, and the three baseline runs are done for the stage astronaut.
- [ ] Cached AI responses loaded (so the on-board assessment works without Wi-Fi).
- [ ] 30-second video on two laptops and a USB stick.
- [ ] Wokwi tab open on the hypoxia screen.
- [ ] Backup screenshots ready (see `pitch/backup/README.md`).

## Script

| Time | Who | Action | Say |
|---|---|---|---|
| 0:00-0:20 | Shreya | Play the 30-second video. | Nothing over the video. |
| 0:20-0:50 | Daksh | Astronaut stands at the station and does the tap test. Gas sensor and accelerometer values show in the sensor strip. | "Three sensors we had this weekend: reaction, motion and cabin air." |
| 0:50-1:30 | Nandini | Click Mars. The same reading now shows "crew medic acts now". The countdown starts at 44:00 (60× speed). The on-board assessment appears with time B. | "Earth's answer is 44 minutes away, round trip. Ours took X seconds." (read the real time B off the screen) |
| 1:30-1:50 | Nandini | Tap the chest and head on the astronaut. Download the PDF report. | "Every part explains itself in plain words." |
| 1:50-2:10 | Diksha | Questionnaire, then 20 seconds of the breathing exercise. | "While the astronaut waits, FARSIDE keeps them steady." |
| 2:10-2:35 | Daksh | Switch to Simulation mode (Wokwi feed): all 8 channels. Show the Wokwi screen with hypoxia, and switch ISS to Mars on the sim. | "This is the full 8-channel set a monitor like NASA's would use. These values are simulated." |
| 2:35-2:50 | Om | The countdown ends (or skip ahead). The ground diagnosis appears next to the on-board assessment. Tap Agree. | "Every reply from Earth can teach the on-board model." |
| 2:50-3:00 | Shreya | Closing line. | "Same data. Different distance. Different decision." |

CONFIRM: Daksh is both the station driver (0:20) and the Simulation-mode driver (2:10); the plan's default stage roles were narrator Diksha, driver Shreya, astronaut Daksh. Agree who is at the laptop at each step.
CONFIRM: "Ours took X seconds": whoever speaks must read the real on-board assessment time off the screen, never a rehearsed number.
CONFIRM (checked against `main` at `18eb680`): the questionnaire and ground-reply **data** are merged (`app/src/data/questionnaire.json`, `ground_replies.json`), but there is no UI yet for the questionnaire, the breathing exercise, the ground reply or the PDF report. Simulation mode is on Daksh's unmerged branch `daksh/sim-mode` (bridge replays `data/wokwi_feed_*.jsonl`). Rehearse only with the build that has these, or cut those steps.

## If something fails

- **No Wi-Fi or the AI API fails:** the UI uses the cached response and shows "cached". Keep going and say "cached response".
- **Station fails:** switch to Simulation mode (Wokwi feed) and carry on from 0:50. If the bridge is down, the app should fall back to replay mode with a "Replay mode" badge (CONFIRM: this fallback needs Shreya's `useStream.ts` fix; test it with the bridge stopped before going on stage).
- **App fails:** show the backup screenshots in order (`pitch/backup/`).

## Say / don't say

| Say | Don't say |
|---|---|
| "Decision support, not diagnosis." | "AI diagnoses the astronaut." |
| "On-board assessment in seconds; ground diagnosis after the round trip." | "Our AI is faster than other AI apps." |
| "Simulated values, calibrated to published limits." | "Live NASA data for all sensors." |
| "Tonight on a cloud model; on the mission on a Jetson worn by the astronaut." | "Runs on a Jetson." |
| "22 min one way" or "44 min round trip." | A bare "22 minutes" or "40 minutes". |
| "The personal monitor has no fire detector; ours could add one." | "NASA has no fire detector." |
| "Future: trained on NASA medical records by data request." | "Trained on NASA doctor consultations." |

If cabin CO2 comes up: NASA's standard is a 1-hour average of **3 mmHg** or less (about **3,950 ppm**); the 7-to-180-day limit (SMAC) is **5.3 mmHg** (about **7,000 ppm**). Our sim uses amber ≥ 3,950 ppm and red ≥ 7,000 ppm. The Wokwi sketch and the bridge both use these limits; sources in `pitch/threshold_sources.md`.

## Judge questions

- **Does a cloud API work on Mars?** No. Tonight it stands in for the on-board model. The routing rule already runs locally.
- **Is the AI diagnosing?** No. The rules engine sets the tier from sourced limits; the AI explains it.
- **Where is the NASA data?** Delay figures from NASA, Inspiration4 pre-flight bloodwork from OSDR in the baseline panel, limits from NEWS2 and NASA standards.
- **Why only 3 sensors?** That's what we had this weekend. The Wokwi sim shows the full 8-channel target with the same logic.
