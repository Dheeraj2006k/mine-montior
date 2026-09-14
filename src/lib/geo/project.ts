// Equirectangular local-metre projection, plan §10.4. Kept as one shared
// utility so the 2D map and the 3D twin can never disagree about where a
// node is - though the 2D map currently renders real lat/lon directly via
// MapLibre, this is what the twin uses to place node pins on a flat scene.
export type LatLon = { lat: number; lon: number };
export type LocalXY = { x: number; y: number };

const METRES_PER_DEG_LAT = 110540;
const METRES_PER_DEG_LON_AT_EQUATOR = 111320;

export function projectToLocalMetres(point: LatLon, origin: LatLon): LocalXY {
  const x =
    (point.lon - origin.lon) * METRES_PER_DEG_LON_AT_EQUATOR * Math.cos((origin.lat * Math.PI) / 180);
  const y = (point.lat - origin.lat) * METRES_PER_DEG_LAT;
  return { x, y };
}
