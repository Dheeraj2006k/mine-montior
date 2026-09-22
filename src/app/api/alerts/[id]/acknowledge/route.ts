import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requirePermission } from "@/lib/auth/roles";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requirePermission("alerts.acknowledge");
  if (denied) return denied;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId)) {
    return fail("INVALID_ALERT_ID", "alert id must be an integer", [], 400);
  }

  const body = await request.json().catch(() => ({}));
  const channel = typeof body.channel === "string" ? body.channel : "dashboard";
  const note = typeof body.note === "string" ? body.note : null;

  const { data: before } = await supabaseAdmin
    .from("alerts")
    .select("state")
    .eq("id", alertId)
    .single();

  if (!before) return fail("NOT_FOUND", "Alert not found", [], 404);

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({
      state: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_channel: channel,
    })
    .eq("id", alertId)
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to acknowledge alert", [{ issue: error?.message }], 500);
  }

  const actor = await getCurrentUserRole();
  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await supabaseAdmin.from("audit_log").insert({
    actor: actorUser?.user?.email ? `${actor.role}:${actorUser.user.email}` : `${actor.role}:${actor.userId}`,
    actor_user_id: actor.userId,
    action: "acknowledge",
    entity_table: "alerts",
    entity_id: String(alertId),
    from_state: before.state,
    to_state: "acknowledged",
    channel,
    detail: { note },
  });

  return ok(data);
}
