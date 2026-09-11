import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { buildCallScript, buildTwiml } from "@/lib/adapters/voice-adapter";

// Twilio fetches this when the outbound call connects. Returns TwiML, not JSON.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ alertId: string; contactId: string }> },
) {
  const { alertId, contactId } = await params;
  const id = Number(alertId);

  const { data: alert } = await supabaseAdmin
    .from("alerts")
    .select("severity, node_id, first_event_at")
    .eq("id", id)
    .single();

  if (!alert) {
    return new NextResponse("<Response><Say>Alert not found.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const { data: node } = await supabaseAdmin
    .from("nodes")
    .select("label")
    .eq("node_id", alert.node_id)
    .maybeSingle();

  const script = buildCallScript({
    severity: alert.severity,
    nodeLabel: node?.label ?? `Node_${alert.node_id}`,
    panelLabel: null,
    occurredAtIso: alert.first_event_at,
  });

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const twiml = buildTwiml(script, `${baseUrl}/api/voice/dtmf/${alertId}/${contactId}`);

  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = POST;
