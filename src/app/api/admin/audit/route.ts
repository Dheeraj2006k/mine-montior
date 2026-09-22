import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requirePermission } from "@/lib/auth/roles";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Admin-only audit trail. Reads the existing generic `audit_log` table
// (0001) - not a new table - filtered to admin/RBAC actions by default so
// this page reads as "who changed access" rather than a firehose of every
// alert-pipeline row; pass ?scope=all to see everything the table holds.
export async function GET(request: Request) {
  const denied = await requirePermission("audit.view");
  if (denied) return denied;

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "admin";
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  let query = supabaseAdmin
    .from("audit_log")
    .select("id, actor, actor_user_id, action, entity_table, entity_id, target_user_id, from_state, to_state, detail, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (scope !== "all") {
    query = query.not("actor_user_id", "is", null);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return ok([]);
    return fail("DATABASE_ERROR", "Failed to load audit log", [{ issue: error.message }], 500);
  }

  return ok(data ?? []);
}
