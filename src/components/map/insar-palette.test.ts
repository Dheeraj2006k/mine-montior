import { describe, it, expect } from "vitest";
import { createExpression, v8, type StylePropertySpecification } from "@maplibre/maplibre-gl-style-spec";
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

describe("MapLibre expressions type-check against the real style-spec (not a mocked map)", () => {
  // Regression test for a production bug: insar-grid-layer.test.ts (and
  // every other test in this file above) exercises these expressions
  // against a hand-written fake map/query-builder stub, which happily
  // accepts any well-formed-looking array and never actually runs
  // MapLibre's expression type-checker. That let a real defect through:
  // insarFillColorExpression() used to nest raw hex-string stops inside an
  // `interpolate` that itself sits inside a `case` fallback branch. At
  // runtime, `map.addLayer()` compiled that paint property, MapLibre's
  // checker rejected it ("Type string is not interpolatable"), and
  // MapLibre caught that failure internally and fired a map `error` event
  // instead of throwing - so addLayers() in insar-grid-layer.tsx kept
  // running (source + outline layers + click handlers all got added
  // successfully), but the FILL layer - the actual colored polygons -
  // silently never got created. Nothing in the mocked-map test suite could
  // catch that, because nothing there parses real MapLibre expressions.
  // This test does, using the actual @maplibre/maplibre-gl-style-spec
  // type-checker the browser runs.
  // The v8 JSON spec object's plain `{ type: string, ... }` shape doesn't
  // structurally match createExpression()'s discriminated-union parameter
  // type, even though it's the exact real spec object MapLibre itself uses
  // at runtime - a TS-only friction, not a behavioral difference, so a
  // single explicit cast here is honest about what's happening.
  const fillColorSpec = v8.paint_fill["fill-color"] as unknown as StylePropertySpecification;
  const fillOpacitySpec = v8.paint_fill["fill-opacity"] as unknown as StylePropertySpecification;

  it("fill-color expression compiles successfully against the real fill-color spec", () => {
    const result = createExpression(insarFillColorExpression(), "paint_fill.fill-color", fillColorSpec);
    expect(result.result, result.result === "error" ? JSON.stringify(result.value) : "").toBe("success");
  });

  it("fill-opacity expression compiles successfully against the real fill-opacity spec", () => {
    const result = createExpression(insarFillOpacityExpression(), "paint_fill.fill-opacity", fillOpacitySpec);
    expect(result.result, result.result === "error" ? JSON.stringify(result.value) : "").toBe("success");
  });

  it("compiled fill-color expression evaluates real production-scale values without throwing", () => {
    const result = createExpression(insarFillColorExpression(), "paint_fill.fill-color", fillColorSpec);
    if (result.result !== "success") throw new Error("expression failed to compile");
    const evalFeature = (props: Record<string, unknown>) =>
      result.value.evaluate({ zoom: 15 } as never, { properties: props } as never);

    // grid_id 0 pair 1, real value (see route.test.ts fixtures)
    expect(() => evalFeature({ los_displacement_mm: 0.6510872044600546 })).not.toThrow();
    // grid_id 41 pair 1 - genuinely null LOS, must resolve to the no-data
    // color, never throw and never fall through to a default/black fill.
    const noDataColor = evalFeature({ los_displacement_mm: null });
    expect(String(noDataColor)).not.toBe("rgba(0, 0, 0, 1)");
  });
});
