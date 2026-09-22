import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requireRole } from "@/lib/auth/roles";
import { recordAdminAudit } from "@/lib/auth/audit";

// Admin-only "reset access" shortcut: forces a user's role back to the
// least-privilege default (viewer) in one action, separately auditable from
// an arbitrary role change (/api/admin/users/:id/role) so the Security
// section of the admin control center can offer it as its own button.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const { id: userId } = await params;

  const { data: before } = await supabaseAdmin.from("profiles").select("role").eq("user_id", userId).maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, role: "viewer", updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to reset role", [{ issue: error?.message }], 500);
  }

  const actor = await getCurrentUserRole();
  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await recordAdminAudit({
    actorUserId: actor.userId!,
    actorEmail: actorUser?.user?.email ?? null,
    action: "role_reset",
    entityTable: "profiles",
    entityId: userId,
    targetUserId: userId,
    fromState: before?.role ?? null,
    toState: "viewer",
  });

  return ok(data);
}
