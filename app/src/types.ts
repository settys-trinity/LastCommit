// Copied from docs/schemas.md (Reading, StreamMessage) and docs/engine_contract.md (engine output).
// Keep in step with those docs.

export type ReadingSource = "station" | "replay" | "checkin" | "ml_live" | "ml_saved" | "osdr";

export interface Reading {
  crew_id: string;          // "C001".."C004" | "GUEST"
  timestamp: string;        // ISO 8601 UTC
  type: string;             // see Reading types
  value: number | string | boolean;
  unit: string;             // "" when unitless
  source: ReadingSource;
}

export type StreamMessage =
  | { kind: "solar_event"; data: Record<string, unknown>; cached: boolean }
  | { kind: "reading"; data: Reading }
  | { kind: "cabin_air"; data: { timestamp: string; value: number; unit: "adc_0_1023"; source: "station" } };

export type CabinAirSample = Extract<StreamMessage, { kind: "cabin_air" }>["data"];

export type Status = "green" | "amber" | "red";

export interface IndicatorResult { indicator: string; z: number | null; status: Status }
export interface BodySystemResult { system: string; status: Status }

export interface Triage {
  tier: 0 | 1 | 2 | 3;
  reason: string;
  action: string;
  acts: "none" | "crew" | "crew_medical_officer" | "flight_surgeon";
  round_trip_s: number | null;
  safe_wait_s: number;
}

export interface EngineResult {
  crew_id: string;
  timestamp: string;
  readings: IndicatorResult[];
  body_systems: BodySystemResult[];
  triage: Triage;
}
