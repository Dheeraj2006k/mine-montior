import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { computeNodeHealth, type ReadingLike } from "@/lib/domain/node-health";

const RECENT_WINDOW = 50;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const nodeId = Number(id);

  if (!Number.isInteger(nodeId)) {
    return fail("INVALID_NODE_ID", "node id must be an integer", [], 400);
  }

  const { data: node, error: nodeError } = await supabaseAdmin
    .from("nodes")
    .select("*")
    .eq("node_id", nodeId)
    .single();

  if (nodeError || !node) {
    return fail("NOT_FOUND", "Node not found", [], 404);
  }

  const { data: readings } = await supabaseAdmin
    .from("readings")
    .select("seq_num, recorded_at, sensor_ok, low_battery, comm_quality_low, calibration_stale, risk_score")
    .eq("node_id", nodeId)
    .order("recorded_at", { ascending: false })
    .limit(RECENT_WINDOW);

  const health = computeNodeHealth((readings ?? []) as ReadingLike[]);
  const latestRiskScore = readings && readings.length > 0 ? readings[0].risk_score : null;

  return ok({ ...node, latest_risk_score: latestRiskScore, ...health });
}
