import { supabaseAdmin } from "@/lib/db/supabase-server";
import { recordPipelineTrace } from "@/lib/trace/pipeline";
import { sendEmail } from "@/lib/adapters/email-adapter";
import { sendSms } from "@/lib/adapters/sms-adapter";
import { initiateCall, isVoiceDemoMode } from "@/lib/adapters/voice-adapter";
import { computeSuppression, type FeedbackForSuppression } from "@/lib/domain/suppression";

// PRD §8.1 escalation ladder. IMPORTANT LIMITATION: the +30s/+60s/+150s/+240s
// steps below are scheduled with plain setTimeout in the same Node process
// that's handling the HTTP request. That is correct and demonstrable for a
// local `next dev` / `next start` process kept alive for a demo, but it does
// NOT survive a serverless redeploy or process restart, and won't work at
// all on Vercel's serverless function model in production - a real
// deployment needs a durable scheduler (Vercel Cron + a queue table, or
// QStash) driving these steps instead. Flagged here so it isn't mistaken for
// production-grade infrastructure.
const SMS_DELAY_MS = 30_000;
const VOICE_P1_DELAY_MS = 60_000;
const VOICE_P2_DELAY_MS = 150_000;
const VOICE_P3_DELAY_MS = 240_000;

type Contact = {
  id: number;
  full_name: string;
  role: string;
  phone_e164: string | null;
  email: string | null;
  escalation_priority: number;
  channels: string[];
};

async function alertIsOpen(alertId: number): Promise<boolean> {
  const { data } = await supabaseAdmin.from("alerts").select("state").eq("id", alertId).single();
  return data?.state === "new" || data?.state === "notified";
}

