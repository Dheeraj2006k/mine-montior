import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requireRole } from "@/lib/auth/roles";
import { getTableEntry } from "@/lib/data-monitor/registry";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// The one, explicit, allowlisted query surface for the Data Monitor
// (Objective 2 "database table safety"). `table` must exist in
// TABLE_REGISTRY - there is no path from here to an arbitrary table,
// column, or raw SQL. Filters are only applied if the column is listed in
// that table's own `filterable` array; everything else in the query string
// is silently ignored, not interpolated.
export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const entry = getTableEntry(table);
  if (!entry) {
    return fail("UNKNOWN_TABLE", `"${table}" is not an allowlisted Data Monitor table`, [], 404);
  }

  const denied = await requireRole(entry.minRole);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const ascending = searchParams.get("sort") === "asc" ? true : searchParams.get("sort") === "desc" ? false : !entry.defaultOrderDesc;

  let query = supabaseAdmin
    .from(entry.key)
    .select(entry.columns.join(","), { count: "estimated" });

  for (const f of entry.filterable) {
    const raw = searchParams.get(f.column);
    if (raw == null || raw === "") continue;
    if (f.type === "eq") {
      query = query.eq(f.column, raw === "true" ? true : raw === "false" ? false : raw);
    } else if (f.type === "ilike") {
      query = query.ilike(f.column, `%${raw}%`);
    } else if (f.type === "gte") {
      query = query.gte(f.column, raw);
    } else if (f.type === "lte") {
      query = query.lte(f.column, raw);
    }
  }

  if (entry.timestampField) {
    query = query.order(entry.timestampField, { ascending });
  }
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return fail("DATABASE_ERROR", `Failed to load ${entry.key}`, [{ issue: error.message }], 500);
  }

  return ok({
    table: entry.key,
    display_name: entry.displayName,
    classification: entry.classification,
    primary_key: entry.primaryKey,
    timestamp_field: entry.timestampField,
    rows: data ?? [],
    row_count_estimate: count ?? null,
    limit,
    offset,
  });
}
