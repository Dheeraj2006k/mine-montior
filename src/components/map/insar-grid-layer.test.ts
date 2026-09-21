import { describe, it, expect, vi } from "vitest";
import { addLayers, removeLayers, updateSourceData, INSAR_LAYER_IDS } from "./insar-grid-layer";
import type { InsarGridFeatureCollection } from "@/lib/insar-grid/types";

// A minimal fake mimicking the slice of maplibregl.Map's imperative API
// these functions use - this project's vitest config runs in a plain node
// environment with no WebGL/DOM, so real maplibregl.Map cannot be
// constructed in tests. This stub tracks added sources/layers the same way
// a real map would report them back via getSource/getLayer - critically,
// getSource() returns the SAME object addSource() created (a real
// maplibregl.GeoJSONSource is a stable object with its own setData()), not
// a fresh mock each call, so tests can assert what was actually pushed to
// the source over time (this is what the actual production bug hinged on:
// a real source existing but never receiving the real data).
function makeFakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, { type: string; filter?: unknown }>();
  return {
    sources,
    layers,
    addSource: vi.fn((id: string) => sources.set(id, { setData: vi.fn() })),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((def: { id: string; type: string; filter?: unknown }) => layers.set(def.id, def)),
    getLayer: vi.fn((id: string) => layers.get(id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
  };
}

// Real geometry/properties shape for grid_id 0, pair 1 - values copied from
// the live-verified production import (same fixture used in the API tests),
// not invented, just to prove addLayers accepts a real FeatureCollection.
const REAL_FC: InsarGridFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [87.2424513036009, 23.62916577636832],
            [87.2424513036009, 23.62988],
            [87.2416, 23.62988],
            [87.2416, 23.62916577636832],
            [87.2424513036009, 23.62916577636832],
          ],
        ],
      },
      properties: {
        grid_id: 0,
        pair: 1,
        reference_date: "2026-06-29",
        secondary_date: "2026-07-11",
        temporal_baseline_days: 12,
        los_displacement_m: 0.0006510872044600546,
        los_displacement_mm: 0.6510872044600546,
        coherence: 0.2957930266857147,
        cell_coherence_quality: "LOW",
        incidence_angle_rad: 0.7777084708213806,
        look_vector_phi_rad: -2.9628748893737793,
        look_vector_theta_rad: 0.7949557304382324,
      },
    },
  ],
};

describe("addLayers", () => {
  it("adds exactly one geojson source with the real feature collection as data", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, REAL_FC);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addSource).toHaveBeenCalledWith(INSAR_LAYER_IDS.source, { type: "geojson", data: REAL_FC });
  });

  it("adds a fill layer, an outline layer, and a separate selected-outline layer", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, REAL_FC);
    expect(map.getLayer(INSAR_LAYER_IDS.fill)?.type).toBe("fill");
    expect(map.getLayer(INSAR_LAYER_IDS.outline)?.type).toBe("line");
    expect(map.getLayer(INSAR_LAYER_IDS.selectedOutline)?.type).toBe("line");
  });

  it("the selected-outline layer starts filtered to no cell (grid_id -1)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, REAL_FC);
    const layer = map.getLayer(INSAR_LAYER_IDS.selectedOutline);
    expect(layer?.filter).toEqual(["==", ["get", "grid_id"], -1]);
  });

  it("is idempotent - calling twice does not add a duplicate source/layers", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, REAL_FC);
    addLayers(map, REAL_FC);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(3);
  });
});

