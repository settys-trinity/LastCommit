import { describe, expect, it } from "vitest";
import { cabinChange } from "./CabinAirPanel";
import { solarLine } from "../solar/SolarBanner";

describe("cabin air and solar line", () => {
  it("cabinChange waits for 12 samples, then compares the latest with the first-minute mean", () => {
    expect(cabinChange(Array(11).fill(300))).toBeNull();
    const c = cabinChange([...Array(12).fill(300), 312]);
    expect(c?.baseline).toBe(300);
    expect(c?.changePct).toBeCloseTo(4);
  });

  it("solarLine formats the DONKI event", () => {
    const data = { sepID: "2024-05-09T13:59:00-SEP-001", eventTime: "2024-05-09T13:59Z", instruments: [{}] };
    expect(solarLine(data)).toBe("2024-05-09T13:59 SEP-001  instruments: 1");
  });
});
