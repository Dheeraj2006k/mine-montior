import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { computeNodeHealth, type ReadingLike } from "@/lib/domain/node-health";
import { findBaselineReading } from "@/lib/domain/node-baseline";
import { requireRole } from "@/lib/auth/roles";

const RECENT_WINDOW = 50;

// PRD-2 §2 Step 3: baseline is "auto-captured from the first valid reading
// after registration" - checked lazily here (not via a background job,
// since none exists in this codebase) whenever the node is read and a
// baseline is still outstanding.
async function captureBaselineIfPending(node: { node_id: number; registered_at: string | null; baseline_reading_id: number | null }) {
  if (!node.registered_at || node.baseline_reading_id != null) return node.baseline_reading_id;

  const { data: candidates } = await supabaseAdmin
    .from("readings")
    .select("id, recorded_at")
    .eq("node_id", node.node_id)
    .gte("recorded_at", node.registered_at)
    .order("recorded_at", { ascending: true })
    .limit(1);

  const baseline = findBaselineReading(candidates ?? [], node.registered_at);
  if (!baseline) return null;

  await supabaseAdmin.from("nodes").update({ baseline_reading_id: baseline.id }).eq("node_id", node.node_id);
  return baseline.id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

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
  const baselineReadingId = await captureBaselineIfPending(node);

  return ok({ ...node, latest_risk_score: latestRiskScore, baseline_reading_id: baselineReadingId, ...health });
}