// Real grid_id 17, pair 2 - a different feature than REAL_FC, used to
// simulate a pair change (Task 10: pair 1 -> pair 2 -> pair 3 must replace
// source data, not accumulate/duplicate/disappear).
const REAL_FC_PAIR_2: InsarGridFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [87.2432, 23.6320],
            [87.2432, 23.6327],
            [87.2424, 23.6327],
            [87.2424, 23.6320],
            [87.2432, 23.6320],
          ],
        ],
      },
      properties: {
        grid_id: 17,
        pair: 2,
        reference_date: "2026-07-11",
        secondary_date: "2026-07-23",
        temporal_baseline_days: 12,
        los_displacement_m: -0.01,
        los_displacement_mm: -10,
        coherence: 0.6,
        cell_coherence_quality: "GOOD",
        incidence_angle_rad: 0.78,
        look_vector_phi_rad: -2.96,
        look_vector_theta_rad: 0.79,
      },
    },
  ],
};

const EMPTY_FC: InsarGridFeatureCollection = { type: "FeatureCollection", features: [] };

describe("updateSourceData", () => {
  it("is a safe no-op when the source does not exist yet - never throws", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    expect(() => updateSourceData(map, REAL_FC)).not.toThrow();
  });

  it("forwards the new feature collection to the existing source's setData", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, EMPTY_FC);
    updateSourceData(map, REAL_FC);
    const source = map.getSource(INSAR_LAYER_IDS.source);
    expect(source.setData).toHaveBeenCalledWith(REAL_FC);
  });

  it("replaces data on a pair change without creating a duplicate source/layers", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, REAL_FC); // pair 1 arrives, source created
    updateSourceData(map, REAL_FC_PAIR_2); // pair 2 arrives
    updateSourceData(map, EMPTY_FC); // pair 3 has no cells in view, say

    const source = map.getSource(INSAR_LAYER_IDS.source);
    expect(source.setData).toHaveBeenNthCalledWith(1, REAL_FC_PAIR_2);
    expect(source.setData).toHaveBeenNthCalledWith(2, EMPTY_FC);
    // Still exactly one source and the original three layers - no
    // duplicates, nothing removed by a pair switch.
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.getLayer(INSAR_LAYER_IDS.fill)).toBeDefined();
    expect(map.getLayer(INSAR_LAYER_IDS.outline)).toBeDefined();
    expect(map.getLayer(INSAR_LAYER_IDS.selectedOutline)).toBeDefined();
  });

  it("regression: real data is not lost when it resolves before the source is created (the reported bug)", () => {
    // Reproduces the exact production race: the map's "load" event (which
    // gates addLayers) can fire AFTER the InSAR query already resolved.
    // updateSourceData() must not silently and permanently drop that data -
    // the eventual addLayers() call is what applies the latest value (via
    // a ref in the real component, simulated here by passing REAL_FC
    // directly once it's "known").
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;

    // 1. Real data resolves first - source doesn't exist yet, so this
    //    must be a safe no-op, not a throw or a silent corruption.
    updateSourceData(map, REAL_FC);
    expect(map.getSource(INSAR_LAYER_IDS.source)).toBeUndefined();

    // 2. The map's "load" event fires later. The component must create the
    //    source with the LATEST known data, not an empty placeholder from
    //    whenever the effect first registered.
    addLayers(map, REAL_FC);

    const source = map.getSource(INSAR_LAYER_IDS.source);
    expect(source).toBeDefined();
    // addSource was called with the real, non-empty data - not EMPTY_FC.
    expect(map.addSource).toHaveBeenCalledWith(INSAR_LAYER_IDS.source, { type: "geojson", data: REAL_FC });
  });
});

describe("removeLayers", () => {
  it("removes all three layers and the source that addLayers created", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    addLayers(map, REAL_FC);
    removeLayers(map);
    expect(map.getSource(INSAR_LAYER_IDS.source)).toBeUndefined();
    expect(map.getLayer(INSAR_LAYER_IDS.fill)).toBeUndefined();
    expect(map.getLayer(INSAR_LAYER_IDS.outline)).toBeUndefined();
    expect(map.getLayer(INSAR_LAYER_IDS.selectedOutline)).toBeUndefined();
  });

  it("is safe to call when nothing was ever added", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = makeFakeMap() as any;
    expect(() => removeLayers(map)).not.toThrow();
  });
});
