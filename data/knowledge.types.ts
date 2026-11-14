// Types for data/knowledge.json and data/baselines.json (see docs/knowledge_schema.md).
// Source of truth is data/knowledge.schema.json; keep this file in step with it.

export type Source = string; // https URL, "UNSOURCED" or "DESIGN_CHOICE"

export type Hazard =
  | "space_radiation"
  | "isolation_confinement"
  | "distance_from_earth"
  | "gravity_fields"
  | "hostile_closed_environments";

export type Direction = "low_is_bad" | "high_is_bad" | "both";
export type Status = "green" | "amber" | "red";

export interface Limit {
  z: number | null;
  outside_normal: boolean;
  below: number | null;        // value <  below
  at_or_below: number | null;  // value <= at_or_below
  above: number | null;        // value >  above
  at_or_above: number | null;  // value >= at_or_above
  streak: number;              // absolute limits must hold on this many latest readings
  sources: Partial<Record<"z" | "below" | "at_or_below" | "above" | "at_or_above" | "streak", Source>>;
  note: string;
}

export interface Indicator {
  type: string;                // reading type, e.g. "sleep_hours", "lab_glucose"
  indicator: string;
  body_system: string;
  hazards: Hazard[];
  unit: string;
  input: "station" | "checkin" | "osdr" | "ml";
  direction: Direction;
  correlated_with: string[];
  normal_range: { min: number | null; max: number | null; source: Source };
  min_spread: { mode: "absolute" | "cv_pct"; value: number | null; cv_pct: number | null; source: Source };
  amber_limit: Limit;
  red_limit: Limit;
  action: { amber: string; red: string; sources: { amber: Source; red: Source } };
  escalation_tier: { amber: 1; red: "router" };
  params: Record<string, unknown>;
  notes: string;
}

export interface Knowledge {
  meta: Record<string, unknown>;
  indicators: Indicator[];
}

export interface Baseline {
  analyte: string;
  unit: string;
  values: Record<string, number>; // timepoint (L-92, L-44, L-3) -> value
  n: number;
  mean: number;
  sd: number;
  cvi_pct: number;
  min_spread: number;
  spread: number;                 // already max(sd, min_spread): use this for z
  spread_is_floor: boolean;
  ref_range: [number, number];
  source: string;
}

export interface Baselines {
  meta: Record<string, unknown>;
  crew: Record<string, { crew_id: string; sex: string; markers: Record<string, Baseline> }>;
}

/** Floor for the baseline spread (same rule as data/score_reference.py). */
export function effectiveSpread(ind: Indicator, mean: number, spread: number): number {
  const ms = ind.min_spread;
  const floor = ms.mode === "absolute" ? (ms.value as number) : (mean * (ms.cv_pct as number)) / 100;
  return Math.max(spread, floor);
}
