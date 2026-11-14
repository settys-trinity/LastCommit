import { describe, expect, it } from "vitest";
import { evaluate } from "../../engine";
import type { Reading } from "../../types";
import scenario from "../../data/scenario_mars_day143.json";
import { partRows, partSeries, partStatuses } from "./parts";

const readings = scenario as Reading[];
const data = { result: evaluate(readings, "C003", "mars"), readings, cabinAir: [] };

describe("astronaut parts", () => {
  it("maps the Mars scenario to part statuses", () => {
    const s = partStatuses(data);
    expect(s.helmet).toBe("fail"); // sleep red -> brain_behaviour red
    expect(s.backpack).toBe("off"); // no cabin air samples
    expect(s.abdomen).toBe("off"); // no lab reading in the scenario
  });

  it("is all off with no readings", () => {
    const empty = { result: evaluate([], "C003", "iss"), readings: [], cabinAir: [] };
    expect(Object.values(partStatuses(empty)).every((v) => v === "off")).toBe(true);
  });

  it("hands show the station taps", () => {
    const rows = Object.fromEntries(partRows("hands", data));
    expect(rows.taps).toBe(String(readings.filter((r) => r.type === "reaction_time").length));
    expect(partSeries("hands", data).length).toBeGreaterThan(0);
  });
});
