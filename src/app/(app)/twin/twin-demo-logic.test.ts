import { describe, it, expect } from "vitest";
import {
  clampExtractionPct,
  pillarRemovedEvery,
  deriveIllustrativeSusceptibility,
  deriveHypotheticalScrub,
  formatConfiguredValue,
} from "./twin-demo-logic";

describe("clampExtractionPct", () => {
  it("clamps into 0-100", () => {
    expect(clampExtractionPct(-10)).toBe(0);
    expect(clampExtractionPct(150)).toBe(100);
    expect(clampExtractionPct(42)).toBe(42);
  });

  it("treats NaN as 0 rather than propagating it", () => {
    expect(clampExtractionPct(NaN)).toBe(0);
  });
});

describe("pillarRemovedEvery (B&P mode)", () => {
  it("removes nothing meaningful at 0% extraction (Infinity spacing)", () => {
    expect(pillarRemovedEvery(0)).toBe(Infinity);
  });

  it("removes every pillar at >=90% extraction", () => {
    expect(pillarRemovedEvery(90)).toBe(1);
    expect(pillarRemovedEvery(100)).toBe(1);
  });

  it("removes proportionally more often as extraction % rises", () => {
    const low = pillarRemovedEvery(10);
    const mid = pillarRemovedEvery(50);
    const high = pillarRemovedEvery(80);
    // "every Nth" - a SMALLER N means MORE frequent removal.
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it("stays within the real 0-100 slider range even for out-of-range input", () => {
    expect(pillarRemovedEvery(-5)).toBe(Infinity);
    expect(pillarRemovedEvery(200)).toBe(1);
  });
});

describe("deriveIllustrativeSusceptibility", () => {
  it("is null (not zero) when no live risk score exists yet", () => {
    expect(deriveIllustrativeSusceptibility({ maxLiveRisk: null, extractionPct: 50 })).toBeNull();
  });

  it("rises with extraction % for a fixed live risk score", () => {
    const low = deriveIllustrativeSusceptibility({ maxLiveRisk: 0.4, extractionPct: 0 })!;
    const high = deriveIllustrativeSusceptibility({ maxLiveRisk: 0.4, extractionPct: 100 })!;
    expect(high).toBeGreaterThan(low);
  });

  it("never exceeds 1 even at maximum risk and maximum extraction", () => {
    expect(deriveIllustrativeSusceptibility({ maxLiveRisk: 1, extractionPct: 100 })).toBeLessThanOrEqual(1);
  });

  it("clamps an out-of-range extraction % input before blending", () => {
    const overRange = deriveIllustrativeSusceptibility({ maxLiveRisk: 0.5, extractionPct: 500 })!;
    const atCap = deriveIllustrativeSusceptibility({ maxLiveRisk: 0.5, extractionPct: 100 })!;
    expect(overRange).toBeCloseTo(atCap, 10);
  });
});

describe("deriveHypotheticalScrub", () => {
  it("passes scrubT through unchanged outside longwall planning mode", () => {
    expect(deriveHypotheticalScrub({ scrubT: 0.5, hypotheticalDays: 30, planningMode: false, mineType: "longwall" })).toBe(0.5);
    expect(deriveHypotheticalScrub({ scrubT: 0.5, hypotheticalDays: 30, planningMode: true, mineType: "bord_and_pillar" })).toBe(0.5);
  });

  it("extrapolates forward (never backward) in longwall planning mode", () => {
    const result = deriveHypotheticalScrub({ scrubT: 0.5, hypotheticalDays: 30, planningMode: true, mineType: "longwall" });
    expect(result).toBeGreaterThanOrEqual(0.5);
  });

  it("never exceeds 1 regardless of the projection window", () => {
    const result = deriveHypotheticalScrub({ scrubT: 1, hypotheticalDays: 30, planningMode: true, mineType: "longwall" });
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe("formatConfiguredValue - unavailable configuration handling", () => {
  it("shows 'Not configured' for null/undefined/empty, never a fabricated value", () => {
    expect(formatConfiguredValue(null)).toBe("Not configured");
    expect(formatConfiguredValue(undefined)).toBe("Not configured");
    expect(formatConfiguredValue("")).toBe("Not configured");
  });

  it("formats a real configured value with its unit", () => {
    expect(formatConfiguredValue(4.5, "m")).toBe("4.5 m");
    expect(formatConfiguredValue("active")).toBe("active");
  });
});

describe("no risk-engine coupling (Phase 11 mandatory rule)", () => {
  it("this module exports only pure display/visualization helpers - none call out to risk/alert/prediction/InSAR code", async () => {
    const mod = await import("./twin-demo-logic");
    const exportNames = Object.keys(mod);
    expect(exportNames).toEqual(
      expect.arrayContaining([
        "clampExtractionPct",
        "pillarRemovedEvery",
        "deriveIllustrativeSusceptibility",
        "deriveHypotheticalScrub",
        "formatConfiguredValue",
      ]),
    );
    // None of these functions accept or return anything resembling a
    // written-back alert/risk/InSAR identifier - a structural guard against
    // accidentally growing a risk = f(twinState) coupling here later.
    for (const name of exportNames) {
      expect(name).not.toMatch(/alert|notif|insar/i);
    }
  });
});
