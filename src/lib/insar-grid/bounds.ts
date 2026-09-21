// Pure geometry helper - computes the bounding box of a GeoJSON feature
// collection's polygons, so a map can fit its viewport to the REAL InSAR
// grid extent already returned by GET /api/insar/grid, instead of a
// fabricated or hardcoded center. No coordinates are invented here - this
// only reduces coordinates already present in the data to a min/max box.
//
// Deliberately dependency-free (no turf) - a bounding box over an array of
// [lng, lat] pairs is a handful of Math.min/Math.max calls, not a reason
// to add a library.

export type LngLatBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

// Loosely typed on purpose (not InsarGridFeatureCollection) so this stays
// reusable for any GeoJSON FeatureCollection, and so a malformed/foreign
// shape degrades to "no bounds" instead of a type error at the call site.
type BoundsRing = unknown;
type BoundsGeometry =
  | { type: "Polygon"; coordinates?: BoundsRing[] }
  | { type: "MultiPolygon"; coordinates?: BoundsRing[][] }
  | { type: string; coordinates?: unknown }
  | null
  | undefined;
type BoundsFeature = { geometry?: BoundsGeometry } | null | undefined;
export type BoundsFeatureCollection = { features?: BoundsFeature[] } | null | undefined;

function extendWithRing(bounds: LngLatBounds | null, ring: BoundsRing): LngLatBounds | null {
  if (!Array.isArray(ring)) return bounds;
  let result = bounds;
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const [lng, lat] = point;
    if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }
    result = result
      ? {
          minLng: Math.min(result.minLng, lng),
          minLat: Math.min(result.minLat, lat),
          maxLng: Math.max(result.maxLng, lng),
          maxLat: Math.max(result.maxLat, lat),
        }
      : { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
  }
  return result;
}

/**
 * Computes the bounding box across every Polygon/MultiPolygon geometry in
 * a feature collection. Returns null for an empty, missing, or entirely
 * geometry-less collection - never a fabricated default box.
 */
export function computeFeatureCollectionBounds(fc: BoundsFeatureCollection): LngLatBounds | null {
  if (!fc || !Array.isArray(fc.features)) return null;

  let bounds: LngLatBounds | null = null;
  for (const feature of fc.features) {
    const geometry = feature?.geometry;
    if (!geometry || typeof geometry !== "object") continue;

    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      for (const ring of geometry.coordinates) bounds = extendWithRing(bounds, ring);
    } else if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      for (const polygon of geometry.coordinates) {
        if (!Array.isArray(polygon)) continue;
        for (const ring of polygon) bounds = extendWithRing(bounds, ring);
      }
    }
  }
  return bounds;
}

/** [[west, south], [east, north]] - the shape MapLibre's fitBounds expects. */
export function boundsToLngLatBoundsLike(bounds: LngLatBounds): [[number, number], [number, number]] {
  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ];
}
