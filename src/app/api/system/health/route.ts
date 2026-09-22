import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok } from "@/lib/api/envelope";
import { computeNodeHealth, type ReadingLike } from "@/lib/domain/node-health";
import { isVoiceDemoMode } from "@/lib/adapters/voice-adapter";
import { requireRole } from "@/lib/auth/roles";

type DependencyStatus = "ok" | "degraded" | "down";

export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const dependencies: { name: string; status: DependencyStatus; detail: string }[] = [];

  // Database reachability
  const dbStart = Date.now();
  const { error: dbError } = await supabaseAdmin.from("sites").select("site_id").limit(1);
  dependencies.push({
    name: "database",
    status: dbError ? "down" : "ok",
    detail: dbError ? dbError.message : `${Date.now() - dbStart}ms`,
  });

  // Gateway / node liveness - last packet across all nodes
  const { data: nodes } = await supabaseAdmin.from("nodes").select("node_id, label");
  const nodeStatuses: { label: string; state: string; last_seen_at: string | null }[] = [];
  for (const node of nodes ?? []) {
    const { data: readings } = await supabaseAdmin
      .from("readings")
      .select("seq_num, recorded_at, sensor_ok, low_battery, comm_quality_low, calibration_stale")
      .eq("node_id", node.node_id)
      .order("recorded_at", { ascending: false })
      .limit(10);
    const health = computeNodeHealth((readings ?? []) as ReadingLike[]);
    nodeStatuses.push({ label: node.label, state: health.health_state, last_seen_at: health.last_seen_at });
  }
  const anyOnline = nodeStatuses.some((n) => n.state === "normal" || n.state === "warning");
  dependencies.push({
    name: "gateway",
    status: anyOnline ? "ok" : "degraded",
    detail: anyOnline ? "at least one node reporting" : "no recent packets from any node",
  });

  // Scheduled ML background pass - PRD §12: this is the one thing that
  // catches silent failure of the periodic pass, but no scheduler exists in
  // this build (plan §18 Phase 8/ADR-004 - owned by the ML team's process).
  dependencies.push({
    name: "scheduled_ml_pass",
    status: "degraded",
    detail: "no scheduler wired up yet in this build - ADR-004 assigns this to the ML service",
  });

  // InSAR layer presence
  const { data: insarRow } = await supabaseAdmin
    .from("insar_node_features")
    .select("raster_date")
    .limit(1)
    .maybeSingle();
  dependencies.push({
    name: "insar_layer",
    status: insarRow ? "ok" : "degraded",
    detail: insarRow ? `static, latest ${insarRow.raster_date}` : "no InSAR data ingested yet",
  });

  // Notification providers
  dependencies.push({
    name: "email_provider",
    status: process.env.RESEND_API_KEY ? "ok" : "degraded",
    detail: process.env.RESEND_API_KEY ? "resend configured" : "DEMO_MODE - no real provider configured",
  });
  dependencies.push({
    name: "sms_provider",
    status: process.env.TWILIO_ACCOUNT_SID ? "ok" : "degraded",
    detail: process.env.TWILIO_ACCOUNT_SID ? "twilio configured" : "DEMO_MODE - no real provider configured",
  });
  dependencies.push({
    name: "voice_provider",
    status: isVoiceDemoMode() ? "degraded" : "ok",
    detail: isVoiceDemoMode() ? "DEMO_MODE - no real provider configured" : "twilio configured",
  });

  return ok({ dependencies, nodes: nodeStatuses });
}
