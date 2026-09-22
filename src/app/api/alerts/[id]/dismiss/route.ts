import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requireRole } from "@/lib/auth/roles";

// PRD §12: dismissing closes THIS alert instance only. It has no effect on
// ingestion, ML processing, or the alert engine's ability to open a brand
// new alert for the same node/severity band on the next escalation - no
// human action anywhere in this system gets permanent veto power.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireRole("operator");
  if (denied) return denied;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId)) {
    return fail("INVALID_ALERT_ID", "alert id must be an integer", [], 400);
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : null;

  const { data: before } = await supabaseAdmin
    .from("alerts")
    .select("state")
    .eq("id", alertId)
    .single();

  if (!before) return fail("NOT_FOUND", "Alert not found", [], 404);

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({ state: "dismissed" })
    .eq("id", alertId)
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to dismiss alert", [{ issue: error?.message }], 500);
  }

  const actor = await getCurrentUserRole();
  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await supabaseAdmin.from("audit_log").insert({
    actor: actorUser?.user?.email ? `${actor.role}:${actorUser.user.email}` : `${actor.role}:${actor.userId}`,
    actor_user_id: actor.userId,
    action: "dismiss",
    entity_table: "alerts",
    entity_id: String(alertId),
    from_state: before.state,
    to_state: "dismissed",
    detail: { reason },
  });

  return ok(data);
}
