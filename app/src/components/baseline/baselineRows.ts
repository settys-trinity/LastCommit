// Owner: Ansh. Shapes data/baselines.json (copy in app/src/data) for BaselinePanel.
import type { Baselines, Knowledge } from "../../../../data/knowledge.types.ts";
import baselinesJson from "../../data/baselines.json";
import knowledgeJson from "../../data/knowledge.json";

const BASELINES = baselinesJson as unknown as Baselines;
const SCORED = new Set((knowledgeJson as unknown as Knowledge).indicators.map((i) => i.type));

// Scored marker first, then the rest. Labels for the screen; units as people read them.
const ORDER = ["lab_glucose", "lab_hemoglobin", "lab_wbc", "lab_calcium"];
const LABEL: Record<string, string> = {
  lab_glucose: "Glucose",
  lab_hemoglobin: "Haemoglobin",
  lab_wbc: "White blood cells",
  lab_calcium: "Calcium",
};
const UNIT: Record<string, string> = { "Thousand/uL": "×10³/µL" };

export const TIMEPOINTS = ["L-92", "L-44", "L-3"] as const;

export interface BaselineRow {
  type: string;
  label: string;
  unit: string;
  draws: { timepoint: string; value: number | null; outsideRange: boolean }[];
  mean: number;
  spread: number;
  spreadIsFloor: boolean; // spread raised to the biological-variation floor
  refRange: [number, number];
  study: string; // e.g. "OSD-575"
  scored: boolean; // used by the rules engine (in knowledge.json)
}

export function studyUrl(study: string): string {
  return `https://osdr.nasa.gov/bio/repo/data/studies/${study}`;
}

/** Rows for one crew member, scored marker first. Empty for GUEST or an unknown ID. */
export function baselineRows(crewId: string): BaselineRow[] {
  const markers = BASELINES.crew[crewId]?.markers ?? {};
  const keys = [...ORDER.filter((k) => k in markers), ...Object.keys(markers).filter((k) => !ORDER.includes(k)).sort()];
  return keys.map((type) => {
    const m = markers[type];
    const [lo, hi] = m.ref_range;
    return {
      type,
      label: LABEL[type] ?? m.analyte.charAt(0) + m.analyte.slice(1).toLowerCase(),
      unit: UNIT[m.unit] ?? m.unit,
      draws: TIMEPOINTS.map((tp) => {
        const value = m.values[tp] ?? null;
        return { timepoint: tp, value, outsideRange: value !== null && (value < lo || value > hi) };
      }),
      mean: m.mean,
      spread: m.spread,
      spreadIsFloor: m.spread_is_floor,
      refRange: [lo, hi],
      study: m.source.replace("NASA OSDR ", ""),
      scored: SCORED.has(type),
    };
  });
}

/** One decimal for values of 10 or more, two below that. */
export function fmt(x: number): string {
  return Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2);
}
