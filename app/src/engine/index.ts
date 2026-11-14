// The app imports only evaluate from here. Teammates replace score.ts and triage.ts, not this file.
import type { EngineResult, Reading } from "../types";
import { score } from "./score";
import { route } from "./triage";

export function evaluate(readings: Reading[], crewId: string, missionId: string): EngineResult {
  const mine = readings.filter((r) => r.crew_id === crewId);
  const scored = score(mine, crewId);
  const timestamp = mine.reduce((t, r) => (r.timestamp > t ? r.timestamp : t), "");
  return {
    crew_id: crewId,
    timestamp,
    readings: scored.readings,
    body_systems: scored.body_systems,
    triage: route(scored.worst, missionId),
  };
}
