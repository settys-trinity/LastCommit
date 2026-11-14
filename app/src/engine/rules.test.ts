// Rules engine tests. Owner: Ansh. Run: npm test (in app/)
import { describe, expect, it } from "vitest";
import type { Reading } from "../types";
import baselinesJson from "../data/baselines.json";
import knowledgeJson from "../data/knowledge.json";
import scenarioJson from "../data/scenario_mars_day143.json";
import { evaluate } from "./index";
import parity from "./parity_cases.json";
import { type Baselines, type Knowledge, scoreCrew, scoreIndicator } from "./rules";

const knowledge = knowledgeJson as unknown as Knowledge;
const baselines = baselinesJson as unknown as Baselines;
const scenario = scenarioJson as Reading[];
const IND = new Map(knowledge.indicators.map((i) => [i.type, i]));
const status = (t: string, h: number[], m: number | null, s: number | null) => scoreIndicator(IND.get(t)!, h, m, s).status;

let n = 0;
const r = (type: string, value: number, crew = "C003"): Reading => ({
  crew_id: crew,
  timestamp: `2026-11-15T12:00:${String(n++ % 60).padStart(2, "0")}Z`,
  type,
  value,
  unit: "",
  source: "replay",
});
const seq = (type: string, values: number[], crew = "C003"): Reading[] =>
  values.map((v, i) => ({ ...r(type, v, crew), timestamp: `2026-11-1${i}T07:30:00Z` }));
const sys = (res: { body_systems: { system: string; status: string }[] }, s: string) =>
  res.body_systems.find((b) => b.system === s)!.status;

