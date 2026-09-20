import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requireRole } from "@/lib/auth/roles";

// PRD-2 §21 - admin-only user/role directory. Lists every Supabase Auth
// user alongside their `profiles` role (or the documented "admin (default)"
// state when no profile row exists yet - see src/lib/auth/roles.ts for why
// that default exists).
export async function GET() {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (usersError) {
    return fail("AUTH_ERROR", "Failed to list users", [{ issue: usersError.message }], 500);
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin.from("profiles").select("user_id, role");
  // 42P01 = migration 0006 not applied yet - degrade to "no roles assigned"
  // rather than failing the whole page.
  const roleByUserId = new Map((profilesError ? [] : (profiles ?? [])).map((p) => [p.user_id, p.role]));

  const rows = usersPage.users.map((u) => ({
    user_id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    role: roleByUserId.get(u.id) ?? null,
  }));

  return ok(rows);
}
