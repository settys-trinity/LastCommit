import { describe, expect, it } from "vitest";
import { findGroundReply, mmss, suggestVerdict, type Assessment, type GroundReply } from "./report";
import { sourceTag } from "../sensors/sim";

const a: Assessment = {
  crew_id: "C003", mission: "mars", tier: 2, who_acts: "crew_medical_officer",
  summary: "Low oxygen.", findings: [{ part: "chest", text: "SpO2 90%" }],
  do_now: ["Give oxygen", "Rest"], message_to_earth: "SpO2 90%, oxygen given.",
  time_b_s: 3.8, source: "live", made_at: "2026-11-15T11:42:30Z",
};

describe("report", () => {
  const g = (do_now: string[]): GroundReply => ({ scenario: "hypoxia", from: "Ground", headline: "h", diagnosis: "d", do_now, avoid: [], follow_up: "" });
  it("agrees when an action overlaps", () => {
    expect(suggestVerdict(a, g(["give oxygen"]))).toBe("agree");
  });
  it("differs when no action overlaps", () => {
    expect(suggestVerdict(a, g(["Return to Earth"]))).toBe("differ");
  });
  it("finds the reply for a scenario", () => {
    expect(findGroundReply({ replies: [g(["x"])] }, "hypoxia")?.scenario).toBe("hypoxia");
    expect(findGroundReply({ replies: [g(["x"])] }, "fatigue")).toBe(null);
  });
  it("formats the countdown", () => {
    expect(mmss(2640)).toBe("44:00");
    expect(mmss(-5)).toBe("0:00");
  });
  it("tags sources", () => {
    expect(sourceTag("station")).toBe("station");
    expect(sourceTag("simulation")).toBe("simulation");
    expect(sourceTag("replay")).toBe("preset");
    expect(sourceTag("ml_saved")).toBe("preset");
  });
});
