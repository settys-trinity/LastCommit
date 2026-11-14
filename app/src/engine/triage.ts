// TEMP STUB. Owner: Om. Replace the body with the real triage router and mission delay logic. Keep this signature.
import type { Triage } from "../types";
import type { score } from "./score";
import { MISSIONS, SAFE_WAIT_S } from "./delay";

export function route(worst: ReturnType<typeof score>["worst"], missionId: string): Triage {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) throw new Error(`unknown missionId: ${missionId}`);
  const round_trip_s = mission.round_trip_s;
  const base = { round_trip_s, safe_wait_s: SAFE_WAIT_S };

  if (!worst || worst.status === "green") {
    return { ...base, tier: 0, acts: "none", reason: "", action: "" };
  }
  const text = { reason: worst.reason, action: worst.action };
  if (worst.status === "amber") return { ...base, ...text, tier: 1, acts: "crew" };
  // Red: delay router. null round trip = no link (solar conjunction), so the crew acts.
  if (round_trip_s !== null && round_trip_s <= SAFE_WAIT_S) {
    return { ...base, ...text, tier: 3, acts: "flight_surgeon" };
  }
  return { ...base, ...text, tier: 2, acts: "crew_medical_officer" };
}
