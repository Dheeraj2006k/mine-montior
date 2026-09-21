import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { siteConfigSchema } from "@/lib/schemas/site-config";
import { requireRole } from "@/lib/auth/roles";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";

// Postgres "relation does not exist" - means migration 0004 hasn't been
// applied to this project yet. Treated as an honest "not configured" state
// rather than a 500, so the dashboard's setup banner degrades gracefully
// instead of erroring out before the migration is run.
const UNDEFINED_TABLE = "42P01";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("site_config")
    .select("*")
    .eq("site_id", SITE_ID)
    .maybeSingle();

  if (error) {
    if (error.code === UNDEFINED_TABLE) {
      return ok(null);
    }
    return fail("DATABASE_ERROR", "Failed to load site config", [{ issue: error.message }], 500);
  }

  if (!data) return ok(null);

  // site_config doesn't duplicate the human-readable name - it lives on the
  // `sites` row this table references. Merged here so the dashboard header
  // can show a real name without a second client-side fetch.
  const { data: site } = await supabaseAdmin.from("sites").select("name").eq("site_id", SITE_ID).maybeSingle();

  return ok({ ...data, site_name: site?.name ?? null });
}

export async function POST(request: Request) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body) {
    return fail("VALIDATION_FAILED", "Request body must be JSON", [], 400);
  }

  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", "Site config payload is invalid", parsed.error.issues, 400);
  }
  const payload = parsed.data;

  // mine_type is the master switch (PRD-2 §2 Step 1) - reject geometry that
  // doesn't match the declared mode rather than silently accepting it.
  if (payload.mine_type === "longwall" && !("panel_boundary_note" in payload.geometry)) {
    return fail("VALIDATION_FAILED", "Longwall sites require longwall geometry fields", [], 400);
  }
  if (payload.mine_type === "bord_and_pillar" && !("pillar_width_m" in payload.geometry)) {
    return fail("VALIDATION_FAILED", "Bord-and-pillar sites require bord-and-pillar geometry fields", [], 400);
  }

  const { data: existingSite } = await supabaseAdmin
    .from("sites")
    .select("site_id")
    .eq("site_id", SITE_ID)
    .maybeSingle();

  if (!existingSite) {
    const { error: siteError } = await supabaseAdmin.from("sites").insert({
      site_id: SITE_ID,
      name: payload.site_name,
      timezone: "Asia/Kolkata",
    });
    if (siteError) {
      return fail("DATABASE_ERROR", "Failed to create site", [{ issue: siteError.message }], 500);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("site_config")
    .upsert(
      {
        site_id: SITE_ID,
        mine_type: payload.mine_type,
        aoi_latitude: payload.aoi_latitude,
        aoi_longitude: payload.aoi_longitude,
        geometry: payload.geometry,
        geology: payload.geology,
        mining_state: payload.mining_state,
        data_sources: payload.data_sources,
        is_assumed: payload.is_assumed,
        setup_completed: true,
        setup_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === UNDEFINED_TABLE) {
      return fail(
        "MIGRATION_MISSING",
        "site_config table doesn't exist yet - apply supabase/migrations/0004_site_config.sql first",
        [],
        409,
      );
    }
    return fail("DATABASE_ERROR", "Failed to save site config", [{ issue: error?.message }], 500);
  }

  if (payload.emergency_contacts.length > 0) {
    const rows = payload.emergency_contacts.map((c) => ({
      site_id: SITE_ID,
      full_name: c.full_name,
      role: c.role,
      phone_e164: c.phone_e164 || null,
      email: c.email || null,
      escalation_priority: c.escalation_priority,
      channels: c.channels,
    }));
    const { error: contactsError } = await supabaseAdmin.from("contacts").insert(rows);
    if (contactsError) {
      // Site config already saved successfully - report the partial failure
      // rather than rolling back a write that already succeeded.
      return fail(
        "CONTACTS_PARTIAL_FAILURE",
        "Site config saved, but emergency contacts failed to save",
        [{ issue: contactsError.message }],
        207,
      );
    }
  }

  return ok(data, 201);
}
