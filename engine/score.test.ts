// Run: node --test engine/   (Node 22.18+ / 24, no install needed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Baselines, Knowledge } from "../data/knowledge.types.ts";
import { Engine, type Reading } from "./engine.ts";
import { scoreIndicator } from "./score.ts";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const knowledge: Knowledge = load("../data/knowledge.json");
const baselines: Baselines = load("../data/baselines.json");
const scenario: Reading[] = load("../data/scenario_mars_day143.json");
const parity = load("./parity_cases.json").cases as
  { type: string; history: number[]; mean: number | null; spread: number | null; expected: string }[];

const IND = new Map(knowledge.indicators.map((i) => [i.type, i]));
const score = (t: string, h: number[], m: number | null, s: number | null) => scoreIndicator(IND.get(t)!, h, m, s).status;

const MARS_RT = 2640; // 44 min round trip, docs/delay_table.md demo value
const ISS_RT = 0.5;

// ---------------------------------------------------------------- the 24 cases in score_reference.py
test("same 24 cases as data/score_reference.py", () => {
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
  assert.equal(cases.length, 24);
  for (const [name, t, h, m, s, want] of cases) assert.equal(score(t, h, m, s), want, name);
});

test(`parity with score_reference.py on ${parity.length} generated cases`, () => {
  const bad = parity.filter((c) => score(c.type, c.history, c.mean, c.spread) !== c.expected);
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} cases differ from Python`);
});

// ---------------------------------------------------------------- body systems
function engineWith(readings: Partial<Reading>[], rt: number | null = MARS_RT) {
  const e = new Engine(knowledge, baselines, { round_trip_s: rt });
  let last = null;
  for (const r of readings) {
    last = e.ingest({ crew_id: "C003", timestamp: "2026-11-15T12:00:00Z", unit: "", source: "replay", ...r } as Reading) ?? last;
  }
  return { e, last: last! };
}
const sys = (res: { body_systems: { system: string; status: string }[] }, s: string) =>
  res.body_systems.find((b) => b.system === s)!.status;

test("one amber indicator leaves the body system green", () => {
  const { last } = engineWith([{ type: "sleep_hours", value: 6.5 }]);
  assert.equal(last.readings[0].status, "amber");
  assert.equal(sys(last, "brain_behaviour"), "green");
  assert.equal(last.triage.tier, 1);
  assert.equal(last.triage.acts, "crew");
});

test("two independent amber indicators turn the body system amber", () => {
  const { last } = engineWith([{ type: "sleep_hours", value: 6.5 }, { type: "mood", value: 3 }]);
  assert.equal(sys(last, "brain_behaviour"), "amber");
});

test("correlated amber indicators (slow median + lapses) count once", () => {
  const { e } = engineWith([]);
  e.setBaseline("C003", "reaction_time_median", 300, 20);
  e.setBaseline("C003", "lapses", 0, 0);
  e.ingest({ crew_id: "C003", timestamp: "t", type: "reaction_time_median", value: 340, unit: "ms", source: "replay" });
  const res = e.ingest({ crew_id: "C003", timestamp: "t", type: "lapses", value: 2, unit: "count", source: "replay" })!;
  assert.deepEqual(res.readings.map((r) => r.status), ["amber", "amber"]);
  assert.equal(sys(res, "brain_behaviour"), "green");
});

test("any red indicator turns its body system red, others stay green", () => {
  const { last } = engineWith([{ type: "lab_glucose", value: 53 }]);
  assert.equal(sys(last, "metabolism"), "red");
  assert.equal(sys(last, "brain_behaviour"), "green");
  assert.equal(sys(last, "neurovestibular"), "green");
});

// ---------------------------------------------------------------- triage and the Mars demo
test("Mars day 143: amber on nights 1-2, red and crew acts now on night 3", () => {
  const e = new Engine(knowledge, baselines, { round_trip_s: MARS_RT });
  const sleep = scenario.filter((r) => r.type === "sleep_hours").map((r) => e.ingest(r)!);
  assert.deepEqual(sleep.map((r) => r.triage.tier), [1, 1, 2]);
  const night3 = sleep[2];
  assert.equal(night3.triage.acts, "crew_medical_officer");
  assert.equal(night3.triage.reason, "sleep_hours red: 3 readings in a row at 6 h or less");
  assert.equal(night3.triage.action, IND.get("sleep_hours")!.action.red);
  assert.equal(night3.triage.round_trip_s, MARS_RT);
  assert.equal(night3.triage.safe_wait_s, 600);
  assert.equal(sys(night3, "brain_behaviour"), "red");
});

test("same readings on the ISS go to the flight surgeon (tier 3)", () => {
  const e = new Engine(knowledge, baselines, { round_trip_s: MARS_RT });
  let res = null;
  for (const r of scenario) res = e.ingest(r) ?? res;
  assert.equal(res!.triage.tier, 2);
  e.setRoundTrip(ISS_RT);
  const iss = e.result("C003", res!.timestamp);
  assert.equal(iss.triage.tier, 3);
  assert.equal(iss.triage.acts, "flight_surgeon");
  e.setRoundTrip(null); // solar conjunction: no link
  assert.equal(e.result("C003").triage.tier, 2);
});

test("whole Mars scenario: per-tap reaction_time is ignored, readings match the contract shape", () => {
  const e = new Engine(knowledge, baselines, { round_trip_s: MARS_RT });
  const results = scenario.map((r) => e.ingest(r));
  assert.equal(results.filter((r) => r === null).length, 5); // 5 per-tap reaction_time readings
  const last = results.filter(Boolean).at(-1)!;
  assert.deepEqual(Object.keys(last), ["crew_id", "timestamp", "readings", "body_systems", "triage"]);
  assert.deepEqual(last.readings.map((r) => r.indicator), ["sleep_hours", "mood", "sway_rms"]);
  assert.deepEqual(last.body_systems.map((b) => b.system), ["brain_behaviour", "neurovestibular", "metabolism"]);
  assert.equal(last.readings.find((r) => r.indicator === "sway_rms")!.z, null); // no sway baseline yet
});

test("worst indicator picks red over amber, then higher z", () => {
  const { e } = engineWith([]);
  e.setBaseline("C003", "reaction_time_median", 300, 20);
  e.setBaseline("C003", "sway_rms", 0.04, 0.005);
  e.ingest({ crew_id: "C003", timestamp: "t", type: "reaction_time_median", value: 345, unit: "ms", source: "replay" }); // z 2.25 amber
  const res = e.ingest({ crew_id: "C003", timestamp: "t", type: "sway_rms", value: 0.051, unit: "g", source: "replay" })!; // z 2.2 amber
  assert.equal(res.triage.tier, 1);
  assert.match(res.triage.reason, /^reaction_time_median amber/);
});

test("all green gives tier 0 and acts none", () => {
  const { last } = engineWith([{ type: "sleep_hours", value: 8 }, { type: "lab_glucose", value: 75 }]);
  assert.deepEqual(last.triage, { tier: 0, reason: "", action: "", acts: "none", round_trip_s: MARS_RT, safe_wait_s: 600 });
});

test("runtime baseline from the first 3 runs, then z applies", () => {
  const { e } = engineWith([]);
  const rt = (v: number) => e.ingest({ crew_id: "C001", timestamp: "t", type: "reaction_time_median", value: v, unit: "ms", source: "station" })!;
  for (const v of [300, 310, 290]) assert.equal(rt(v).readings[0].z, null);
  assert.deepEqual({ ...e.getBaseline("C001", "reaction_time_median") }, { mean: 300, spread: 10, from: "runtime" });
  const r = rt(360); // spread 10 floored to 15 ms -> z 4
  assert.equal(r.readings[0].z, 4);
  assert.equal(r.readings[0].status, "red");
});

test("lab baselines come from baselines.json; GUEST has none", () => {
  const e = new Engine(knowledge, baselines);
  const c = e.ingest({ crew_id: "C003", timestamp: "t", type: "lab_glucose", value: 90, unit: "mg/dL", source: "osdr" })!;
  assert.ok(c.readings[0].z != null && c.readings[0].z > 2); // 90 vs mean 71.3, spread 8.1
  const g = e.ingest({ crew_id: "GUEST", timestamp: "t", type: "lab_glucose", value: 90, unit: "mg/dL", source: "checkin" })!;
  assert.equal(g.readings[0].z, null);
  assert.equal(g.readings[0].status, "green");
});

test("crew members are scored separately; reset clears one crew member", () => {
  const e = new Engine(knowledge, baselines);
  for (const v of [5, 5, 5]) e.ingest({ crew_id: "C001", timestamp: "t", type: "sleep_hours", value: v, unit: "h", source: "checkin" });
  const c2 = e.ingest({ crew_id: "C002", timestamp: "t", type: "sleep_hours", value: 5, unit: "h", source: "checkin" })!;
  assert.equal(c2.readings[0].status, "amber"); // C001's streak does not leak into C002
  e.reset("C001");
  assert.equal(e.result("C001").readings.length, 0);
  assert.equal(e.result("C002").readings.length, 1);
});
