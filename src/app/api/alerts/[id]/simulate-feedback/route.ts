import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { isVoiceDemoMode } from "@/lib/adapters/voice-adapter";
import { handleDtmfResponse } from "@/lib/domain/notification-engine";

// DEMO_MODE only (plan §8.6): lets the dashboard drive the exact same
// handleDtmfResponse code path a real Twilio call would, without a phone.
// Refuses to run once real voice credentials are configured, so this can
// never be used to fake a response once the system is live.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isVoiceDemoMode()) {
    return fail("DEMO_MODE_DISABLED", "Voice provider is configured; simulated feedback is disabled.", [], 403);
  }

  const { id } = await params;
  const alertId = Number(id);
  const body = await request.json().catch(() => null);
  const digit = typeof body?.digit === "string" ? body.digit : null;

  if (!digit || !["1", "2", "3", "9"].includes(digit)) {
    return fail("VALIDATION_FAILED", "digit must be one of 1, 2, 3, 9", [], 400);
  }

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .order("escalation_priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!contact) {
    return fail("NO_CONTACT", "No contact available to attribute the simulated response to", [], 400);
  }

  const { verdict } = await handleDtmfResponse({ alertId, contactId: contact.id, digit });
  return ok({ verdict });
}
