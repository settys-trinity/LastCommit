// Mission signal delays. Owner: Om. Source: docs/delay_table.md (round trip = 2 x one-way).
// Mars uses the 22 min one-way maximum (44 min round trip). Sources: Ansh, docs/delay_table.md.

export type MissionId = "iss" | "moon" | "mars" | "conjunction";

export interface Mission {
  id: MissionId;
  label: string;
  one_way_s: number | null;    // null = no link
  round_trip_s: number | null; // null = no link
  source: string;              // for the screen and slides; keep in step with docs/delay_table.md
}

export const MISSIONS: Mission[] = [
  { id: "iss", label: "ISS", one_way_s: 0.25, round_trip_s: 0.5, source: "NTRS 20190032318" },
  { id: "moon", label: "Moon", one_way_s: 1.3, round_trip_s: 2.6, source: "NASA Braided Communications white paper (light time); Artemis 3 to 14 s one way, NASA/TM-20250003885" },
  { id: "mars", label: "Mars", one_way_s: 1320, round_trip_s: 2640, source: "NASA ASCEND, NTRS 20220013418 (maximum while at Mars)" },
  { id: "conjunction", label: "Solar conjunction", one_way_s: null, round_trip_s: null, source: "NASA/JPL; NASA ASCEND NTRS 20220013418" },
];

// 10 minute placeholder, UNSOURCED (docs/schemas.md "Safe wait")
export const SAFE_WAIT_S = 600;

export function getMission(missionId: string): Mission {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) {
    throw new Error(`unknown missionId: ${missionId} (use ${MISSIONS.map((m) => m.id).join(", ")})`);
  }
  return mission;
}

/** True when a reply from Earth arrives within the safe wait. No link (null) = false. */
export function earthCanAct(roundTripS: number | null, safeWaitS: number = SAFE_WAIT_S): boolean {
  return roundTripS !== null && roundTripS <= safeWaitS;
}
