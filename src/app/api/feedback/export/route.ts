import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

// PRD §8.5 / §9 Stage 10: the label-acquisition mechanism for the ML team.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("alert_feedback")
    .select("*, alerts!inner(id, site_id, node_id, severity, evidence, first_event_at, last_event_at)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) {
    return fail("DATABASE_ERROR", "Failed to load feedback export", [{ issue: error.message }], 500);
  }

  const shaped = (data ?? []).map((row) => {
    const alert = row.alerts as unknown as {
      id: number;
      site_id: string;
      node_id: number;
      evidence: unknown;
      first_event_at: string;
      last_event_at: string;
    };
    return {
      alert_id: alert.id,
      node_id: alert.node_id,
      site_id: alert.site_id,
      window: { from: alert.first_event_at, to: alert.last_event_at },
      evidence_snapshot: alert.evidence,
      verdict: row.verdict,
      verdict_source: row.source_channel,
      responded_at: row.created_at,
    };
  });

  return ok(shaped);
}
