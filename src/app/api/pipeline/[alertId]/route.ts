import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requireRole } from "@/lib/auth/roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const { alertId } = await params;
  const id = Number(alertId);

  if (!Number.isInteger(id)) {
    return fail("INVALID_ALERT_ID", "alert id must be an integer", [], 400);
  }

  const { data, error } = await supabaseAdmin
    .from("pipeline_trace")
    .select("*")
    .eq("alert_id", id)
    .order("occurred_at", { ascending: true });

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load pipeline trace", [{ issue: error.message }], 500);
  }

  return ok(data ?? []);
}
