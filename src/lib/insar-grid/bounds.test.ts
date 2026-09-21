import { describe, it, expect } from "vitest";
import { computeFeatureCollectionBounds, boundsToLngLatBoundsLike } from "./bounds";

// Real geometry shape for grid_id 0, pair 1 - the same fixture used
// elsewhere in this codebase's InSAR tests (copied from the live-verified
// production import), not invented.
const REAL_CELL_0_POLYGON = {
  type: "Polygon" as const,
  coordinates: [
    [
      [87.2424513036009, 23.62916577636832],
      [87.24245263387706, 23.629888387627624],
      [87.24166832597297, 23.62988961130117],
      [87.241667, 23.629166999999995],
      [87.2424513036009, 23.62916577636832],
    ],
  ],
};

function featureWithPolygon(coordinates: unknown) {
  return { type: "Feature", geometry: { type: "Polygon", coordinates }, properties: {} };
}

describe("computeFeatureCollectionBounds", () => {
  it("returns null for an empty feature collection", () => {
    expect(computeFeatureCollectionBounds({ features: [] })).toBeNull();
  });

  it("returns null for a null/undefined input", () => {
    expect(computeFeatureCollectionBounds(null)).toBeNull();
    expect(computeFeatureCollectionBounds(undefined)).toBeNull();
  });

  it("returns null when features is missing or not an array", () => {
    expect(computeFeatureCollectionBounds({})).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(computeFeatureCollectionBounds({ features: "nope" } as any)).toBeNull();
  });

  it("computes exact min/max for a single real polygon", () => {
    const bounds = computeFeatureCollectionBounds({ features: [{ geometry: REAL_CELL_0_POLYGON }] });
    expect(bounds).not.toBeNull();
    // Min/max come from whichever ring vertex is actually smallest/largest
    // - the ring isn't axis-aligned, so these are not simply the first
    // point's coordinates. Computed directly from the 5 real ring vertices.
    expect(bounds!.minLng).toBeCloseTo(87.241667, 6);
    expect(bounds!.maxLng).toBeCloseTo(87.24245263387706, 6);
    expect(bounds!.minLat).toBeCloseTo(23.62916577636832, 6);
    expect(bounds!.maxLat).toBeCloseTo(23.62988961130117, 6);
  });

  it("expands across multiple polygons (adjacent grid cells)", () => {
    const cellA = featureWithPolygon([
      [
        [10, 10],
        [10, 11],
        [11, 11],
        [11, 10],
        [10, 10],
      ],
    ]);
    const cellB = featureWithPolygon([
      [
        [20, 20],
        [20, 21],
        [21, 21],
        [21, 20],
        [20, 20],
      ],
    ]);
    const bounds = computeFeatureCollectionBounds({ features: [cellA, cellB] });
    expect(bounds).toEqual({ minLng: 10, minLat: 10, maxLng: 21, maxLat: 21 });
  });

  it("handles negative and mixed-sign coordinates correctly", () => {
    const cell = featureWithPolygon([
      [
        [-5, -5],
        [-5, 3],
        [4, 3],
        [4, -5],
        [-5, -5],
      ],
    ]);
    const bounds = computeFeatureCollectionBounds({ features: [cell] });
    expect(bounds).toEqual({ minLng: -5, minLat: -5, maxLng: 4, maxLat: 3 });
  });

  it("supports MultiPolygon geometry defensively", () => {
    const feature = {
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ],
          [
            [
              [5, 5],
              [5, 6],
              [6, 6],
              [6, 5],
              [5, 5],
            ],
          ],
        ],
      },
    };
    const bounds = computeFeatureCollectionBounds({ features: [feature] });
    expect(bounds).toEqual({ minLng: 0, minLat: 0, maxLng: 6, maxLat: 6 });
  });

  it("never throws on malformed/missing geometry - skips it instead", () => {
    const badFeatures = [
      { geometry: null },
      { geometry: undefined },
      {},
      { geometry: { type: "Point", coordinates: [1, 2] } },
      { geometry: { type: "Polygon" } }, // missing coordinates
      { geometry: { type: "Polygon", coordinates: "not-an-array" } },
      { geometry: { type: "Polygon", coordinates: [[[1, "x"]]] } }, // non-numeric point
      { geometry: { type: "Polygon", coordinates: [[[NaN, 1]]] } }, // non-finite
    ];
    expect(() => computeFeatureCollectionBounds({ features: badFeatures })).not.toThrow();
    expect(computeFeatureCollectionBounds({ features: badFeatures })).toBeNull();
  });

  it("ignores malformed features but still uses the valid ones in the same collection", () => {
    const valid = featureWithPolygon([
      [
        [1, 1],
        [1, 2],
        [2, 2],
        [2, 1],
        [1, 1],
      ],
    ]);
    const bounds = computeFeatureCollectionBounds({ features: [{ geometry: null }, valid] });
    expect(bounds).toEqual({ minLng: 1, minLat: 1, maxLng: 2, maxLat: 2 });
  });
});

describe("boundsToLngLatBoundsLike", () => {
  it("converts to MapLibre's [[west, south], [east, north]] shape", () => {
    const result = boundsToLngLatBoundsLike({ minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 });
    expect(result).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
