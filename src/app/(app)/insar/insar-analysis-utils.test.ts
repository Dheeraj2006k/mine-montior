import { describe, it, expect } from "vitest";
import { computeInsarPairSummary, buildLosHistogram, buildCoherenceHistogram } from "./insar-analysis-utils";
import type { InsarGridFeature } from "@/lib/insar-grid/types";

// Real values for grid_id 0/17/41, pair 1 - the same fixtures used in the
// Phase 6 API tests (copied from the live-verified production import), not
// invented. grid_id=41's LOS displacement is genuinely null.
function feature(props: Partial<InsarGridFeature["properties"]> & { grid_id: number }): InsarGridFeature {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
    properties: {
      pair: 1,
      reference_date: "2026-06-29",
      secondary_date: "2026-07-11",
      temporal_baseline_days: 12,
      los_displacement_m: null,
      los_displacement_mm: null,
      coherence: 0.5,
      cell_coherence_quality: "GOOD",
      incidence_angle_rad: null,
      look_vector_phi_rad: null,
      look_vector_theta_rad: null,
      ...props,
    },
  };
}

const REAL_FEATURES: InsarGridFeature[] = [
  feature({ grid_id: 0, los_displacement_mm: 0.6510872044600546, coherence: 0.2957930266857147, cell_coherence_quality: "LOW" }),
  feature({ grid_id: 17, los_displacement_mm: -22.86035753786564, coherence: 0.5204799771308899, cell_coherence_quality: "GOOD" }),
  feature({ grid_id: 41, los_displacement_mm: null, los_displacement_m: null, coherence: 0.10813240706920624, cell_coherence_quality: "LOW" }),
];

describe("computeInsarPairSummary", () => {
  it("counts total cells and splits by LOS availability", () => {
    const s = computeInsarPairSummary(1, REAL_FEATURES);
    expect(s.pair).toBe(1);
    expect(s.totalCells).toBe(3);
    expect(s.cellsWithLos).toBe(2);
    expect(s.cellsWithoutLos).toBe(1);
  });

  it("excludes null LOS from mean/median/min/max - never treats missing as 0", () => {
    const s = computeInsarPairSummary(1, REAL_FEATURES);
    // Only 0.651 and -22.860 contribute; if the null were coerced to 0 the
    // mean/min would be very different.
    expect(s.meanLosMm).toBeCloseTo((0.6510872044600546 + -22.86035753786564) / 2, 8);
    expect(s.minLosMm).toBeCloseTo(-22.86035753786564, 8);
    expect(s.maxLosMm).toBeCloseTo(0.6510872044600546, 8);
  });

  it("computes mean coherence across all cells (coherence is never null)", () => {
    const s = computeInsarPairSummary(1, REAL_FEATURES);
    const expected = (0.2957930266857147 + 0.5204799771308899 + 0.10813240706920624) / 3;
    expect(s.meanCoherence).toBeCloseTo(expected, 8);
  });

  it("counts GOOD/LOW coherence cells matching cell_coherence_quality, not a re-derived threshold", () => {
    const s = computeInsarPairSummary(1, REAL_FEATURES);
    expect(s.goodCoherenceCount).toBe(1);
    expect(s.lowCoherenceCount).toBe(2);
  });

  it("returns all-null LOS stats (not zeros) for an empty feature set", () => {
    const s = computeInsarPairSummary(3, []);
    expect(s.totalCells).toBe(0);
    expect(s.meanLosMm).toBeNull();
    expect(s.medianLosMm).toBeNull();
    expect(s.minLosMm).toBeNull();
    expect(s.maxLosMm).toBeNull();
    expect(s.meanCoherence).toBeNull();
  });

  it("returns null LOS stats when every cell in the pair has no LOS measurement", () => {
    const allNull = [feature({ grid_id: 1 }), feature({ grid_id: 2 })];
    const s = computeInsarPairSummary(2, allNull);
    expect(s.cellsWithLos).toBe(0);
    expect(s.cellsWithoutLos).toBe(2);
    expect(s.meanLosMm).toBeNull();
    expect(s.minLosMm).toBeNull();
    expect(s.maxLosMm).toBeNull();
  });

  it("median is the true middle value for an odd-length non-null sample", () => {
    const three = [
      feature({ grid_id: 1, los_displacement_mm: 1 }),
      feature({ grid_id: 2, los_displacement_mm: 5 }),
      feature({ grid_id: 3, los_displacement_mm: 9 }),
    ];
    expect(computeInsarPairSummary(1, three).medianLosMm).toBe(5);
  });
});

describe("buildLosHistogram", () => {
  it("excludes null LOS cells from the distribution entirely (not a 0mm bucket)", () => {
    const buckets = buildLosHistogram(REAL_FEATURES, 5);
    const total = buckets.reduce((a, b) => a + b.count, 0);
    expect(total).toBe(2); // only the 2 non-null values, not 3
  });

  it("returns an empty array when no cell has a LOS measurement", () => {
    const allNull = [feature({ grid_id: 1 }), feature({ grid_id: 2 })];
    expect(buildLosHistogram(allNull)).toEqual([]);
  });

  it("places values into contiguous fixed-width bins spanning min to max", () => {
    const buckets = buildLosHistogram(REAL_FEATURES, 5);
    // -22.86 falls in the [-25,-20) bin, 0.65 falls in the [0,5) bin.
    expect(buckets[0].count).toBeGreaterThan(0);
    expect(buckets[buckets.length - 1].count).toBeGreaterThan(0);
  });
});

describe("buildCoherenceHistogram", () => {
  it("always returns exactly 10 bins covering 0-1, with the 0.5 threshold on a boundary", () => {
    const buckets = buildCoherenceHistogram(REAL_FEATURES);
    expect(buckets).toHaveLength(10);
    expect(buckets[5].label.startsWith("0.5")).toBe(true);
  });

  it("counts every cell exactly once, including low-coherence ones (never dropped)", () => {
    const buckets = buildCoherenceHistogram(REAL_FEATURES);
    const total = buckets.reduce((a, b) => a + b.count, 0);
    expect(total).toBe(REAL_FEATURES.length);
  });

  it("places coherence exactly 1.0 into the last bin, not out of range", () => {
    const f = [feature({ grid_id: 1, coherence: 1 })];
    const buckets = buildCoherenceHistogram(f);
    expect(buckets[9].count).toBe(1);
  });
});
