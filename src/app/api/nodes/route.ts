import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { computeNodeHealth, type ReadingLike } from "@/lib/domain/node-health";

const RECENT_WINDOW = 50;

export async function GET() {
  const { data: nodes, error: nodesError } = await supabaseAdmin
    .from("nodes")
    .select("*")
    .order("node_id", { ascending: true });

  if (nodesError) {
    return fail("DATABASE_ERROR", "Failed to load nodes", [{ issue: nodesError.message }], 500);
  }

  const enriched = await Promise.all(
    (nodes ?? []).map(async (node) => {
      const { data: readings } = await supabaseAdmin
        .from("readings")
        .select("seq_num, recorded_at, sensor_ok, low_battery, comm_quality_low, calibration_stale, risk_score")
        .eq("node_id", node.node_id)
        .order("recorded_at", { ascending: false })
        .limit(RECENT_WINDOW);

      const health = computeNodeHealth((readings ?? []) as ReadingLike[]);
      const latestRiskScore = readings && readings.length > 0 ? readings[0].risk_score : null;

      return {
        ...node,
        latest_risk_score: latestRiskScore,
        ...health,
      };
    }),
  );

  return ok(enriched);
}