describe("scoreIndicator matches data/score_reference.py", () => {
  it("passes the same 24 cases", () => {
    const g = baselines.crew.C003.markers.lab_glucose;
    const cases: [string, string, number[], number | null, number | null, string][] = [
      ["sleep night 1 (4.5 h)", "sleep_hours", [4.5], 7.5, 1.0, "amber"],
      ["sleep night 2 (5 h)", "sleep_hours", [4.5, 5], 7.5, 1.0, "amber"],
      ["sleep night 3 (4 h): 3 in a row <= 6 h", "sleep_hours", [4.5, 5, 4], 7.5, 1.0, "red"],
      ["sleep one bad night then recovery", "sleep_hours", [4.5, 5, 7.6], 7.5, 1.0, "green"],
      ["sleep 7.0 h exactly is normal", "sleep_hours", [7.0], 7.5, 1.0, "green"],
      ["sleep 6.5 h is amber (under 7)", "sleep_hours", [6.5], 7.5, 1.0, "amber"],
      ["mood 3 amber", "mood", [3], 4.2, 0.4, "amber"],
      ["mood 2, 2 not yet red", "mood", [2, 2], 4.2, 0.4, "amber"],
      ["mood 2,2,2 red", "mood", [2, 2, 2], 4.2, 0.4, "red"],
      ["mood 5 green", "mood", [5], 4.2, 0.4, "green"],
      ["RT +2 SD amber", "reaction_time_median", [340], 300, 20, "amber"],
      ["RT +3 SD red", "reaction_time_median", [360], 300, 20, "red"],
      ["RT faster than baseline is green", "reaction_time_median", [240], 300, 20, "green"],
      ["RT with tiny baseline spread uses floor (15 ms)", "reaction_time_median", [320], 300, 2, "green"],
      ["lapses 0 -> 3 with zero spread, floor 1", "lapses", [3], 0, 0, "red"],
      ["lapses 0 -> 2", "lapses", [2], 0, 0, "amber"],
      ["lapses unchanged", "lapses", [0], 0, 0, "green"],
      ["sway +3 SD red", "sway_rms", [0.056], 0.041, 0.005, "red"],
      ["C003 glucose 75 (baseline) green", "lab_glucose", [75], g.mean, g.spread, "green"],
      ["C003 glucose 62 lab-flagged low -> amber", "lab_glucose", [62], g.mean, g.spread, "amber"],
      ["C003 glucose 103 high: amber, NOT red", "lab_glucose", [103], g.mean, g.spread, "amber"],
      ["glucose 54 is not below 54: amber", "lab_glucose", [54], g.mean, g.spread, "amber"],
      ["glucose 53 red (ADA level 2)", "lab_glucose", [53], g.mean, g.spread, "red"],
      ["glucose 250 red (placeholder limit)", "lab_glucose", [250], g.mean, g.spread, "red"],
    ];
    expect(cases).toHaveLength(24);
    for (const [name, t, h, m, s, want] of cases) expect(status(t, h, m, s), name).toBe(want);
  });

  it(`agrees on ${parity.cases.length} generated cases (data/make_parity_cases.py)`, () => {
    const bad = parity.cases.filter((c) => status(c.type, c.history, c.mean, c.spread) !== c.expected);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe("body systems", () => {
  it("one amber indicator leaves the system green", () => {
    const res = scoreCrew([r("sleep_hours", 6.5)], "C003", knowledge, baselines);
    expect(res.readings[0].status).toBe("amber");
    expect(sys(res, "brain_behaviour")).toBe("green");
  });

  it("two independent amber indicators turn it amber", () => {
    const res = scoreCrew([r("sleep_hours", 6.5), r("mood", 3)], "C003", knowledge, baselines);
    expect(sys(res, "brain_behaviour")).toBe("amber");
  });

  it("slow median and lapses (correlated) count once", () => {
    // 3 baseline runs each, then a slow run: RT z 2.0 amber, lapses z 2.0 amber
    const rt = seq("reaction_time_median", [300, 300, 300, 330]);
    const lp = seq("lapses", [0, 0, 0, 2]);
    const res = scoreCrew([...rt, ...lp], "C003", knowledge, baselines);
    expect(res.readings.map((x) => x.status)).toEqual(["amber", "amber"]);
    expect(sys(res, "brain_behaviour")).toBe("green");
  });

  it("a red indicator turns only its own system red", () => {
    const res = scoreCrew([r("lab_glucose", 53)], "C003", knowledge, baselines);
    expect(res.body_systems).toEqual([
      { system: "brain_behaviour", status: "green" },
      { system: "neurovestibular", status: "green" },
      { system: "metabolism", status: "red" },
    ]);
  });
});

describe("baselines", () => {
  it("builds a personal baseline from the first 3 runs, then z applies", () => {
    const runs = seq("reaction_time_median", [300, 310, 290]);
    expect(scoreCrew(runs, "C003", knowledge, baselines).readings[0].z).toBeNull();
    const res = scoreCrew([...runs, { ...runs[0], timestamp: "2026-11-19T07:30:00Z", value: 360 }], "C003", knowledge, baselines);
    expect(res.readings[0]).toEqual({ indicator: "reaction_time_median", z: 4, status: "red" }); // sd 10 floored to 15 ms
  });

  it("uses baselines.json for lab types; GUEST has none", () => {
    const c = scoreCrew([r("lab_glucose", 90)], "C003", knowledge, baselines).readings[0];
    expect(c.z).toBeGreaterThan(2); // 90 vs mean 71.3, spread 8.1
    const g = scoreCrew([r("lab_glucose", 90, "GUEST")], "GUEST", knowledge, baselines).readings[0];
    expect(g).toEqual({ indicator: "lab_glucose", z: null, status: "green" });
  });

  it("scores crew members separately and sorts by timestamp", () => {
    const c1 = seq("sleep_hours", [5, 5, 5], "C001");
    const res = scoreCrew([...c1.reverse(), r("sleep_hours", 5, "C002")], "C002", knowledge, baselines);
    expect(res.readings[0].status).toBe("amber"); // C001's streak does not reach C002
  });
});

describe("evaluate: Mars day 143 scenario with the real scoring", () => {
  it("is amber on nights 1-2 and red with crew acting on night 3 (Mars)", () => {
    const sleep = scenario.filter((x) => x.type === "sleep_hours");
    const tiers = [1, 2, 3].map((k) => evaluate(sleep.slice(0, k), "C003", "mars").triage.tier);
    expect(tiers).toEqual([1, 1, 2]);
    const night3 = evaluate(sleep, "C003", "mars");
    expect(night3.triage.reason).toBe("sleep_hours red: 3 readings in a row at 6 h or less");
    expect(night3.triage.action).toBe(IND.get("sleep_hours")!.action.red);
    expect(sys(night3, "brain_behaviour")).toBe("red");
  });

  it("whole scenario: per-tap reaction_time is ignored, shape matches the contract", () => {
    const res = evaluate(scenario, "C003", "mars");
    expect(Object.keys(res)).toEqual(["crew_id", "timestamp", "readings", "body_systems", "triage"]);
    expect(res.readings.map((x) => x.indicator)).toEqual(["sleep_hours", "mood", "sway_rms"]);
    expect(res.timestamp).toBe("2026-11-15T11:42:20Z");
    expect(evaluate(scenario, "C003", "iss").triage.tier).toBe(3);
    expect(evaluate(scenario, "C003", "conjunction").triage.tier).toBe(2);
  });

  it("all green gives tier 0", () => {
    const res = evaluate([r("sleep_hours", 8), r("lab_glucose", 75)], "C003", "mars");
    expect(res.triage).toMatchObject({ tier: 0, acts: "none", reason: "", action: "" });
  });
});
