import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";

export type AppRole = "viewer" | "operator" | "admin";

const RANK: Record<AppRole, number> = { viewer: 0, operator: 1, admin: 2 };

// PRD-2 §21. Default-safe: a user with no `profiles` row, or the table not
// existing yet (migration 0006 not applied), is treated as 'admin' - this
// preserves today's actual behavior (no role gating existed before this
// migration) so applying the migration alone breaks nothing. Restriction
// only begins once an admin explicitly assigns a lower role via
// /admin/users.
export async function getCurrentUserRole(): Promise<{ userId: string | null; role: AppRole }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, role: "viewer" };

  const { data, error } = await supabaseAdmin.from("profiles").select("role").eq("user_id", user.id).maybeSingle();

  if (error || !data) return { userId: user.id, role: "admin" };
  return { userId: user.id, role: data.role as AppRole };
}

export function roleAtLeast(role: AppRole, min: AppRole): boolean {
  return RANK[role] >= RANK[min];
}

// Route-handler guard: returns null (caller proceeds) when authorized, or a
// 401/403 NextResponse to return immediately otherwise.
export async function requireRole(min: AppRole): Promise<NextResponse | null> {
  const { userId, role } = await getCurrentUserRole();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required", details: [] } }, { status: 401 });
  }
  if (!roleAtLeast(role, min)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: `Requires ${min} role or higher (current: ${role})`, details: [] } },
      { status: 403 },
    );
  }
  return null;
}
