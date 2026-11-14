// Display helpers for mission delays. Owner: Nandini. The mission table itself lives only in
// engine/delay.ts (D4); this file re-exports it so components import one place.
export { MISSIONS } from "../../engine/delay";
export type { Mission, MissionId } from "../../engine/delay";

/** "0.5 s round trip", "44 min round trip", "no link". Always round trip on screen (D15). */
export function formatRoundTrip(seconds: number | null): string {
  if (seconds === null) return "no link";
  if (seconds < 60) return `${seconds} s round trip`;
  return `${Math.round(seconds / 60)} min round trip`;
}

/** "43:59" style countdown */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
