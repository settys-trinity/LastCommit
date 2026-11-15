import { describe, expect, it } from "vitest";
import { pickScenario } from "./AssessReport";
import type { Triage } from "../../types";

const t = (tier: Triage["tier"], reason: string): Triage => ({ tier, reason, action: "", acts: "crew", round_trip_s: 0.5, safe_wait_s: 600 });

describe("pickScenario", () => {
  it("tier 0 is nominal", () => expect(pickScenario(t(0, ""))).toBe("nominal"));
  it("air or oxygen findings are hypoxia", () => expect(pickScenario(t(2, "Cabin air index doubled"))).toBe("hypoxia"));
  it("everything else is fatigue", () => expect(pickScenario(t(3, "3 lapses after 4 h sleep"))).toBe("fatigue"));
});
