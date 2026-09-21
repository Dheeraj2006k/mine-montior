import type { CellCoherenceQuality } from "./coherence";

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

// One InSAR grid cell's observation for one temporal pair. LOS
// displacement is pair-wise (between reference_date and secondary_date) -
// never vertical subsidence, never a validated velocity. See
// INSAR_INTEGRATION_DESIGN.md (Revision 3) and the scientific guardrails
// table there for the full rationale behind every field/label choice here.
export type InsarGridObservationProperties = {
  grid_id: number;
  pair: number;
  reference_date: string;
  secondary_date: string;
  temporal_baseline_days: number;
  los_displacement_m: number | null;
  los_displacement_mm: number | null;
  coherence: number;
  cell_coherence_quality: CellCoherenceQuality;
  incidence_angle_rad: number | null;
  look_vector_phi_rad: number | null;
  look_vector_theta_rad: number | null;
};

export type InsarGridFeature = {
  type: "Feature";
  geometry: GeoJsonPolygon;
  properties: InsarGridObservationProperties;
};

export type InsarGridFeatureCollection = {
  type: "FeatureCollection";
  features: InsarGridFeature[];
};

export type InsarGridCellDetail = {
  grid_id: number;
  geometry: GeoJsonPolygon;
  observations: Omit<InsarGridObservationProperties, "grid_id">[];
};
