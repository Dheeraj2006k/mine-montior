import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { hasPermission, roleAtLeast, type AppRole, type Permission, type ProfileStatus } from "./permissions";

export type { AppRole, ProfileStatus } from "./permissions";
export { hasRole, roleAtLeast } from "./permissions";

export type CurrentUser = {
  userId: string | null;
  role: AppRole;
  status: ProfileStatus;
};

// PRD-2 §21. Every signed-in user is resolved to a real role + status.
// Default-safe: a user with no `profiles` row (only possible for accounts
// created before migration 0009's signup trigger existed - see that
// migration) or the table not existing yet is treated as 'viewer'/'active',
// the least-privilege state, never as admin. The one seeded administrator
// (tools/seed-admin.mjs) always gets an explicit admin row, so this fallback
// never has to special-case it.
export async function getCurrentUserRole(): Promise<CurrentUser> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, role: "viewer", status: "active" };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { userId: user.id, role: "viewer", status: "active" };
  return {
    userId: user.id,
    role: data.role as AppRole,
    status: (data.status as ProfileStatus | null) ?? "active",
  };
}

// Route-handler guard: returns null (caller proceeds) when authorized, or a
// 401/403 NextResponse to return immediately otherwise. Also rejects
// deactivated accounts regardless of role.
export async function requireRole(min: AppRole): Promise<NextResponse | null> {
  const { userId, role, status } = await getCurrentUserRole();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required", details: [] } }, { status: 401 });
  }
  if (status === "inactive") {
    return NextResponse.json(
      { error: { code: "ACCOUNT_INACTIVE", message: "This account has been deactivated", details: [] } },
      { status: 403 },
    );
  }
  if (!roleAtLeast(role, min)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: `Requires ${min} role or higher (current: ${role})`, details: [] } },
      { status: 403 },
    );
  }
  return null;
}

// Permission-based route-handler guard - prefer this over requireRole() for
// admin-control-center actions, since it reads intent (e.g. "roles.manage")
// rather than a role name, and stays correct if the role/permission mapping
// ever changes.
export async function requirePermission(permission: Permission): Promise<NextResponse | null> {
  const { userId, role, status } = await getCurrentUserRole();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required", details: [] } }, { status: 401 });
  }
  if (status === "inactive") {
    return NextResponse.json(
      { error: { code: "ACCOUNT_INACTIVE", message: "This account has been deactivated", details: [] } },
      { status: 403 },
    );
  }
  if (!hasPermission(role, permission)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: `Requires the "${permission}" permission (current role: ${role})`, details: [] } },
      { status: 403 },
    );
  }
  return null;
}

// Server Component / layout guard - redirects instead of returning a JSON
// response. Use at the top of a page.tsx/layout.tsx that must never even
// render its shell for an unauthorized role (defense in depth on top of the
// API-level guards above and the nav's presentation-only filtering).
export async function requireRolePage(min: AppRole): Promise<CurrentUser> {
  const current = await getCurrentUserRole();
  if (!current.userId) {
    redirect("/login");
  }
  if (current.status === "inactive") {
    redirect("/login?error=inactive");
  }
  if (!roleAtLeast(current.role, min)) {
    redirect("/dashboard");
  }
  return current;
}
