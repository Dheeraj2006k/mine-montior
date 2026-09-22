import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole, requirePermission } from "@/lib/auth/roles";
import { recordAdminAudit } from "@/lib/auth/audit";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";

// Single-tenant prototype (see src/lib/config/site.ts) - ownership is
// tracked per-site on `sites.owner_user_id`, "assigned users" is every
// profile whose assigned_site_id points at this site. Modeled as real
// columns (migration 0009) rather than UI-only state, so a future
// multi-site build extends this instead of replacing it.
export async function GET() {
  const denied = await requirePermission("ownership.manage");
  if (denied) return denied;

  const { data: site, error } = await supabaseAdmin
    .from("sites")
    .select("site_id, name, owner_user_id")
    .eq("site_id", SITE_ID)
    .maybeSingle();

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load site", [{ issue: error.message }], 500);
  }
  if (!site) {
    return fail("NOT_FOUND", "Site not found - complete /setup first", [], 404);
  }

  let owner: { user_id: string; email: string | null } | null = null;
  if (site.owner_user_id) {
    const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(site.owner_user_id);
    owner = ownerUser?.user ? { user_id: ownerUser.user.id, email: ownerUser.user.email ?? null } : null;
  }

  const { data: assignedProfiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role, full_name")
    .eq("assigned_site_id", SITE_ID);

  const assignedUsers = await Promise.all(
    (assignedProfiles ?? []).map(async (p) => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
      return { user_id: p.user_id, email: u?.user?.email ?? null, full_name: p.full_name, role: p.role };
    }),
  );

  return ok({ site_id: site.site_id, site_name: site.name, owner, assigned_users: assignedUsers });
}

// Ownership transfer: admin-only, validates the new owner exists, updates
// atomically (single-row update, so there is no partial-transfer state),
// and always writes an audit record with the previous and new owner -
// history is preserved via the audit trail, not by deleting anything.
export async function POST(request: Request) {
  const denied = await requirePermission("ownership.manage");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.new_owner_user_id !== "string") {
    return fail("VALIDATION_FAILED", "new_owner_user_id is required", [], 400);
  }

  const { data: newOwnerUser, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(body.new_owner_user_id);
  if (lookupError || !newOwnerUser?.user) {
    return fail("VALIDATION_FAILED", "new_owner_user_id does not match an existing user", [], 400);
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("status")
    .eq("user_id", body.new_owner_user_id)
    .maybeSingle();
  if (profile?.status === "inactive") {
    return fail("VALIDATION_FAILED", "Cannot transfer ownership to a deactivated user", [], 400);
  }

  const { data: before } = await supabaseAdmin
    .from("sites")
    .select("owner_user_id")
    .eq("site_id", SITE_ID)
    .maybeSingle();

  if (!before) {
    return fail("NOT_FOUND", "Site not found - complete /setup first", [], 404);
  }

  const { data: updated, error } = await supabaseAdmin
    .from("sites")
    .update({ owner_user_id: body.new_owner_user_id })
    .eq("site_id", SITE_ID)
    .select("site_id, owner_user_id")
    .single();

  if (error || !updated) {
    return fail("DATABASE_ERROR", "Failed to transfer ownership", [{ issue: error?.message }], 500);
  }

  // Keep the new owner's site assignment in sync - ownership implies
  // assignment, though assignment alone (viewer/operator on the team) does
  // not imply ownership.
  await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: body.new_owner_user_id, assigned_site_id: SITE_ID, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  const actor = await getCurrentUserRole();
  const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(actor.userId!);
  await recordAdminAudit({
    actorUserId: actor.userId!,
    actorEmail: actorUser?.user?.email ?? null,
    action: "ownership_transferred",
    entityTable: "sites",
    entityId: SITE_ID,
    targetUserId: body.new_owner_user_id,
    fromState: before.owner_user_id,
    toState: body.new_owner_user_id,
    reason: typeof body.reason === "string" ? body.reason : null,
    detail: { previous_owner_email: null, new_owner_email: newOwnerUser.user.email ?? null },
  });

  return ok(updated);
}
