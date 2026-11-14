# Threshold sources: verification report

Owner: Ansh (assigned tonight by the task sheet). Report only: **no value in `data/knowledge.json` was changed.** Checked on Sat 14 Nov 2026 against `main` at `97faa38`.

Status key: **SOURCED** = the URL opened tonight and states the number. **DESIGN_CHOICE** = our decision. **UNSOURCED** = no source. **NOT VERIFIED** = a source is given but could not be opened or does not show the number.

## (a) `data/knowledge.json` (v0.3)

| Item | Value | Source given | Verified? | Problem | Fix | Owner |
|---|---|---|---|---|---|---|
| sleep_hours normal_range min | 7 h | AASM consensus PDF, https://aasm.org/resources/pdf/adultsleepdurationconsensus.pdf | NOT VERIFIED | aasm.org returns HTTP 403 to automated tools | Open in a browser and confirm "7 or more hours"; the number is the well-known AASM/SRS recommendation | Ansh |
| sleep_hours min_spread | 1.0 h | DESIGN_CHOICE | DESIGN_CHOICE | - | - | - |
| sleep_hours amber z / outside_normal | 2 SD; under 7 h | DESIGN_CHOICE; normal range above | DESIGN_CHOICE | - | - | - |
| sleep_hours red at_or_below | 6 h | AASM page, https://aasm.org/seven-or-more-hours-of-sleep-per-night-a-health-necessity-for-adults/ | NOT VERIFIED | HTTP 403; also not confirmed that the page says "6 or fewer" rather than "less than 7" | Open in a browser. If it only says "less than 7", relabel 6 h as DESIGN_CHOICE | Ansh |
| sleep_hours red streak | 3 nights | DESIGN_CHOICE | DESIGN_CHOICE | - | - | - |
| sleep_hours actions | text | NASA-STD-3001 Sleep Accommodations brief (OCHMO) | SOURCED | - | - | - |
| mood normal_range, min_spread, amber at_or_below, red at_or_below, red streak | 4-5; 0.5; 3; 2; 3 days | DESIGN_CHOICE | DESIGN_CHOICE | - | - | - |
| mood actions | text | NASA HRP BMed evidence report (Slack et al. 2016, p. 54) | SOURCED | - | - | - |
| reaction_time_median normal_range | none | UNSOURCED | UNSOURCED | - | Personal baseline only; say so | - |
| reaction_time_median min_spread | 15 ms | UNSOURCED | UNSOURCED | Bench runs not received | Keep; say "tuned on our bench" only after it is | Ansh, Daksh |
| reaction_time_median amber / red | z 2 / z 3 | DESIGN_CHOICE | DESIGN_CHOICE | - | - | - |
| reaction_time_median actions | text | UNSOURCED | UNSOURCED | - | - | - |
| lapses normal_range, min_spread, actions | none; 1; text | UNSOURCED | UNSOURCED | - | - | - |
| lapses amber / red | z 2 / z 3 | DESIGN_CHOICE | DESIGN_CHOICE | - | - | - |
| lapses params lapse_threshold_ms | 355 ms | Basner, Mollicone & Dinges 2011 (PVT-B), https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786 | SOURCED | It is a per-tap cutoff, not a limit on a median (see Wokwi row 8) | - | - |
| sway_rms normal_range, min_spread, actions | none; 0.005 g; text | UNSOURCED | UNSOURCED | - | - | - |
| sway_rms amber / red | z 2 / z 3 | DESIGN_CHOICE | DESIGN_CHOICE | - | - | - |
| lab_glucose normal_range | 65-99 mg/dL | NASA OSDR OSD-575 | SOURCED | - | All 28 glucose rows in the OSD-575 file carry RANGE_MIN 65, RANGE_MAX 99 mg/dL | - |
| lab_glucose min_spread | 5.6 % CV | Westgard database, https://mail.westgard.com/biodatabase1.htm | NOT VERIFIED | **Link is dead (HTTP 404).** The 2014 update page lists glucose but does not show 5.6 % | Replace the URL with a page that shows glucose CVI, or relabel DESIGN_CHOICE (after the freeze: source text only, no value change) | Ansh |
| lab_glucose amber z / outside_normal | 2 SD; outside 65-99 | DESIGN_CHOICE; normal range above | DESIGN_CHOICE | - | - | - |
| lab_glucose red below | 54 mg/dL | ADA hypoglycemia sheet, https://professional.diabetes.org/sites/dpro/files/2025-05/hypoglycemia-hcp-5-27-25.pdf | SOURCED | - | Level 2 = below 54 mg/dL | - |
| lab_glucose red above | 250 mg/dL | Kitabchi et al. 2009, https://pmc.ncbi.nlm.nih.gov/articles/PMC2699725/ | SOURCED | - | Table 1: DKA plasma glucose >250 mg/dl | - |
| lab_glucose actions | text | ADA severe hypoglycemia sheet | SOURCED (low glucose only) | High-glucose steps are not in that source | Say "low-glucose steps from ADA" only | - |

