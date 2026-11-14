// Owner: Ansh. Run: npm test (in app/)
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BaselinePanel } from "./BaselinePanel";
import { baselineRows, fmt } from "./baselineRows";

describe("baselineRows", () => {
  it("gives C003 four markers, the scored one (glucose) first", () => {
    const rows = baselineRows("C003");
    expect(rows.map((r) => r.type)).toEqual(["lab_glucose", "lab_hemoglobin", "lab_wbc", "lab_calcium"]);
    expect(rows.filter((r) => r.scored).map((r) => r.type)).toEqual(["lab_glucose"]);
    const g = rows[0];
    expect(g.draws.map((d) => d.value)).toEqual([77, 62, 75]);
    expect(g.draws.map((d) => d.outsideRange)).toEqual([false, true, false]); // 62 is under 65
    expect(g.study).toBe("OSD-575");
  });

  it("marks a spread raised to the floor (C003 white cells)", () => {
    const wbc = baselineRows("C003").find((r) => r.type === "lab_wbc")!;
    expect(wbc.spreadIsFloor).toBe(true);
    expect(wbc.unit).toBe("×10³/µL");
  });

  it("is empty for GUEST and unknown IDs", () => {
    expect(baselineRows("GUEST")).toEqual([]);
    expect(baselineRows("C999")).toEqual([]);
  });

  it("every crew member C001-C004 has all four markers with three draws", () => {
    for (const id of ["C001", "C002", "C003", "C004"]) {
      const rows = baselineRows(id);
      expect(rows).toHaveLength(4);
      for (const r of rows) expect(r.draws.filter((d) => d.value !== null)).toHaveLength(3);
    }
  });

  it("formats numbers to 1 dp from 10 up, 2 dp below", () => {
    expect([fmt(71.333), fmt(8.145), fmt(0.252)]).toEqual(["71.3", "8.14", "0.25"]);
  });
});

describe("BaselinePanel", () => {
  it("renders the title, values and OSDR sources for C003", () => {
    const html = renderToStaticMarkup(<BaselinePanel crewId="C003" />);
    expect(html).toContain("NASA OSDR Inspiration4 baseline");
    expect(html).toContain("71.3 ± 8.14");
    expect(html).toContain("https://osdr.nasa.gov/bio/repo/data/studies/OSD-575");
    expect(html).toContain("https://osdr.nasa.gov/bio/repo/data/studies/OSD-569");
    expect(html).toContain("not a");
  });

  it("explains there is no baseline for GUEST", () => {
    const html = renderToStaticMarkup(<BaselinePanel crewId="GUEST" />);
    expect(html).toContain("No pre-flight baseline for GUEST");
    expect(html).not.toContain("<table");
  });
});
