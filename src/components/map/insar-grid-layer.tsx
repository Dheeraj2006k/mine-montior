"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { InsarGridFeatureCollection } from "@/lib/insar-grid/types";
import { computeFeatureCollectionBounds, boundsToLngLatBoundsLike } from "@/lib/insar-grid/bounds";
import { insarFillColorExpression, insarFillOpacityExpression } from "./insar-palette";

// Generous enough to show the whole ~1,591-cell grid with breathing room,
// capped low enough that a single-cell (or near-empty, heavily filtered)
// result never snaps the camera into an absurd close-up of an 80m square.
const FIT_BOUNDS_PADDING_PX = 48;
const FIT_BOUNDS_MAX_ZOOM = 17;

const SOURCE_ID = "insar-grid-source";
const FILL_LAYER_ID = "insar-grid-fill";
const OUTLINE_LAYER_ID = "insar-grid-outline";
const SELECTED_OUTLINE_LAYER_ID = "insar-grid-outline-selected";

const EMPTY_FC: InsarGridFeatureCollection = { type: "FeatureCollection", features: [] };

export const INSAR_LAYER_IDS = {
  source: SOURCE_ID,
  fill: FILL_LAYER_ID,
  outline: OUTLINE_LAYER_ID,
  selectedOutline: SELECTED_OUTLINE_LAYER_ID,
};

// Exported for unit testing against a fake map stub (no real WebGL/DOM
// context available in this project's node-environment test runner) -
// these are the same functions the component below calls internally.
export function addLayers(map: maplibregl.Map, data: InsarGridFeatureCollection) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, { type: "geojson", data: data as unknown as GeoJSON.FeatureCollection });

  map.addLayer({
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "fill-color": insarFillColorExpression() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "fill-opacity": insarFillOpacityExpression() as any,
    },
  });

  map.addLayer({
    id: OUTLINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "rgba(255,255,255,0.35)", "line-width": 0.5 },
  });

  // Distinct highlight layer for the selected cell only - filtered
  // dynamically, never styled by mutating the shared fill/outline layers.
  map.addLayer({
    id: SELECTED_OUTLINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    // MapLibre paint properties take literal colors, not CSS var() - this
    // mirrors --accent-strong's dark-mode value (see globals.css), same as
    // the existing AOI marker border color in mine-map.tsx.
    paint: { "line-color": "#54d8ff", "line-width": 2.5 },
    filter: ["==", ["get", "grid_id"], -1],
  });
}

export function removeLayers(map: maplibregl.Map) {
  for (const id of [SELECTED_OUTLINE_LAYER_ID, OUTLINE_LAYER_ID, FILL_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

/**
 * Pushes a new feature collection into the already-created GeoJSON source
 * (e.g. on a pair change). A safe no-op if the source doesn't exist yet -
 * callers must not assume addLayers() has already run.
 */
export function updateSourceData(map: maplibregl.Map, data: InsarGridFeatureCollection) {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData(data as unknown as GeoJSON.FeatureCollection);
}

export function InsarGridLayer({
  map,
  featureCollection,
  selectedGridId,
  onSelectCell,
  fitBoundsOnLoad = false,
}: {
  map: maplibregl.Map | null;
  featureCollection: InsarGridFeatureCollection | null;
  selectedGridId: number | null;
  onSelectCell: (gridId: number) => void;
  /**
   * Opt-in only (default false) - when true, frames the map to the real
   * grid extent whenever a new, non-empty feature collection arrives
   * (initial load, or a pair switch that resolves new data). Deliberately
   * NOT the default: the dashboard's shared sensor map must never be
   * silently recentered onto the InSAR grid - only the dedicated /insar
   * analysis page opts in (see MineMap's InsarControl.fitBoundsOnLoad).
   */
  fitBoundsOnLoad?: boolean;
}) {
  const onSelectCellRef = useRef(onSelectCell);
  useEffect(() => {
    onSelectCellRef.current = onSelectCell;
  }, [onSelectCell]);

  // Always holds the LATEST featureCollection, readable from setup() below
  // even when it executes asynchronously (deferred until the map's "load"
  // event fires - see map.once("load", setup)).
  //
  // Bug this fixes: setup() used to close over `featureCollection` at the
  // moment this effect was REGISTERED (dependency array [map], so it only
  // re-registers when the map instance itself changes). On first mount the
  // map's style is virtually never loaded yet, so setup() is deferred via
  // map.once("load", ...) - but the InSAR query (a network fetch) very
  // often resolves with real data BEFORE that "load" event fires. When it
  // does, the separate setData effect below finds map.getSource(SOURCE_ID)
  // doesn't exist yet (addLayers hasn't run) and silently no-ops. Then
  // "load" fires and the deferred setup() runs addLayers() with the STALE
  // closed-over value - still the empty placeholder from first render -
  // permanently creating a real, but permanently empty, GeoJSON source.
  // Reading a ref instead of a closed-over value at the moment setup()
  // actually executes fixes this regardless of which side wins the race.
  const featureCollectionRef = useRef(featureCollection);
  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const gridId = feature?.properties?.grid_id;
      if (typeof gridId === "number") onSelectCellRef.current(gridId);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const setup = () => {
      addLayers(map, featureCollectionRef.current ?? EMPTY_FC);
      map.on("click", FILL_LAYER_ID, handleClick);
      map.on("mouseenter", FILL_LAYER_ID, handleEnter);
      map.on("mouseleave", FILL_LAYER_ID, handleLeave);
    };

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    return () => {
      map.off("click", FILL_LAYER_ID, handleClick);
      map.off("mouseenter", FILL_LAYER_ID, handleEnter);
      map.off("mouseleave", FILL_LAYER_ID, handleLeave);
      map.off("load", setup);
      if (map.getStyle()) removeLayers(map);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    updateSourceData(map, featureCollection ?? EMPTY_FC);
  }, [map, featureCollection]);

  useEffect(() => {
    if (!map || !map.getLayer(SELECTED_OUTLINE_LAYER_ID)) return;
    map.setFilter(SELECTED_OUTLINE_LAYER_ID, ["==", ["get", "grid_id"], selectedGridId ?? -1]);
  }, [map, selectedGridId]);

  // Frames the map to the REAL grid bounds - runs only when
  // `featureCollection` itself changes to a new object (initial load, or a
  // pair switch that resolved new data), never on every render, and never
  // while the user is just panning/zooming the already-fitted view. Never
  // fires unless a caller explicitly opts in (see prop doc above).
  useEffect(() => {
    if (!map || !fitBoundsOnLoad || !featureCollection) return;
    const bounds = computeFeatureCollectionBounds(featureCollection);
    if (!bounds) return;

    const fit = () =>
      map.fitBounds(boundsToLngLatBoundsLike(bounds), {
        padding: FIT_BOUNDS_PADDING_PX,
        maxZoom: FIT_BOUNDS_MAX_ZOOM,
        duration: 600,
      });

    if (map.isStyleLoaded()) {
      fit();
    } else {
      map.once("load", fit);
      return () => {
        map.off("load", fit);
      };
    }
  }, [map, featureCollection, fitBoundsOnLoad]);

  return null;
}