## (b) Delay figures (`app/src/engine/delay.ts`, `docs/delay_table.md`)

| Item | Value | Source given | Verified? | Problem | Fix | Owner |
|---|---|---|---|---|---|---|
| ISS round trip | 0.5 s | Rucker et al., IAC 2019, NTRS 20190032318 | SOURCED | - | "one-way communications delay of <0.25 s" | - |
| Moon round trip | 2.6 s | NASA/TM-20250003885, Table 1 (Apollo telemetry 1.3 s one way) | SOURCED | `delay.ts` still cites "NASA Braided Communications white paper", which was not verified | Update the `source` string in `delay.ts` to the TM | Om |
| Mars round trip | 2640 s | AIAA ASCEND 2022 (NTRS 20220013418); NASA/TM-20250003885 | SOURCED | - | "about 22 minutes" max one way; TM: "44-minute round-trip" | - |
| Conjunction | null (no link) | ASCEND 2022 | SOURCED | - | One 2-3 week disruption per Mars mission | - |
| SAFE_WAIT_S | 600 s | DESIGN_CHOICE (docs/decisions.md), informed by NASA/TM-20250003885 Fig. 1 | DESIGN_CHOICE | NASA marks Fig. 1 times as notional | Say "our choice, informed by NASA" | - |

## (c) Wokwi 8-channel simulation limits (Diksha's sketch, not in the repo)

NEWS2 bands checked against the Royal College of Physicians chart ("Chart 1: The NEWS scoring system", RCP 2017, PDF linked from https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/). **Every band given in the task sheet matches the chart:** SpO2 scale 1 ≤91 = 3, 92-93 = 2, 94-95 = 1, ≥96 = 0. Pulse ≤40 = 3, 41-50 = 1, 51-90 = 0, 91-110 = 1, 111-130 = 2, ≥131 = 3. Respiration ≤8 = 3, 9-11 = 1, 12-20 = 0, 21-24 = 2, ≥25 = 3. Systolic ≤90 = 3, 91-100 = 2, 101-110 = 1, 111-219 = 0, ≥220 = 3.

