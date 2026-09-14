import { supabaseAdmin } from "@/lib/db/supabase-server";

const COHERENCE_THRESHOLD = 0.5; // PRD §4.3: tunable project parameter, not a universal constant

export type InsarLayerContract = {
  site_id: string;
  acquisition_dates: { from: string; to: string } | null;
  bbox: [number, number, number, number] | null;
  crs: string | null;
  coherence_threshold: number;
  available: boolean;
};

export type InsarNodeFeature = {
  node_id: number;
  insar_los_velocity_mm: number | null; // null = no-data below coherence threshold, never 0
  insar_coherence: number | null;
  no_data: boolean;
  raster_date: string;
};

/**
 * No raster/GeoTIFF pipeline exists yet (InSAR team owns that per plan §16),
 * so "live" here means "a row exists in insar_node_features" - the only
 * thing that will change once the real Sentinel-1/HyP3 pipeline ships is
 * who populates that table, not this adapter's shape.
 */
export async function fetchInsarLayer(siteId: string): Promise<{ source: "live" | "mock"; data: InsarLayerContract }> {
  const { data } = await supabaseAdmin
    .from("insar_node_features")
    .select("raster_date")
    .order("raster_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      source: "mock",
      data: {
        site_id: siteId,
        acquisition_dates: null,
        bbox: null,
        crs: null,
        coherence_threshold: COHERENCE_THRESHOLD,
        available: false,
      },
    };
  }

  return {
    source: "live",
    data: {
      site_id: siteId,
      acquisition_dates: { from: data.raster_date, to: data.raster_date }, // single-pair per PRD §4.3
      bbox: null, // set once the InSAR team supplies a real raster + bbox
      crs: null,
      coherence_threshold: COHERENCE_THRESHOLD,
      available: true,
    },
  };
}

export async function fetchInsarNodeFeatures(): Promise<{ source: "live" | "mock"; data: InsarNodeFeature[] }> {
  const { data } = await supabaseAdmin
    .from("insar_node_features")
    .select("*")
    .order("raster_date", { ascending: false });

  if (!data || data.length === 0) {
    return { source: "mock", data: [] };
  }

  // Coherence filtering is mandatory (PRD §4.3/§11.2): below-threshold
  // pixels are NO-DATA, never substituted with zero.
  const shaped = data.map((row) => ({
    node_id: row.node_id,
    insar_los_velocity_mm:
      row.insar_coherence != null && row.insar_coherence < COHERENCE_THRESHOLD ? null : row.insar_los_velocity_mm,
    insar_coherence: row.insar_coherence,
    no_data: row.insar_coherence != null && row.insar_coherence < COHERENCE_THRESHOLD,
    raster_date: row.raster_date,
  }));

  return { source: "live", data: shaped };
}
