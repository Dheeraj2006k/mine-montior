import { describe, it, expect } from "vitest";
import {
  insarFillColor,
  insarFillOpacity,
  insarFillColorExpression,
  insarFillOpacityExpression,
  INSAR_NO_DATA_COLOR,
} from "./insar-palette";

describe("insarFillColor", () => {
  it("returns the dedicated no-data color for null - never a data color, never green", () => {
    expect(insarFillColor(null)).toBe(INSAR_NO_DATA_COLOR);
  });

  it("returns the near-white neutral color at exactly 0mm", () => {
    expect(insarFillColor(0)).toBe("rgb(247, 247, 247)");
  });

  it("returns the strongest blue at the negative end of the domain", () => {
    expect(insarFillColor(-30)).toBe("rgb(33, 102, 172)");
  });

  it("returns the strongest red at the positive end of the domain", () => {
    expect(insarFillColor(30)).toBe("rgb(178, 24, 43)");
  });

  it("clamps values beyond the domain instead of extrapolating", () => {
    expect(insarFillColor(500)).toBe(insarFillColor(30));
    expect(insarFillColor(-500)).toBe(insarFillColor(-30));
  });

  it("handles real production-scale values (grid_id 0/17 pair 1, in mm) without throwing", () => {
    expect(() => insarFillColor(0.0006510872044600546 * 1000)).not.toThrow();
    expect(() => insarFillColor(-0.02286035753786564 * 1000)).not.toThrow();
    // grid_id 41 pair 1 has a genuinely null los_displacement_m - callers
    // must pass null through (never coerce to 0) to get the no-data color.
    expect(insarFillColor(null)).toBe(INSAR_NO_DATA_COLOR);
  });

  it("is a monotonic gradient between stops (negative side darker than neutral)", () => {
    expect(insarFillColor(-30)).not.toBe(insarFillColor(0));
    expect(insarFillColor(-15)).not.toBe(insarFillColor(-30));
    expect(insarFillColor(-15)).not.toBe(insarFillColor(0));
  });
});

describe("insarFillOpacity", () => {
  it("gives GOOD coherence a higher opacity than LOW", () => {
    expect(insarFillOpacity("GOOD")).toBeGreaterThan(insarFillOpacity("LOW"));
  });

  it("never fully hides LOW coherence cells (must stay visible, not treated as zero deformation)", () => {
    expect(insarFillOpacity("LOW")).toBeGreaterThan(0);
  });
});

describe("MapLibre expression builders mirror the plain functions", () => {
  it("insarFillColorExpression is a case/interpolate expression referencing los_displacement_mm", () => {
    const expr = insarFillColorExpression();
    expect(expr[0]).toBe("case");
    expect(JSON.stringify(expr)).toContain("los_displacement_mm");
    expect(JSON.stringify(expr)).toContain(INSAR_NO_DATA_COLOR);
  });

  it("insarFillOpacityExpression branches on cell_coherence_quality only", () => {
    const expr = insarFillOpacityExpression();
    expect(JSON.stringify(expr)).toContain("cell_coherence_quality");
    expect(JSON.stringify(expr)).toContain("GOOD");
  });
});