| # | Channel | Amber | Red | Source claimed | Verified? | NEWS2 score at the limit | Problem | Fix | Owner |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SpO2 | ≤ 93 % | ≤ 91 % | NEWS2 | SOURCED | amber = score 2 (92-93); red = score 3 (≤91) | 94-95 already scores 1 but stays green | None needed; say "amber from NEWS2 score 2" | - |
| 2 | Heart rate | ≤ 50 or ≥ 111 | ≤ 40 or ≥ 131 | NEWS2 | SOURCED | amber low = score 1 (41-50), amber high = score 2 (111-130); red = score 3 | Low and high amber use different NEWS2 scores; 91-110 (score 1) stays green | Fine for the demo; mention if asked | - |
| 3 | Breathing rate | ≤ 11 or ≥ 21 | ≤ 8 or ≥ 25 | NEWS2 | SOURCED | amber low = score 1 (9-11), amber high = score 2 (21-24); red = score 3 | Same asymmetry as row 2 | Fine for the demo | - |
| 4 | Systolic BP | ≤ 100 or ≥ 140 | ≤ 90 or ≥ 180 | NEWS2 low; AHA high | Low SOURCED; high NOT VERIFIED | amber low = score 2 (91-100); red low = score 3 (≤90). NEWS2 high only scores at ≥220 | heart.org returns HTTP 403 to automated tools, so "stage 2 ≥ 140" and "crisis above 180" are not confirmed. If AHA says "higher than 180", red should be > 180, not ≥ 180 | Open the AHA page in a browser and confirm both numbers and the sign | Diksha |
| 5 | Skin temperature | ≤ 30 or ≥ 37 °C | ≤ 28 or ≥ 39 °C | Design choice | DESIGN_CHOICE | NEWS2 scores core body temperature, not skin | Do not call these NEWS2 | Label "design choice (skin, not core temperature)" | Diksha, Shreya |
| 6 | Accelerometer tilt | ≥ 5° | ≥ 10° | Design choice | DESIGN_CHOICE | - | - | - | - |
| 7 | Cabin CO2 | ≥ 4000 ppm | ≥ 5300 ppm | Design choice | Wrong | - | 5300 mixes up units: the 5.3 figure is **mmHg** (SMAC 7-180 days), not ppm | **Amber ≥ 3,950 ppm** (NASA-STD-3001 V2 6004: 1-hour average ≤ 3 mmHg ≈ 3,947 ppm at 760 mmHg). **Red ≥ 7,000 ppm** (SMAC 5.3 mmHg for 7-180 days ≈ 6,974 ppm). Both verified: OCHMO CO2 brief https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf ; SMAC 5.3 mmHg (7-180 d) and 10 mmHg (24 h) in https://ntrs.nasa.gov/citations/20160013696 | Diksha, Shreya |
| 8 | Reaction test median | ≥ 356 ms | ≥ 500 ms | PVT lapse 355 ms (Basner 2011) | Wrong label | - | In the PVT-B, 355 ms counts **one tap** as a lapse; it is not a limit on the median | Relabel the source "DESIGN_CHOICE, informed by the 355 ms PVT-B lapse cutoff". Optional: amber at 3 or more lapses in a run | Diksha, Shreya |

## Deck claim
"NASA's 2025 delay review (NASA/TM-20250003885) says countermeasures for communication delay still need to be designed." **SOURCED.** Section 1 of the TM says such countermeasures "need to be designed and evaluated for specific contexts" (https://ntrs.nasa.gov/citations/20250003885). It also notes that studies "have primarily focused on risk characterization rather than countermeasure development".

## Summary
- knowledge.json: 13 DESIGN_CHOICE, 12 UNSOURCED (all STAND-REACT floors, normal ranges and actions), 3 NOT VERIFIED (two AASM links blocked, Westgard link dead), the rest SOURCED.
- Delay figures: all SOURCED; safe wait is a DESIGN_CHOICE.
- Wokwi: rows 1-3 and the low half of row 4 match NEWS2; row 4 high is NOT VERIFIED; row 7 and row 8 need the fixes above.

## Messages to send
- **Diksha (Wokwi):** CO2 limits to amber ≥ 3,950 ppm and red ≥ 7,000 ppm (NASA 3 mmHg standard and 5.3 mmHg SMAC; 5300 was mmHg mistaken for ppm). Reaction row: source "DESIGN_CHOICE, informed by the 355 ms PVT-B lapse cutoff" (355 ms is per tap, not a median); optional amber at 3+ lapses. Skin temperature: label "design choice", not NEWS2. Systolic high: please confirm on heart.org that stage 2 is "140 or higher" and crisis is "higher than 180" (I could not open it); if it says "higher than", use > 180.
- **Shreya (deck):** use the same CO2 numbers (3,950 / 7,000 ppm, from 3 / 5.3 mmHg) and the reaction-row wording above. The NASA/TM-20250003885 countermeasures claim is verified; keep it.
- **Om (`delay.ts`):** Moon `source` string to "NASA/TM-20250003885 Table 1 (1.3 s light time); Artemis 3 to 14 s one way, same TM" (the Braided Communications white paper is not verified).
- **Ansh (after the freeze, source text only):** replace the dead Westgard URL for the glucose 5.6 % floor or relabel it DESIGN_CHOICE; confirm both AASM links in a browser.
