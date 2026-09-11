import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/db/supabase-server";

// Canonical stage vocabulary, plan §5.9 — frozen here so every producer
// (ingest, alert engine, future notification/IVR code) shares one enum.
export type PipelineStage =
  | "SENSOR"
  | "GATEWAY_FUSION"
  | "CLOUD_INGEST"
  | "VALIDATION"
  | "PERSIST"
  | "INSAR_ENRICH"
  | "ML_PREDICT"
  | "ALERT_EVAL"
  | "ALERT_CREATED"
  | "NOTIFY_DASHBOARD"
  | "NOTIFY_EMAIL"
  | "NOTIFY_SMS"
  | "NOTIFY_VOICE"
  | "HUMAN_RESPONSE"
  | "FEEDBACK_STORED";
export type PipelineStatus = "ok" | "degraded" | "failed" | "skipped";

export type PipelineTraceInput = {
  trace_id: string;
  stage: PipelineStage;
  status: PipelineStatus;
  node_id?: number | null;
  alert_id?: number | null;
  occurred_at?: string;
  latency_ms?: number | null;
  detail?: Record<string, unknown>;
};

export function createTraceId(): string {
  return crypto.randomUUID();
}

export async function recordPipelineTrace(
  input: PipelineTraceInput,
  client: SupabaseClient = supabaseAdmin,
): Promise<{ error: Error | null }> {
  const { error } = await client.from("pipeline_trace").insert({
    trace_id: input.trace_id,
    stage: input.stage,
    status: input.status,
    node_id: input.node_id ?? null,
    alert_id: input.alert_id ?? null,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    latency_ms: input.latency_ms ?? null,
    detail: input.detail ?? {},
  });

  return { error: error ? new Error(error.message) : null };
}