async function markNotified(alertId: number) {
  await supabaseAdmin
    .from("alerts")
    .update({ state: "notified", notified_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("state", "new"); // don't clobber if already acknowledged/resolved/dismissed
}

export async function dispatchNotifications(alertId: number, traceId: string): Promise<void> {
  const { data: alert } = await supabaseAdmin
    .from("alerts")
    .select("id, site_id, node_id, severity, summary, blast_suspected")
    .eq("id", alertId)
    .single();
  if (!alert) return;

  const { data: node } = await supabaseAdmin
    .from("nodes")
    .select("label")
    .eq("node_id", alert.node_id)
    .maybeSingle();

  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, role, phone_e164, email, escalation_priority, channels")
    .eq("site_id", alert.site_id)
    .eq("is_active", true)
    .order("escalation_priority", { ascending: true });

  const activeContacts = (contacts ?? []) as Contact[];

  // Suppression check (plan §8.4): query-time only, never touches ingestion
  // or the alert engine. Reconstructed from alert_feedback history since
  // there is no dedicated suppression table in the schema.
  const { data: feedbackRows } = await supabaseAdmin
    .from("alert_feedback")
    .select("verdict, created_at, alerts!inner(node_id, severity)")
    .eq("alerts.site_id", alert.site_id);

  const feedbackForSuppression: FeedbackForSuppression[] = (feedbackRows ?? []).map((f) => {
    const alertsRel = f.alerts as unknown as { node_id: number; severity: string } | { node_id: number; severity: string }[];
    const joined = Array.isArray(alertsRel) ? alertsRel[0] : alertsRel;
    return {
      verdict: f.verdict,
      node_id: joined?.node_id ?? null,
      severity: joined?.severity ?? "",
      created_at: f.created_at,
    };
  });

  const suppression = computeSuppression(alert.node_id, alert.severity, feedbackForSuppression);

  // Dashboard notification always happens - suppression only affects
  // human-interrupting channels (email/SMS/voice), never visibility.
  await recordPipelineTrace({
    trace_id: traceId,
    stage: "NOTIFY_DASHBOARD",
    status: "ok",
    node_id: alert.node_id,
    alert_id: alertId,
    detail: { severity: alert.severity },
  });

  if (suppression.suppressed) {
    await recordPipelineTrace({
      trace_id: traceId,
      stage: "NOTIFY_EMAIL",
      status: "skipped",
      node_id: alert.node_id,
      alert_id: alertId,
      detail: { reason: "suppressed", until: suppression.until },
    });
    return;
  }

  if (activeContacts.length === 0) {
    await recordPipelineTrace({
      trace_id: traceId,
      stage: "NOTIFY_EMAIL",
      status: "skipped",
      node_id: alert.node_id,
      alert_id: alertId,
      detail: { reason: "no_active_contacts" },
    });
    return;
  }

  await markNotified(alertId);

  // t+0s: email every active contact with an email address
  for (const contact of activeContacts) {
    if (!contact.email || !contact.channels.includes("email")) continue;
    const result = await sendEmail({
      to: contact.email,
      subject: `[${alert.severity.toUpperCase()}] ${node?.label ?? "Node"} - Mine Subsidence Monitor`,
      text: alert.summary,
    });
    await supabaseAdmin.from("notifications").insert({
      alert_id: alertId,
      contact_id: contact.id,
      channel: "email",
      provider: result.demo ? "demo" : "resend",
      provider_message_id: result.providerMessageId,
      status: result.ok ? "sent" : "failed",
      error: result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    });
  }
  await recordPipelineTrace({
    trace_id: traceId,
    stage: "NOTIFY_EMAIL",
    status: "ok",
    node_id: alert.node_id,
    alert_id: alertId,
    detail: { contacts_notified: activeContacts.filter((c) => c.email).length },
  });

  const priority1 = activeContacts.find((c) => c.escalation_priority === 1) ?? activeContacts[0];
  const priority2 = activeContacts.find((c) => c.escalation_priority === 2);
  const priority3 = activeContacts.find((c) => c.escalation_priority === 3);

  scheduleStep(alertId, SMS_DELAY_MS, async () => {
    if (!priority1?.phone_e164 || !priority1.channels.includes("sms")) return;
    const result = await sendSms({
      to: priority1.phone_e164,
      body: `${alert.severity.toUpperCase()} alert at ${node?.label ?? "node"}: ${alert.summary}`,
    });
    await supabaseAdmin.from("notifications").insert({
      alert_id: alertId,
      contact_id: priority1.id,
      channel: "sms",
      provider: result.demo ? "demo" : "twilio",
      provider_message_id: result.providerMessageId,
      status: result.ok ? "sent" : "failed",
      error: result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    await recordPipelineTrace({
      trace_id: traceId,
      stage: "NOTIFY_SMS",
      status: result.ok ? "ok" : "failed",
      node_id: alert.node_id,
      alert_id: alertId,
      detail: { contact_id: priority1.id, demo: result.demo },
    });
  });

  scheduleStep(alertId, VOICE_P1_DELAY_MS, () => placeCall(alertId, alert.node_id, traceId, priority1));
  scheduleStep(alertId, VOICE_P2_DELAY_MS, () => placeCall(alertId, alert.node_id, traceId, priority2));
  scheduleStep(alertId, VOICE_P3_DELAY_MS, () => placeCall(alertId, alert.node_id, traceId, priority3));
}

function scheduleStep(alertId: number, delayMs: number, fn: () => Promise<void>) {
  setTimeout(async () => {
    if (!(await alertIsOpen(alertId))) return; // ack from any channel halts the ladder
    try {
      await fn();
    } catch (err) {
      console.error(`Notification ladder step failed for alert ${alertId}:`, err);
    }
  }, delayMs);
}

async function placeCall(
  alertId: number,
  nodeId: number,
  traceId: string,
  contact: Contact | undefined,
): Promise<void> {
  if (!contact?.phone_e164 || !contact.channels.includes("voice")) return;

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const twimlUrl = `${baseUrl}/api/voice/twiml/${alertId}/${contact.id}`;
  const result = await initiateCall({ to: contact.phone_e164, twimlUrl });

  await supabaseAdmin.from("call_sessions").insert({
    alert_id: alertId,
    contact_id: contact.id,
    provider_call_id: result.providerCallId,
    started_at: new Date().toISOString(),
    outcome: result.demo ? "demo_placed" : result.ok ? "initiated" : "failed",
  });

  await recordPipelineTrace({
    trace_id: traceId,
    stage: "NOTIFY_VOICE",
    status: result.ok ? "ok" : "failed",
    node_id: nodeId,
    alert_id: alertId,
    detail: { contact_id: contact.id, demo: result.demo ?? isVoiceDemoMode() },
  });
}

export type DtmfVerdict = "real_event" | "blast_or_disturbance" | "uncertain" | null;

const DIGIT_TO_VERDICT: Record<string, DtmfVerdict> = {
  "1": "real_event",
  "2": "blast_or_disturbance",
  "3": "uncertain",
};

/**
 * Shared by the real Twilio DTMF webhook and the DEMO_MODE "simulate IVR
 * response" dashboard button - same code path, same DB writes, the only
 * difference is whether a real call ever happened (plan §8.6).
 *
 * Digit 3 ("uncertain") deliberately does NOT halt the escalation ladder
 * (plan §8.2: "Press 3 ... escalation ladder continues") - it records
 * acknowledged_at/channel for the audit trail but leaves alert.state at
 * "notified" so scheduleStep's alertIsOpen() gate keeps firing later steps.
 * Digits 1 and 2 move state to "acknowledged", which halts the ladder.
 */
export async function handleDtmfResponse(params: {
  alertId: number;
  contactId: number;
  digit: string;
  traceId?: string;
}): Promise<{ verdict: DtmfVerdict }> {
  const verdict = DIGIT_TO_VERDICT[params.digit] ?? null;

  const { data: session } = await supabaseAdmin
    .from("call_sessions")
    .select("id")
    .eq("alert_id", params.alertId)
    .eq("contact_id", params.contactId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  if (session) {
    await supabaseAdmin
      .from("call_sessions")
      .update({ answered_at: now, ended_at: now, dtmf_digit: params.digit, outcome: "answered" })
      .eq("id", session.id);
  }

  if (verdict) {
    await supabaseAdmin.from("alert_feedback").insert({
      alert_id: params.alertId,
      responder_contact_id: params.contactId,
      verdict,
      source_channel: "voice_ivr",
    });

    const { data: alert } = await supabaseAdmin
      .from("alerts")
      .select("state")
      .eq("id", params.alertId)
      .single();

    if (verdict === "uncertain") {
      await supabaseAdmin
        .from("alerts")
        .update({ acknowledged_at: now, acknowledged_channel: "voice" })
        .eq("id", params.alertId)
        .in("state", ["new", "notified"]);
    } else {
      await supabaseAdmin
        .from("alerts")
        .update({
          state: "acknowledged",
          acknowledged_at: now,
          acknowledged_channel: "voice",
          blast_suspected: verdict === "blast_or_disturbance" ? true : undefined,
        })
        .eq("id", params.alertId);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor: "ivr:voice",
      action: "feedback",
      entity_table: "alerts",
      entity_id: String(params.alertId),
      from_state: alert?.state ?? null,
      to_state: verdict === "uncertain" ? alert?.state ?? null : "acknowledged",
      channel: "voice",
      detail: { digit: params.digit, verdict },
    });

    if (params.traceId) {
      await recordPipelineTrace({
        trace_id: params.traceId,
        stage: "HUMAN_RESPONSE",
        status: "ok",
        alert_id: params.alertId,
        detail: { digit: params.digit, verdict },
      });
      await recordPipelineTrace({
        trace_id: params.traceId,
        stage: "FEEDBACK_STORED",
        status: "ok",
        alert_id: params.alertId,
        detail: { verdict },
      });
    }
  }

  return { verdict };
}
