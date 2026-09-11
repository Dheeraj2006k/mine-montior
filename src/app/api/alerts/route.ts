import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (state) query = query.eq("state", state);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load alerts", [{ issue: error.message }], 500);
  }

  return ok(data ?? []);
}
