import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

const MAX_POINTS = 2000;
const FETCH_CAP = 10000;

function downsample<T>(rows: T[], maxPoints: number): T[] {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, i) => i % step === 0);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const nodeId = Number(id);

  if (!Number.isInteger(nodeId)) {
    return fail("INVALID_NODE_ID", "node id must be an integer", [], 400);
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limitParam = Number(searchParams.get("limit"));
  const SELECT_COLS =
    "id, recorded_at, tilt_x_filt, tilt_y_filt, vibration_filt, displacement_filt, risk_score, sensor_ok, seq_num";

  // `limit` (no from/to): most recent N readings, for compact widgets like a
  // dashboard sparkline - distinct code path from the full-range downsample
  // below, which serves the node detail page's full chart.
  if (Number.isInteger(limitParam) && limitParam > 0 && !from && !to) {
    const { data, error } = await supabaseAdmin
      .from("readings")
      .select(SELECT_COLS)
      .eq("node_id", nodeId)
      .order("recorded_at", { ascending: false })
      .limit(Math.min(limitParam, 500));

    if (error) {
      return fail("DATABASE_ERROR", "Failed to load history", [{ issue: error.message }], 500);
    }
    return ok((data ?? []).reverse());
  }

  let query = supabaseAdmin
    .from("readings")
    .select(SELECT_COLS)
    .eq("node_id", nodeId)
    .order("recorded_at", { ascending: true })
    .limit(FETCH_CAP);

  if (from) query = query.gte("recorded_at", from);
  if (to) query = query.lte("recorded_at", to);

  const { data, error } = await query;

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load history", [{ issue: error.message }], 500);
  }

  return ok(downsample(data ?? [], MAX_POINTS));
}
