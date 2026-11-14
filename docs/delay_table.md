# Mission delay table (one-way signal delay)

Used by the triage router: round trip = 2 x one-way delay.

| Mission | One-way delay | Round trip | Status | Source |
|---|---|---|---|---|
| ISS | under 0.25 s | under 0.5 s | Sourced (team ref) | NTRS 20190032318 |
| Moon | about 1.3 s | about 2.6 s | SECONDARY - find a NASA page | https://issuu.com/irjet/docs/cislunar_communications_path_delays_a_comparison_ (cites ~1.3 s light time, 2.6 s round trip) |
| Mars (closest) | about 3 min | about 6 min | SECONDARY - find a NASA page | https://newspaceeconomy.ca/?p=211336 (says NASA describes 3 to 22 min one way) |
| Mars (farthest) | about 22 min | about 44 min | SECONDARY - find a NASA page | same as above |
| Mars demo value | 22 min | 44 min | Design choice inside the range | - |
| Solar conjunction | no link for about 2 weeks, every ~2 years | - | Sourced (NASA/JPL) | https://www.jpl.nasa.gov/edu/resources/video/mars-in-a-minute-what-happens-when-the-sun-blocks-our-signal/ ; NASA ASCEND paper on delays, disruptions and blackouts for crewed Mars missions: https://ntrs.nasa.gov/api/citations/20220013418/downloads/ASCEND-Communication%20Delays%2C%20Disruptions%2C%20and%20Blackouts%20for%20Crewed%20Mars%20Missions.pdf |

## Notes
- Some sources give Mars as 4 to 24 min. We use 3 to 22 min (closest ~54.6 million km, farthest ~401 million km at light speed). Do not mix the two on slides.
- Best citation for the slide: the NASA ASCEND paper above (NTRS 20220013418) covers delays and conjunction blackouts for crewed Mars missions in one NASA document. Check its numbers and replace the SECONDARY rows with it if they match.
- Conjunction: NASA pauses commands to Mars missions for about two weeks; for FARSIDE this means "no link", so every finding is handled by the crew.
