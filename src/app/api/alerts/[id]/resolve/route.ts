import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requireRole } from "@/lib/auth/roles";

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
  const resolutionNote = typeof body.resolution_note === "string" ? body.resolution_note : null;

  const { data: before } = await supabaseAdmin
    .from("alerts")
    .select("state")
    .eq("id", alertId)
    .single();

  if (!before) return fail("NOT_FOUND", "Alert not found", [], 404);

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({
      state: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote,
    })
    .eq("id", alertId)
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to resolve alert", [{ issue: error?.message }], 500);
  }

  const actor = await getCurrentUserRole();
  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await supabaseAdmin.from("audit_log").insert({
    actor: actorUser?.user?.email ? `${actor.role}:${actorUser.user.email}` : `${actor.role}:${actor.userId}`,
    actor_user_id: actor.userId,
    action: "resolve",
    entity_table: "alerts",
    entity_id: String(alertId),
    from_state: before.state,
    to_state: "resolved",
    detail: { resolution_note: resolutionNote },
  });

  return ok(data);
}
