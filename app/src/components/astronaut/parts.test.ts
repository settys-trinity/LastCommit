import { describe, expect, it } from "vitest";
import { evaluate } from "../../engine";
import type { Reading } from "../../types";
import scenario from "../../data/scenario_mars_day143.json";
import { checkinReading, hint, PARTS, partRows, partSeries, partStatuses } from "./parts";

const readings = scenario as Reading[];
const data = { result: evaluate(readings, "C003", "mars"), readings, cabinAir: [] };

describe("astronaut parts", () => {
  it("maps the Mars scenario to part statuses", () => {
    const s = partStatuses(data);
    expect(s.visor).toBe("fail"); // three short nights: sleep red
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

  it("has one hotspot per part and a hover hint for each", () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(7);
    expect(hint("hands")).toBe("Hands: click here to open the reaction time test");
    expect(hint("abdomen")).toBe("Abdomen: click here to see the blood glucose result");
  });

  it("makes six-field check-in readings", () => {
    const r = checkinReading("C003", "mood", 2, new Date("2026-11-15T08:00:00.123Z"));
    expect(r).toEqual({ crew_id: "C003", timestamp: "2026-11-15T08:00:00Z", type: "mood", value: 2, unit: "score_1_5", source: "checkin" });
  });
});
