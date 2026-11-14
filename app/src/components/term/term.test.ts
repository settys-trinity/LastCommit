import { describe, expect, it } from "vitest";
import { leader } from "./KeyValue";
import { sparkline } from "./Sparkline";
import { splitTag } from "./StatusTag";
import { formatRoundTrip } from "../shell/format";

describe("term primitives", () => {
  it("sparkline scales to min..max and handles flat and empty input", () => {
    expect(sparkline([0, 7])).toBe("▁█");
    expect(sparkline([3, 3])).toBe("▁▁");
    expect(sparkline([])).toBe("");
  });

  it("leader pads labels to the same width", () => {
    expect(leader("tier", 10)).toBe("tier ...... ");
    expect(leader("round_trip", 14)).toBe("round_trip .... ");
  });

  it("splitTag finds a leading status tag", () => {
    expect(splitTag("[ OK ] baselines")).toEqual(["ok", " baselines"]);
    expect(splitTag("plain")).toBeNull();
  });

  it("formatRoundTrip shows seconds, minutes or no link", () => {
    expect(formatRoundTrip(0.5)).toBe("0.5 s");
    expect(formatRoundTrip(2640)).toBe("44 min");
    expect(formatRoundTrip(null)).toBe("no link");
  });
});
