// Astronaut parts and the data each one shows. Pure functions, no three.js (safe for the first chunk).
import type { CabinAirSample, EngineResult, Reading, Status } from "../../types";
import type { TagStatus } from "../term";

export type PartId = "helmet" | "ears" | "chest" | "abdomen" | "backpack" | "hands" | "legs";

export const PARTS: { id: PartId; label: string; source: string }[] = [
  { id: "helmet", label: "brain and behaviour", source: "STAND-REACT taps + daily check-in" },
  { id: "ears", label: "neurovestibular", source: "station accelerometer (PmodACL, sternum)" },
  { id: "hands", label: "reaction taps", source: "station touch pad" },
  { id: "legs", label: "balance (sway)", source: "station accelerometer (PmodACL, sternum)" },
  { id: "chest", label: "stress vs mood", source: "replayed WESAD S17 model; never sets a tier" },
  { id: "abdomen", label: "metabolism", source: "NASA OSDR Inspiration4 labs (own baseline)" },
  { id: "backpack", label: "life support: cabin air", source: "station gas sensor, uncalibrated index" },
];

export type PartStatuses = Partial<Record<PartId, TagStatus>>;

const TAG: Record<Status, TagStatus> = { green: "ok", amber: "warn", red: "fail" };

export type PartData = { result: EngineResult; readings: Reading[]; cabinAir: CabinAirSample[] };

const latest = (rs: Reading[], type: string) => rs.filter((r) => r.type === type).at(-1);
const indicator = (result: EngineResult, type: string) => result.readings.find((r) => r.indicator === type);
const system = (result: EngineResult, s: string) => result.body_systems.find((b) => b.system === s);

/** Status per part, from the engine result and the raw stream. "off" = no data yet. */
export function partStatuses({ result, readings, cabinAir }: PartData): PartStatuses {
  const sys = (s: string): TagStatus => {
    const b = system(result, s);
    const scored = result.readings.length > 0;
    return b && scored ? TAG[b.status] : "off";
  };
  const ind = (t: string, fallback: TagStatus = "off"): TagStatus => {
    const r = indicator(result, t);
    return r ? TAG[r.status] : fallback;
  };
  const check = latest(readings, "stress_mood_check")?.value;
  const chest: TagStatus =
    check === "hidden_stress" || check === "low_mood_no_stress"
      ? "warn"
      : check === "consistent"
        ? "ok"
        : latest(readings, "stress_prob")
          ? "info"
          : "off";
  return {
    helmet: sys("brain_behaviour"),
    ears: ind("sway_rms"),
    hands: ind("reaction_time_median", latest(readings, "reaction_time") ? "info" : "off"),
    legs: ind("sway_rms"),
    chest,
    abdomen: ind("lab_glucose"),
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
        ["reaction_median", `${fmt(latest(readings, "reaction_time_median"))}  (${z("reaction_time_median")})`],
        ["lapses", `${fmt(latest(readings, "lapses"))}  (${z("lapses")})`],
        ["sleep", `${fmt(latest(readings, "sleep_hours"))}  (${z("sleep_hours")})`],
        ["mood", `${fmt(latest(readings, "mood"))}  (${z("mood")})`],
      ];
    case "ears":
    case "legs":
      return [
        ["sway_rms", `${fmt(latest(readings, "sway_rms"), 3)}  (${z("sway_rms")})`],
        ["runs", String(readings.filter((r) => r.type === "sway_rms").length)],
      ];
    case "hands": {
      const taps = readings.filter((r) => r.type === "reaction_time");
      return [
        ["taps", String(taps.length)],
        ["last_tap", fmt(taps.at(-1))],
        ["median", fmt(latest(readings, "reaction_time_median"))],
        ["lapses", `${fmt(latest(readings, "lapses"))} (taps over 355 ms)`],
      ];
    }
    case "chest": {
      const probs = readings.filter((r) => r.type === "stress_prob").map((r) => Number(r.value));
      const last5 = probs.slice(-5);
      const level = last5.length ? `${Math.round((last5.reduce((a, b) => a + b, 0) / last5.length) * 100)}%` : "--";
      return [
        ["stress_level", `${level} (mean of last 5 windows)`],
        ["mood", fmt(latest(readings, "mood"))],
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
  if (part === "ears" || part === "legs") return readings.filter((r) => r.type === "sway_rms").map((r) => Number(r.value));
  if (part === "chest") return readings.filter((r) => r.type === "stress_prob").slice(-20).map((r) => Number(r.value));
  if (part === "backpack") return cabinAir.slice(-60).map((s) => s.value);
  return [];
}
