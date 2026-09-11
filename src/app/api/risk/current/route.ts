import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

export async function GET() {
  const { data: nodes, error: nodesError } = await supabaseAdmin
    .from("nodes")
    .select("node_id, label")
    .order("node_id", { ascending: true });

  if (nodesError) {
    return fail("DATABASE_ERROR", "Failed to load nodes", [{ issue: nodesError.message }], 500);
  }

  const results = await Promise.all(
    (nodes ?? []).map(async (node) => {
      const { data: latestEvent } = await supabaseAdmin
        .from("cluster_events")
        .select("evidence_score, escalate, unknown, reason, recorded_at")
        .eq("triggering_node_id", node.node_id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        node_id: node.node_id,
        label: node.label,
        evidence_score: latestEvent?.evidence_score ?? null,
        escalate: latestEvent?.escalate ?? false,
        unknown: latestEvent?.unknown ?? false,
        reason: latestEvent?.reason ?? null,
        last_cluster_event_at: latestEvent?.recorded_at ?? null,
      };
    }),
  );

  return ok(results);
}
