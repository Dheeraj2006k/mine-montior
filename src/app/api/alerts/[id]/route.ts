import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requireRole } from "@/lib/auth/roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const { id } = await params;
  const alertId = Number(id);

  if (!Number.isInteger(alertId)) {
    return fail("INVALID_ALERT_ID", "alert id must be an integer", [], 400);
  }

  const { data: alert, error } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .eq("id", alertId)
    .single();

  if (error || !alert) {
    return fail("NOT_FOUND", "Alert not found", [], 404);
  }

  const { data: trace } = await supabaseAdmin
    .from("pipeline_trace")
    .select("*")
    .eq("alert_id", alertId)
    .order("occurred_at", { ascending: true });

  return ok({ ...alert, pipeline_trace: trace ?? [] });
}
