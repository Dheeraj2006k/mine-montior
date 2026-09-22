import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { cellCoherenceQuality, toDisplacementMm } from "@/lib/insar-grid/coherence";
import type { InsarGridFeature, InsarGridFeatureCollection } from "@/lib/insar-grid/types";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";
import { requireRole } from "@/lib/auth/roles";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

// Real production data (1,591 cells / 9,546 observations, imported and
// independently verified - see IMPLEMENTED_* docs). No mock fallback: if
// the tables are empty or the query fails, this returns an honest empty
// FeatureCollection or a real error, never fabricated rows.
export async function GET(request: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);

  const pairParam = searchParams.get("pair");
  const pair = pairParam != null ? Number(pairParam) : NaN;
  if (!Number.isInteger(pair)) {
    return fail("VALIDATION_FAILED", "pair query parameter is required and must be an integer", [], 400);
  }

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const coherenceMin = searchParams.get("coherence_min");
  const coherenceMax = searchParams.get("coherence_max");

  // Pagination is applied to THIS pair's rows only (at most 1,591), never
  // to the full 9,546-row table - the required `pair` filter guarantees
  // that, since it's applied before .range() in the same query.
  let obsQuery = supabaseAdmin
    .from("insar_grid_observations")
    .select(
      "grid_id, pair, reference_date, secondary_date, temporal_baseline_days, los_displacement_m, coherence, incidence_angle_rad, look_vector_phi_rad, look_vector_theta_rad",
    )
    .eq("site_id", SITE_ID)
    .eq("pair", pair)
    .order("grid_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (coherenceMin != null && coherenceMin !== "") {
    obsQuery = obsQuery.gte("coherence", Number(coherenceMin));
  }
  if (coherenceMax != null && coherenceMax !== "") {
    obsQuery = obsQuery.lte("coherence", Number(coherenceMax));
  }

  const { data: observations, error: obsError } = await obsQuery;
  if (obsError) {
    return fail("DATABASE_ERROR", "Failed to load InSAR grid observations", [{ issue: obsError.message }], 500);
  }

  const gridIds = (observations ?? []).map((o) => o.grid_id);

  // Geometry lookup, joined in application code rather than via a
  // PostgREST embed - insar_grid_observations' foreign key to
  // insar_grid_cells is a composite (site_id, grid_id) key, and this two-
  // query shape is the same one already proven correct during the
  // production import's own verification pass.
  const { data: cells, error: cellError } = await supabaseAdmin
    .from("insar_grid_cells")
    .select("grid_id, geometry_4326")
    .eq("site_id", SITE_ID)
    .in("grid_id", gridIds.length > 0 ? gridIds : [-1]);

  if (cellError) {
    return fail("DATABASE_ERROR", "Failed to load InSAR grid cell geometry", [{ issue: cellError.message }], 500);
  }

  const geometryByGridId = new Map((cells ?? []).map((c) => [c.grid_id, c.geometry_4326]));

  const features: InsarGridFeature[] = (observations ?? [])
    .filter((o) => geometryByGridId.has(o.grid_id))
    .map((o) => ({
      type: "Feature" as const,
      geometry: geometryByGridId.get(o.grid_id),
      properties: {
        grid_id: o.grid_id,
        pair: o.pair,
        reference_date: o.reference_date,
        secondary_date: o.secondary_date,
        temporal_baseline_days: o.temporal_baseline_days,
        los_displacement_m: o.los_displacement_m,
        los_displacement_mm: toDisplacementMm(o.los_displacement_m),
        coherence: o.coherence,
        cell_coherence_quality: cellCoherenceQuality(o.coherence),
        incidence_angle_rad: o.incidence_angle_rad,
        look_vector_phi_rad: o.look_vector_phi_rad,
        look_vector_theta_rad: o.look_vector_theta_rad,
      },
    }));

  const featureCollection: InsarGridFeatureCollection = { type: "FeatureCollection", features };
  return ok(featureCollection);
}
