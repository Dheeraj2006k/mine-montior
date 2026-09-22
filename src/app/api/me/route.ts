import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole } from "@/lib/auth/roles";

// Lets the app shell / profile section show the signed-in user's own
// role, status, and site assignment without exposing the admin-only
// /api/admin/users directory to every viewer.
export async function GET() {
  const { userId, role, status } = await getCurrentUserRole();
  if (!userId) return fail("UNAUTHENTICATED", "Sign in required", [], 401);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, assigned_site_id")
    .eq("user_id", userId)
    .maybeSingle();

  return ok({
    user_id: userId,
    role,
    status,
    full_name: profile?.full_name ?? null,
    assigned_site_id: profile?.assigned_site_id ?? null,
  });
}
