// Triage router. Owner: Om. Spec: docs/engine_contract.md ("Triage" and "Delay router").
// The delay to Earth decides who acts: the same red reading means "message Earth"
// on the ISS (tier 3) and "crew acts now" on Mars (tier 2, amber LED).
import type { Triage } from "../types";
import type { score } from "./score";
import { earthCanAct, getMission, SAFE_WAIT_S } from "./delay";

export function route(worst: ReturnType<typeof score>["worst"], missionId: string): Triage {
  const { round_trip_s } = getMission(missionId);
  const base = { round_trip_s, safe_wait_s: SAFE_WAIT_S };

  if (!worst || worst.status === "green") {
    return { ...base, tier: 0, acts: "none", reason: "", action: "" };
  }
  const text = { reason: worst.reason, action: worst.action };
  if (worst.status === "amber") return { ...base, ...text, tier: 1, acts: "crew" };

  // Red: delay router. null round trip = no link (solar conjunction), so the crew acts.
  if (earthCanAct(round_trip_s)) return { ...base, ...text, tier: 3, acts: "flight_surgeon" };
  return { ...base, ...text, tier: 2, acts: "crew_medical_officer" };
}
