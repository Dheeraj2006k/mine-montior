import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requireRole } from "@/lib/auth/roles";

const SITE_ID = "SIH-DEMO-01"; // single-site prototype; no site selector yet

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("blast_schedule")
    .select("*")
    .order("planned_start", { ascending: false });

  if (error) {
    return fail("DATABASE_ERROR", "Failed to load blast schedule", [{ issue: error.message }], 500);
  }
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const denied = await requireRole("operator");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.planned_start !== "string" || typeof body.planned_end !== "string") {
    return fail("VALIDATION_FAILED", "planned_start and planned_end are required", [], 400);
  }
  if (new Date(body.planned_end) <= new Date(body.planned_start)) {
    return fail("VALIDATION_FAILED", "planned_end must be after planned_start", [], 400);
  }

  const { data, error } = await supabaseAdmin
    .from("blast_schedule")
    .insert({
      site_id: SITE_ID,
      panel_label: typeof body.panel_label === "string" ? body.panel_label : null,
      planned_start: body.planned_start,
      planned_end: body.planned_end,
      entered_by: typeof body.entered_by === "string" ? body.entered_by : "dashboard",
      note: typeof body.note === "string" ? body.note : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to create blast window", [{ issue: error?.message }], 500);
  }

  return ok(data, 201);
}
