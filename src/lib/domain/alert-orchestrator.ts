import { supabaseAdmin } from "@/lib/db/supabase-server";
import { recordPipelineTrace } from "@/lib/trace/pipeline";
import { dispatchNotifications } from "@/lib/domain/notification-engine";
import {
  severityFromEvidenceScore,
  correlationKey,
  decideDedup,
  overlapsBlastWindow,
  buildSummary,
  type OpenAlertLike,
} from "@/lib/domain/alert-engine";

export type ClusterEventForEval = {
  id: number;
  site_id: string;
  triggering_node_id: number;
  evidence_score: number;
  escalate: boolean;
  unknown: boolean;
  reason: string;
  recorded_at: string;
};

/**
 * Runs after a cluster_event with escalate=true is persisted (PRD §9 Stage 8,
 * implementation plan §7). Never throws - alert-engine failures must not take
 * down ingestion; every outcome (including failure) is written to
 * pipeline_trace so it's visible on the incident timeline.
 */
export async function evaluateClusterEvent(
  event: ClusterEventForEval,
  traceId: string,
): Promise<{ alertId: number | null }> {
  const startedAt = Date.now();

  try {
    const severity = severityFromEvidenceScore(event.evidence_score);
    const key = correlationKey(event.site_id, event.triggering_node_id, severity);

    const { data: existing } = await supabaseAdmin
      .from("alerts")
      .select("id, severity, state, correlation_key")
      .eq("correlation_key", key)
      .in("state", ["new", "notified"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const decision = decideDedup(existing as OpenAlertLike | null, severity);

    if (decision.action === "update_existing") {
      const { data: current } = await supabaseAdmin
        .from("alerts")
        .select("event_count, evidence")
        .eq("id", decision.alertId)
        .single();

      const timeline = Array.isArray(
        (current?.evidence as { timeline?: unknown[] } | null)?.timeline,
      )
        ? ((current!.evidence as { timeline: unknown[] }).timeline as unknown[])
        : [];
      timeline.push({ cluster_event_id: event.id, at: event.recorded_at, evidence_score: event.evidence_score });

      await supabaseAdmin
        .from("alerts")
        .update({
          event_count: (current?.event_count ?? 1) + 1,
          last_event_at: event.recorded_at,
          evidence: { ...(current?.evidence as object), timeline },
        })
        .eq("id", decision.alertId);

      await recordPipelineTrace({
        trace_id: traceId,
        stage: "ALERT_EVAL",
        status: "ok",
        node_id: event.triggering_node_id,
        alert_id: decision.alertId,
        latency_ms: Date.now() - startedAt,
        detail: { action: "update_existing", severity },
      });

      return { alertId: decision.alertId };
    }

    // create_new
    const { data: node } = await supabaseAdmin
      .from("nodes")
      .select("label")
      .eq("node_id", event.triggering_node_id)
      .maybeSingle();

    const { data: blastWindows } = await supabaseAdmin
      .from("blast_schedule")
      .select("id, planned_start, planned_end")
      .eq("site_id", event.site_id);

    const overlap = overlapsBlastWindow(event.recorded_at, blastWindows ?? []);
    const blastScheduleId = overlap
      ? (blastWindows ?? []).find((w) =>
          overlapsBlastWindow(event.recorded_at, [w]),
        )?.id ?? null
      : null;

    const { data: latestReading } = await supabaseAdmin
      .from("readings")
      .select("*")
      .eq("node_id", event.triggering_node_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const summary = buildSummary({
      nodeLabel: node?.label ?? `Node_${event.triggering_node_id}`,
      reason: event.reason,
      evidenceScore: event.evidence_score,
      severity,
    });

    const { data: newAlert, error: insertError } = await supabaseAdmin
      .from("alerts")
      .insert({
        site_id: event.site_id,
        node_id: event.triggering_node_id,
        severity,
        source: "cluster_event",
        state: "new",
        cluster_event_id: event.id,
        evidence_score: event.evidence_score,
        risk_score_snapshot: latestReading?.risk_score ?? null,
        reason: event.reason,
        summary,
        evidence: {
          cluster_event: event,
          latest_reading: latestReading ?? null,
          insar: null,
          prediction: null,
          timeline: [{ cluster_event_id: event.id, at: event.recorded_at, evidence_score: event.evidence_score }],
        },
        correlation_key: key,
        event_count: 1,
        first_event_at: event.recorded_at,
        last_event_at: event.recorded_at,
        blast_suspected: overlap,
        blast_schedule_id: blastScheduleId,
      })
      .select("id")
      .single();

    if (insertError || !newAlert) {
      await recordPipelineTrace({
        trace_id: traceId,
        stage: "ALERT_EVAL",
        status: "failed",
        node_id: event.triggering_node_id,
        latency_ms: Date.now() - startedAt,
        detail: { issue: insertError?.message },
      });
      return { alertId: null };
    }

    await supabaseAdmin.from("audit_log").insert({
      actor: "system:alert-engine",
      action: "create",
      entity_table: "alerts",
      entity_id: String(newAlert.id),
      to_state: "new",
      detail: { correlation_key: key, severity, cluster_event_id: event.id },
    });

    await recordPipelineTrace({
      trace_id: traceId,
      stage: "ALERT_EVAL",
      status: "ok",
      node_id: event.triggering_node_id,
      alert_id: newAlert.id,
      latency_ms: Date.now() - startedAt,
      detail: { action: "create_new", severity },
    });

    await recordPipelineTrace({
      trace_id: traceId,
      stage: "ALERT_CREATED",
      status: "ok",
      node_id: event.triggering_node_id,
      alert_id: newAlert.id,
      latency_ms: Date.now() - startedAt,
      detail: { severity, blast_suspected: overlap },
    });

    // Notify only on a genuinely new alert - plan §7.2: a folded repeat into
    // an existing open alert must never re-notify.
    await dispatchNotifications(newAlert.id, traceId);

    return { alertId: newAlert.id };
  } catch (err) {
    console.error("Alert engine evaluation failed:", err);
    await recordPipelineTrace({
      trace_id: traceId,
      stage: "ALERT_EVAL",
      status: "failed",
      node_id: event.triggering_node_id,
      latency_ms: Date.now() - startedAt,
      detail: { issue: err instanceof Error ? err.message : String(err) },
    }).catch(() => {});
    return { alertId: null };
  }
}
