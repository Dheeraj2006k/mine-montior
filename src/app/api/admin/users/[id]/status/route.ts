import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requireRole } from "@/lib/auth/roles";
import { recordAdminAudit } from "@/lib/auth/audit";

const VALID_STATUSES = ["active", "inactive"];

// Admin-only account activation/deactivation. A deactivated user is denied
// all application access at the next request regardless of role - enforced
// in src/middleware.ts (page routes) and src/lib/auth/roles.ts (API routes),
// not just hidden in the UI.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const { id: userId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !VALID_STATUSES.includes(body.status)) {
    return fail("VALIDATION_FAILED", `status must be one of ${VALID_STATUSES.join(", ")}`, [], 400);
  }

  const actor = await getCurrentUserRole();
  if (actor.userId === userId && body.status === "inactive") {
    return fail("SELF_DEACTIVATION_BLOCKED", "You cannot deactivate your own account", [], 400);
  }

  const { data: before } = await supabaseAdmin.from("profiles").select("status").eq("user_id", userId).maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, status: body.status, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to update account status", [{ issue: error?.message }], 500);
  }

  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await recordAdminAudit({
    actorUserId: actor.userId!,
    actorEmail: actorUser?.user?.email ?? null,
    action: body.status === "inactive" ? "user_deactivated" : "user_activated",
    entityTable: "profiles",
    entityId: userId,
    targetUserId: userId,
    fromState: before?.status ?? "active",
    toState: body.status,
  });

  return ok(data);
}
