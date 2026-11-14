# Mission delay table (one-way signal delay)

Owner: Ansh (sources). The router's numbers live in `app/src/engine/delay.ts` (owner Om); round trip = 2 x one-way. Every row below was checked against the cited document on 14 Nov 2026.

| Mission | One-way delay | Round trip | Source |
|---|---|---|---|
| ISS | under 0.25 s | under 0.5 s | Rucker et al., *Innovative Approaches to Using the International Space Station as a Mars Transit Analog*, IAC 2019, NTRS 20190032318: "Communications with ISS have a one-way communications delay of <0.25 s". https://ntrs.nasa.gov/citations/20190032318 |
| Moon (light time, used in the app) | about 1.3 s | about 2.6 s | NASA/TM-20250003885, *Assessment of the State of Communication Delay Research in Preparation for Missions Beyond Low Earth Orbit* (2025), Table 1: Apollo telemetry 1.3 s one-way. https://ntrs.nasa.gov/citations/20250003885 |
| Moon (Artemis, operational) | 3 to 14 s | 6 to 28 s | Same TM, section 1: "lunar missions may experience one-way communication latencies ranging from 3 to 14 seconds". |
| Mars (crew at Mars) | 15 to 20 min | 30 to 40 min | McBrayer, Chai and Judd, *Communication Delays, Disruptions, and Blackouts for Crewed Mars Missions*, AIAA ASCEND 2022, NTRS 20220013418. https://ntrs.nasa.gov/citations/20220013418 |
| Mars (maximum, used in the app) | about 22 min | about 44 min (2640 s) | ASCEND 2022: "the maximum one-way communication delay is about 22 minutes for any mission". TM-20250003885: "up to 22-minute one-way (44-minute round-trip) delay at maximum distance". |
| Mars (closest to farthest, general) | about 4 to 24 min | 8 to 48 min | NASA Goddard, *Space Communications: 7 Things You Need to Know*. https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/ |
| Solar conjunction | no link for 2 to 3 weeks, once per Mars mission | none | ASCEND 2022: "all Mars missions will experience a single, two-to-three-week disruption". NASA HRP fact sheet *Mars Communications Disruption and Delay* (2023 Moon to Mars Architecture Concept Review): blackouts "are inevitable and can last weeks". https://www.nasa.gov/wp-content/uploads/2024/01/mars-communications-disruption-and-delay.pdf |

## Safe wait: 600 s (DESIGN_CHOICE)

The router waits for Earth only when the round trip is at most 600 s (`SAFE_WAIT_S` in `delay.ts`). No source gives a safe-wait number for medical findings, so 600 s is our choice. It is informed by NASA/TM-20250003885, Figure 1, which places "~10 min delay" at the point where the "crew must autonomously manage the vehicle state" and "1-5 min delay" where the "crew must execute complex tasks without real-time support". NASA marks those times as notional and does not say one-way or round trip, so say "our choice, informed by NASA's notional figure" on stage. The tier result does not depend on the exact value: ISS (0.5 s) and Moon (2.6 s) are far below it, and Mars (2640 s) is far above it.

## Notes for the team
- **Moon:** the router uses 2.6 s round trip (light time). NASA expects Artemis crews to see 3 to 14 s one way in practice because of relays and ground networks. Either way the Moon stays far under the safe wait, so the tier does not change. Pitch line: "even the Moon is not real time".
- **Mars:** the demo uses the ASCEND maximum, 22 min one way (44 min round trip = 2640 s), as in `docs/engine_contract.md`. Never show 22 on screen or slides without the words "one way" (plan D15).
- **Conjunction:** ASCEND says every Mars mission hits one 2 to 3 week disruption. In FARSIDE this means "no link": every finding is handled by the crew.
- **Corrections on 14 Nov:** the Artemis row previously linked NTRS 20250000703 (a 2025 workshop presentation) instead of the TM, 20250003885. The 1.3 s Moon value is now cited to the TM's Table 1 instead of a white paper that was not checked. The ISS row now names its paper. No number changed.
