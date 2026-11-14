// Same cases as bridge/test_stress.py and ml/stress_feed.py, so Python and TypeScript agree.
import { describe, expect, it } from "vitest";
import { checkStressMood } from "./stressMoodCheck";

const high = [0.9, 0.9, 0.9, 0.9, 0.9];
const low = [0.1, 0.1, 0.1, 0.1, 0.1];

describe("checkStressMood", () => {
  it("stressed body + good mood -> hidden_stress (flag)", () => {
    const c = checkStressMood(4, high);
    expect(c.result).toBe("hidden_stress");
    expect(c.flag).toBe(true);
    expect(c.stressLevel).toBe(0.9);
  });
  it("stressed body + low mood -> consistent", () => {
    expect(checkStressMood(2, high).result).toBe("consistent");
  });
  it("calm body + low mood -> low_mood_no_stress (flag)", () => {
    const c = checkStressMood(1, low);
    expect(c.result).toBe("low_mood_no_stress");
    expect(c.flag).toBe(true);
  });
  it("calm body + mood 3 -> consistent", () => {
    expect(checkStressMood(3, low).result).toBe("consistent");
  });
  it("borderline stress -> uncertain, no flag", () => {
    const c = checkStressMood(5, [0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(c.result).toBe("uncertain");
    expect(c.flag).toBe(false);
  });
  it("no mood or fewer than 5 windows -> no_data", () => {
    expect(checkStressMood(null, high).result).toBe("no_data");
    expect(checkStressMood(4, [0.9, 0.9, 0.9, 0.9]).result).toBe("no_data");
  });
  it("uses only the last 5 windows", () => {
    expect(checkStressMood(4, [0.0, 0.0, ...high]).result).toBe("hidden_stress");
  });
});
