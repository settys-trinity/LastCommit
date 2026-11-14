// Astronaut parts and the data each one shows. One test per part (Diksha's map); the chest pairs mood with
// the stress/mood check because that check compares the two. Pure functions, no three.js (safe for the first chunk).
import type { CabinAirSample, EngineResult, Reading, Status } from "../../types";
import type { TagStatus } from "../term";

export type PartId = "helmet" | "visor" | "chest" | "abdomen" | "backpack" | "hands" | "legs";

/** How a part's test is run from the body page. */
export type PartAction = "standreact" | "sleep" | "mood" | "view";

export const PARTS: {
  id: PartId;
  name: string; // body part, as shown in the hover hint
  test: string; // the one test this part stands for
  label: string; // short label for lists
  source: string;
  action: PartAction;
  anchor: [number, number, number]; // hotspot position on the figure (three.js units, before figure offset)
}[] = [
  { id: "helmet", name: "Brain", test: "the attention (lapses) test", label: "lapses", source: "STAND-REACT taps over 355 ms (station touch pad)", action: "standreact", anchor: [0, 2.3, 0.1] },
  { id: "visor", name: "Eyes", test: "the sleep check-in", label: "sleep", source: "daily check-in", action: "sleep", anchor: [0, 1.78, 0.52] },
  { id: "hands", name: "Hands", test: "the reaction time test", label: "reaction time", source: "STAND-REACT median (station touch pad)", action: "standreact", anchor: [0.93, -0.34, 0.3] },
  { id: "chest", name: "Heart", test: "the mood check-in", label: "mood + stress check", source: "daily check-in; stress model replays WESAD S17 and never sets a tier", action: "mood", anchor: [0, 0.95, 0.62] },
  { id: "abdomen", name: "Abdomen", test: "the blood glucose result", label: "blood glucose", source: "NASA OSDR Inspiration4 labs, scored against this person's own baseline", action: "view", anchor: [0, 0.38, 0.5] },
  { id: "legs", name: "Legs", test: "the balance (sway) test", label: "balance sway", source: "STAND-REACT accelerometer (PmodACL, sternum)", action: "standreact", anchor: [-0.25, -1.08, 0.2] },
  { id: "backpack", name: "Life support", test: "the cabin air check", label: "cabin air", source: "station gas sensor, uncalibrated index; environment, never a crew reading", action: "view", anchor: [-0.68, 1.6, -0.58] },
];

/** "Hands: click here to run the reaction time test" */
export function hint(id: PartId): string {
  const p = PARTS.find((x) => x.id === id)!;
  return `${p.name}: click here to ${p.action === "view" ? "see" : "open"} ${p.test}`;}

export type PartStatuses = Partial<Record<PartId, TagStatus>>;

const TAG: Record<Status, TagStatus> = { green: "ok", amber: "warn", red: "fail" };

export type PartData = { result: EngineResult; readings: Reading[]; cabinAir: CabinAirSample[] };

const latest = (rs: Reading[], type: string) => rs.filter((r) => r.type === type).at(-1);
const indicator = (result: EngineResult, type: string) => result.readings.find((r) => r.indicator === type);

/** Status per part, from the engine result and the raw stream. "off" = no data yet. */
export function partStatuses({ result, readings, cabinAir }: PartData): PartStatuses {
  const ind = (t: string, fallback: TagStatus = "off"): TagStatus => {
    const r = indicator(result, t);
    return r ? TAG[r.status] : fallback;
  };
  // Chest: the mood score, raised to [WARN] when the stress/mood check flags a mismatch (a flag, never a tier).
  const check = latest(readings, "stress_mood_check")?.value;
  const flagged = check === "hidden_stress" || check === "low_mood_no_stress";
  const mood = ind("mood", latest(readings, "stress_prob") ? "info" : "off");
  const chest: TagStatus = mood === "fail" ? "fail" : flagged ? "warn" : mood;
  return {
    helmet: ind("lapses"),
    visor: ind("sleep_hours"),
    hands: ind("reaction_time_median", latest(readings, "reaction_time") ? "info" : "off"),
    chest,
    abdomen: ind("lab_glucose"),
    legs: ind("sway_rms"),
    backpack: cabinAir.length ? "info" : "off",
  };
}

const fmt = (r: Reading | undefined, digits?: number) =>
  r === undefined ? "--" : `${typeof r.value === "number" && digits !== undefined ? r.value.toFixed(digits) : r.value} ${r.unit}`.trim();

/** Label/value rows for one part's detail list. */
export function partRows(part: PartId, { result, readings, cabinAir }: PartData): [string, string][] {
  const z = (t: string) => {
    const r = indicator(result, t);
    return r ? `${r.status}${r.z === null ? ", baseline pending" : `, z ${r.z.toFixed(1)}`}` : "no reading";
  };
  switch (part) {
    case "helmet":
      return [
        ["lapses", `${fmt(latest(readings, "lapses"))}  (${z("lapses")})`],
        ["meaning", "taps slower than 355 ms: slips of attention"],
      ];
    case "visor":
      return [["sleep", `${fmt(latest(readings, "sleep_hours"))}  (${z("sleep_hours")})`]];
    case "hands": {
      const taps = readings.filter((r) => r.type === "reaction_time");
      return [
        ["median", `${fmt(latest(readings, "reaction_time_median"))}  (${z("reaction_time_median")})`],
        ["taps", String(taps.length)],
        ["last_tap", fmt(taps.at(-1))],
      ];
    }
    case "legs":
      return [
        ["sway_rms", `${fmt(latest(readings, "sway_rms"), 3)}  (${z("sway_rms")})`],
        ["runs", String(readings.filter((r) => r.type === "sway_rms").length)],
      ];
    case "chest": {
      const probs = readings.filter((r) => r.type === "stress_prob").map((r) => Number(r.value));
      const last5 = probs.slice(-5);
      const level = last5.length ? `${Math.round((last5.reduce((a, b) => a + b, 0) / last5.length) * 100)}%` : "--";
      return [
        ["mood", `${fmt(latest(readings, "mood"))}  (${z("mood")})`],
        ["stress_level", `${level} (mean of last 5 windows)`],
        ["check", String(latest(readings, "stress_mood_check")?.value ?? "--")],
      ];
    }
    case "abdomen":
      return [["glucose", `${fmt(latest(readings, "lab_glucose"))}  (${z("lab_glucose")})`]];
    case "backpack": {
      const v = cabinAir.map((s) => s.value);
      return [
        ["index", v.length ? String(v.at(-1)) : "--"],
        ["samples", String(v.length)],
      ];
    }
  }
}

/** Series for a small sparkline under the detail rows, if the part has one. */
export function partSeries(part: PartId, { readings, cabinAir }: PartData): number[] {
  if (part === "hands") return readings.filter((r) => r.type === "reaction_time").slice(-20).map((r) => Number(r.value));
  if (part === "legs") return readings.filter((r) => r.type === "sway_rms").map((r) => Number(r.value));
  if (part === "chest") return readings.filter((r) => r.type === "stress_prob").slice(-20).map((r) => Number(r.value));
  if (part === "backpack") return cabinAir.slice(-60).map((s) => s.value);
  return [];
}

/** A check-in reading made on the body page (C1: six fields, source "checkin"). */
export function checkinReading(crewId: string, type: "sleep_hours" | "mood", value: number, now = new Date()): Reading {
  return {
    crew_id: crewId,
    timestamp: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    type,
    value,
    unit: type === "sleep_hours" ? "h" : "score_1_5",
    source: "checkin",
  };
}
