import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*, contacts(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load notifications", [{ issue: error.message }], 500);
  }

  const { data: calls } = await supabaseAdmin
    .from("call_sessions")
    .select("*, contacts(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return ok({ notifications: data ?? [], call_sessions: calls ?? [] });
}
