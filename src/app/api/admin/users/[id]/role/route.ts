import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requireRole } from "@/lib/auth/roles";
import { recordAdminAudit } from "@/lib/auth/audit";

const VALID_ROLES = ["viewer", "operator", "admin"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const { id: userId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !VALID_ROLES.includes(body.role)) {
    return fail("VALIDATION_FAILED", `role must be one of ${VALID_ROLES.join(", ")}`, [], 400);
  }

  const { data: before } = await supabaseAdmin.from("profiles").select("role").eq("user_id", userId).maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, role: body.role, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "42P01") {
      return fail("MIGRATION_MISSING", "profiles table doesn't exist yet - apply supabase/migrations/0006_profiles.sql first", [], 409);
    }
    return fail("DATABASE_ERROR", "Failed to set role", [{ issue: error?.message }], 500);
  }

  const actor = await getCurrentUserRole();
  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await recordAdminAudit({
    actorUserId: actor.userId!,
    actorEmail: actorUser?.user?.email ?? null,
    action: "role_changed",
    entityTable: "profiles",
    entityId: userId,
    targetUserId: userId,
    fromState: before?.role ?? null,
    toState: body.role,
  });

  return ok(data);
}
