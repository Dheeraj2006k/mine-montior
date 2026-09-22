import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { cellCoherenceQuality, toDisplacementMm } from "@/lib/insar-grid/coherence";
import type { InsarGridCellDetail } from "@/lib/insar-grid/types";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";
import { requireRole } from "@/lib/auth/roles";

export async function GET(_request: Request, { params }: { params: Promise<{ gridId: string }> }) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const { gridId: gridIdParam } = await params;
  const gridId = Number(gridIdParam);
  if (!Number.isInteger(gridId)) {
    return fail("INVALID_GRID_ID", "grid id must be an integer", [], 400);
  }

  const { data: cell, error: cellError } = await supabaseAdmin
    .from("insar_grid_cells")
    .select("grid_id, geometry_4326")
    .eq("site_id", SITE_ID)
    .eq("grid_id", gridId)
    .maybeSingle();

  if (cellError) {
    return fail("DATABASE_ERROR", "Failed to load InSAR grid cell", [{ issue: cellError.message }], 500);
  }
  if (!cell) {
    return fail("NOT_FOUND", `Grid cell ${gridId} not found`, [], 404);
  }

  const { data: observations, error: obsError } = await supabaseAdmin
    .from("insar_grid_observations")
    .select(
      "pair, reference_date, secondary_date, temporal_baseline_days, los_displacement_m, coherence, incidence_angle_rad, look_vector_phi_rad, look_vector_theta_rad",
    )
    .eq("site_id", SITE_ID)
    .eq("grid_id", gridId)
    .order("pair", { ascending: true });

  if (obsError) {
    return fail("DATABASE_ERROR", "Failed to load InSAR grid observations", [{ issue: obsError.message }], 500);
  }

  const detail: InsarGridCellDetail = {
    grid_id: cell.grid_id,
    geometry: cell.geometry_4326,
    observations: (observations ?? []).map((o) => ({
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
    })),
  };

  return ok(detail);
}
