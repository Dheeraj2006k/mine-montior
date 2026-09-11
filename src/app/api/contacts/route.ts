import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

const SITE_ID = "SIH-DEMO-01";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .order("escalation_priority", { ascending: true });

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load contacts", [{ issue: error.message }], 500);
  }
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.full_name !== "string" || typeof body.role !== "string") {
    return fail("VALIDATION_FAILED", "full_name and role are required", [], 400);
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      site_id: SITE_ID,
      full_name: body.full_name,
      role: body.role,
      phone_e164: typeof body.phone_e164 === "string" ? body.phone_e164 : null,
      email: typeof body.email === "string" ? body.email : null,
      escalation_priority: typeof body.escalation_priority === "number" ? body.escalation_priority : 1,
      channels: Array.isArray(body.channels) ? body.channels : ["email", "sms", "voice"],
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to create contact", [{ issue: error?.message }], 500);
  }
  return ok(data, 201);
}
