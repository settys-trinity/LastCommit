// FARSIDE mission profiles: one-way and round-trip signal delay. Values and sources: docs/delay_table.md.
// The triage router compares roundTripS with safe_wait_s (docs/engine_contract.md).

export type MissionId = "iss" | "moon" | "mars" | "conjunction";

export interface Mission {
  id: MissionId;
  label: string;
  oneWayS: number | null;     // null = no link
  roundTripS: number | null;  // 2 x one-way; null = no link (engine contract)
  note: string;
  source: string;
}

export const MISSIONS: Record<MissionId, Mission> = {
  iss: {
    id: "iss", label: "ISS", oneWayS: 0.25, roundTripS: 0.5,
    note: "Doctor on Earth answers in seconds",
    source: "NTRS 20190032318",
  },
  moon: {
    id: "moon", label: "Moon", oneWayS: 1.3, roundTripS: 2.6,
    note: "1.3 s light time one way (NASA expects 3 to 14 s with relays)",
    source: "NASA/TM-20250003885",
  },
  mars: {
    id: "mars", label: "Mars", oneWayS: 1320, roundTripS: 2640,
    note: "Up to 22 min one way (44 min round trip)",
    source: "NASA ASCEND, NTRS 20220013418",
  },
  conjunction: {
    id: "conjunction", label: "Solar conjunction", oneWayS: null, roundTripS: null,
    note: "No link for 2 to 3 weeks: the crew handles everything",
    source: "NASA ASCEND, NTRS 20220013418",
  },
};

export const MISSION_ORDER: MissionId[] = ["iss", "moon", "mars", "conjunction"];

/** "0.5 s", "10 s", "44 min", "no link" */
export function formatDelay(seconds: number | null): string {
  if (seconds === null) return "no link";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}

/** "43:59" style countdown */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
