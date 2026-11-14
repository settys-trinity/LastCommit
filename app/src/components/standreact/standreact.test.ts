import { describe, expect, it } from "vitest";
import type { Reading } from "../../types";
import { latestRun, progressBar } from "./StandReactView";
import { simulatedRun } from "../../hooks/useBridgeCommands";
import { stationMessage } from "../../hooks/useStationSync";

const rd = (type: string, value: number): Reading => ({
  crew_id: "C003", timestamp: "2026-11-15T11:42:00Z", type, value, unit: "", source: "station",
});

describe("STAND-REACT and station helpers", () => {
  it("latestRun picks the current or the last finished run", () => {
    const a = [rd("reaction_time", 300), rd("lapses", 0), rd("reaction_time", 400), rd("lapses", 1), rd("reaction_time", 500)];
    expect(latestRun(a, true).map((r) => r.value)).toEqual([500]);
    expect(latestRun(a, false).map((r) => r.value)).toEqual([400, 1]);
  });

  it("progressBar fills by elapsed seconds", () => {
    expect(progressBar(12)).toBe("[############........] 12/20 s");
    expect(progressBar(99)).toBe("[####################] 20/20 s");
  });

  it("simulatedRun makes 8 taps then sway, median and lapses over 355 ms", () => {
    const run = simulatedRun("C003", 0, () => 0.5); // every tap 365 ms
    expect(run.map((r) => r.type)).toEqual([...Array(8).fill("reaction_time"), "sway_rms", "reaction_time_median", "lapses"]);
    expect(run.at(-2)!.value).toBe(365);
    expect(run.at(-1)!.value).toBe(8);
  });

  it("stationMessage pads line 1 to 16 characters (C7)", () => {
    expect(stationMessage(2)).toBe("ACT NOW         CREW MED OFFICER");
    expect(stationMessage(0)).toBe("ALL CLEAR       ");
  });
});
