# Mission delay table (one-way signal delay)

Used by the triage router: round trip = 2 x one-way delay. All rows now have NASA sources.

| Mission | One-way delay (use in app) | Round trip | Source |
|---|---|---|---|
| ISS | under 0.25 s | under 0.5 s | NTRS 20190032318 (team reference) |
| Moon (Artemis, operational) | 3 to 14 s | 6 to 28 s | NASA/TM-20250003885, Assessment of the State of Communication Delay Research: https://ntrs.nasa.gov/citations/20250000703 |
| Moon (pure light time) | about 1.3 s (demo value, plan v2) | about 2.6 s | NASA Braided Communications white paper: https://science.nasa.gov/wp-content/uploads/2023/05/188_fed0ad8278e728107533d509b24dc68b_SmithsimmonsDrew.pdf |
| Mars (crewed mission, while at Mars) | 15 to 20 min | 30 to 40 min | NASA ASCEND paper, Communication Delays, Disruptions, and Blackouts for Crewed Mars Missions (NTRS 20220013418): https://ntrs.nasa.gov/api/citations/20220013418/downloads/ASCEND-Communication%20Delays%2C%20Disruptions%2C%20and%20Blackouts%20for%20Crewed%20Mars%20Missions.pdf |
| Mars (maximum, any mission) | about 22 min (demo value) | about 44 min (2640 s, as in docs/engine_contract.md) | Same ASCEND paper; NASA/TM-20250003885 (up to 44 min round trip) |
| Mars (closest to farthest, general) | about 4 to 24 min | 8 to 48 min | NASA Goddard, Space Communications: 7 Things You Need to Know: https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/ |
| Solar conjunction | no link, 2 to 3 weeks, once per Mars mission | - | NASA ASCEND paper (above); NASA HRP Mars Communications Disruption and Delay fact sheet: https://www.nasa.gov/wp-content/uploads/2024/01/mars-communications-disruption-and-delay.pdf |

## Notes for the team
- **Moon:** the router uses 2.6 s round trip (1.3 s light time, plan v2). NASA expects Artemis crews to see 3 to 14 s one way in practice because of relays and ground networks. Either way the Moon stays under the 600 s safe wait, so the tier does not change. Good pitch line: "even the Moon is not real time".
- **Mars: use the ASCEND crewed-mission numbers** (15 to 20 min while at Mars, about 22 min max). The 4 to 24 min range is for Earth-Mars distance in general; ASCEND models actual crewed trajectories, which is closer to our use case. Demo uses the maximum, 22 min one way (44 min round trip = 2640 s), matching docs/engine_contract.md.
- **Conjunction**: ASCEND says every Mars mission will hit one 2 to 3 week disruption. In FARSIDE this means "no link": every finding is handled by the crew.
