import { describe, expect, it } from "vitest";
import { route } from "./triage";
import { MISSIONS, SAFE_WAIT_S, earthCanAct, getMission } from "./delay";
import type { Worst } from "./score";

const red: Worst = { indicator: "sleep_hours", status: "red", z: 6, reason: "sleep_hours red: 3 nights at 6 h or less", action: "CMO reviews workload." };
const amber: Worst = { ...red, status: "amber", reason: "sleep_hours amber", action: "Rest." };
const green: Worst = { ...red, status: "green" };
const ids = MISSIONS.map((m) => m.id);

describe("delay table", () => {
  it("matches docs/delay_table.md", () => {
    expect(ids).toEqual(["iss", "moon", "mars", "conjunction"]);
    expect(getMission("iss").round_trip_s).toBe(0.5);
    expect(getMission("moon").round_trip_s).toBe(2.6);
    expect(getMission("mars").round_trip_s).toBe(2640);
    expect(getMission("conjunction").round_trip_s).toBeNull();
    expect(SAFE_WAIT_S).toBe(600);
    for (const m of MISSIONS) {
      expect(m.round_trip_s).toBe(m.one_way_s === null ? null : m.one_way_s * 2);
    }
  });

  it("unknown mission throws", () => {
    expect(() => route(red, "venus")).toThrow(/unknown missionId/);
  });

  it("earthCanAct: boundary at the safe wait, no link is false", () => {
    expect(earthCanAct(600)).toBe(true);
    expect(earthCanAct(600.1)).toBe(false);
    expect(earthCanAct(null)).toBe(false);
  });
});

describe.each(ids)("route on %s", (id) => {
  it("no finding (null) gives tier 0, nobody acts", () => {
    expect(route(null, id)).toEqual({ tier: 0, acts: "none", reason: "", action: "", round_trip_s: getMission(id).round_trip_s, safe_wait_s: 600 });
  });
  it("green gives tier 0", () => {
    expect(route(green, id).tier).toBe(0);
  });
  it("amber gives tier 1, crew, with reason and action", () => {
    expect(route(amber, id)).toMatchObject({ tier: 1, acts: "crew", reason: amber.reason, action: amber.action });
  });
});

describe("red: the delay decides", () => {
  it("ISS: tier 3, message Earth", () => {
    expect(route(red, "iss")).toEqual({ tier: 3, acts: "flight_surgeon", reason: red.reason, action: red.action, round_trip_s: 0.5, safe_wait_s: 600 });
  });
  it("Moon: tier 3, message Earth", () => {
    expect(route(red, "moon")).toMatchObject({ tier: 3, acts: "flight_surgeon" });
  });
  it("Mars: tier 2, crew acts now (amber LED)", () => {
    expect(route(red, "mars")).toEqual({ tier: 2, acts: "crew_medical_officer", reason: red.reason, action: red.action, round_trip_s: 2640, safe_wait_s: 600 });
  });
  it("Conjunction: tier 2, no link so the crew acts", () => {
    expect(route(red, "conjunction")).toMatchObject({ tier: 2, acts: "crew_medical_officer", round_trip_s: null });
  });
});
