import { describe, expect, it } from "vitest";
import { evaluate } from "./index";
import type { Reading } from "../types";
import scenario from "../data/scenario_mars_day143.json";

const readings = scenario as Reading[];

describe("evaluate: Mars day 143 scenario, crew C003", () => {
  it("returns tier 2 (crew medical officer) on Mars", () => {
    const r = evaluate(readings, "C003", "mars");
    expect(r.triage.tier).toBe(2);
    expect(r.triage.acts).toBe("crew_medical_officer");
    expect(r.triage.round_trip_s).toBe(2640);
  });

  it("returns tier 3 (flight surgeon) on the ISS", () => {
    const r = evaluate(readings, "C003", "iss");
    expect(r.triage.tier).toBe(3);
    expect(r.triage.acts).toBe("flight_surgeon");
  });
});
