import { describe, expect, it } from "vitest";
import { QUESTIONS, score, test, type Answers } from "./questionnaire";

const fine: Answers = { mood: 4, sleep_h: 8, stress: 2, focus: 4, symptom: "none" };

describe("questionnaire", () => {
  it("has Ansh's five questions", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(["mood", "sleep_h", "stress", "focus", "symptom"]);
  });

  it("reads the flag rules", () => {
    expect(test("value <= 3", 3)).toBe(true);
    expect(test("value < 7", 7)).toBe(false);
    expect(test("value != 'none'", "headache")).toBe(true);
  });

  it("all fine: doing well, no breathing offer", () => {
    expect(score(fine)).toEqual({ flags: [], label: "Doing well", offerBreathing: false });
  });

  it("one flag: take care", () => {
    expect(score({ ...fine, sleep_h: 6 }).label).toBe("Take care");
  });

  it("low mood and high stress: crew medical officer, breathing offered", () => {
    const s = score({ ...fine, mood: 2, stress: 5 });
    expect(s.flags.map((f) => f.id)).toEqual(["mood", "stress"]);
    expect(s.label).toBe("Check in with your crew medical officer");
    expect(s.offerBreathing).toBe(true);
  });
});
