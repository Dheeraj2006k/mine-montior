import { NextRequest, NextResponse } from "next/server";
import { ingestSchema } from "@/lib/schemas/ingest";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import {
  createTraceId,
  recordPipelineTrace,
  type PipelineStage,
  type PipelineStatus,
} from "@/lib/trace/pipeline";
import { evaluateClusterEvent } from "@/lib/domain/alert-orchestrator";

function responseWithTrace(
  body: unknown,
  status: number,
  traceId: string,
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("x-trace-id", traceId);
  return response;
}

async function traceStage(
  traceId: string,
  stage: PipelineStage,
  status: PipelineStatus,
  startedAt: number,
  nodeId: number | null,
  detail: Record<string, unknown>,
): Promise<void> {
  const { error } = await recordPipelineTrace({
    trace_id: traceId,
    stage,
    status,
    node_id: nodeId,
    occurred_at: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
    detail,
  });

  if (error) {
    console.error("Pipeline trace write failed:", error.message);
  }
}

export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") || createTraceId();
  const requestStartedAt = Date.now();

  try {
    // Authenticate gateway
    const gatewayKey = request.headers.get("x-gateway-key");

    if (
      !gatewayKey ||
      gatewayKey !== process.env.GATEWAY_SHARED_SECRET
    ) {
      return responseWithTrace(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid gateway credentials",
            details: [],
          },
        },
        401,
        traceId,
      );
    }

    // Read request body
    const body = await request.json();
    const nodeId =
      typeof body === "object" &&
      body !== null &&
      "node_id" in body &&
      typeof body.node_id === "number"
        ? body.node_id
        : null;

    await traceStage(traceId, "CLOUD_INGEST", "ok", requestStartedAt, nodeId, {
      received: true,
      payload_type:
        typeof body === "object" && body !== null && "type" in body
          ? body.type
          : null,
    });

    // Validate
    const result = ingestSchema.safeParse(body);

    if (!result.success) {
      await traceStage(
        traceId,
        "VALIDATION",
        "failed",
        requestStartedAt,
        nodeId,
        {
          issue_count: result.error.issues.length,
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            issue: issue.message,
          })),
        },
      );

      return responseWithTrace(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid ingest payload",
            details: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              issue: issue.message,
            })),
          },
        },
        400,
        traceId,
      );
    }

    const payload = result.data;

    await traceStage(traceId, "VALIDATION", "ok", requestStartedAt, payload.type === "reading" ? payload.node_id : null, {
      schema_version: payload.schema_version,
      payload_type: payload.type,
    });

    // Handle reading
    if (payload.type === "reading") {
      const insertResult = await supabaseAdmin
        .from("readings")
        .insert({
          site_id: payload.site_id,
          node_id: payload.node_id,
          hop_count: payload.hop_count,
          seq_num: payload.seq_num,
          logging_mode: payload.logging_mode,

          tilt_x_raw: payload.tilt.x_raw,
          tilt_y_raw: payload.tilt.y_raw,
          tilt_x_filt: payload.tilt.x_filt,
          tilt_y_filt: payload.tilt.y_filt,

          vibration_raw: payload.vibration.raw,
          vibration_filt: payload.vibration.filt,

          displacement_raw: payload.displacement.raw,
          displacement_filt: payload.displacement.filt,

          risk_score: payload.risk_score,

          sensor_ok: payload.node_status.sensor_ok,
          low_battery: payload.node_status.low_battery,
          self_test_fail: payload.node_status.self_test_fail,
          comm_quality_low: payload.node_status.comm_quality_low,
          calibration_stale: payload.node_status.calibration_stale,

          recorded_at: payload.timestamp,
        })
        .select("id")
        .single();

      let data = insertResult.data;
      let error = insertResult.error;
      let duplicate = false;

      if (error?.code === "23505") {
        const existingResult = await supabaseAdmin
          .from("readings")
          .select("id")
          .eq("node_id", payload.node_id)
          .eq("seq_num", payload.seq_num)
          .single();

        data = existingResult.data;
        error = existingResult.error;
        duplicate = !error;
      }

      if (error || !data) {
        console.error("Reading insert failed:", {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
        });

        await traceStage(
          traceId,
          "PERSIST",
          "failed",
          requestStartedAt,
          payload.node_id,
          { duplicate_lookup: duplicate },
        );

        return responseWithTrace(
          {
            error: {
              code: "DATABASE_ERROR",
              message: "Failed to store reading",
              details:
                process.env.NODE_ENV === "development"
                  ? [{ code: error?.code, issue: error?.message }]
                  : [],
            },
          },
          500,
          traceId,
        );
      }

      await traceStage(
        traceId,
        "PERSIST",
        duplicate ? "degraded" : "ok",
        requestStartedAt,
        payload.node_id,
        {
          reading_id: data.id,
          duplicate,
          idempotent_retry: duplicate,
        },
      );

      return responseWithTrace(
        {
          data: {
            accepted: true,
            id: data.id,
            duplicate,
          },
          meta: {
            generated_at: new Date().toISOString(),
            source: "live",
          },
        },
        duplicate ? 200 : 202,
        traceId,
      );
    }

    // Handle cluster event
    if (payload.type === "cluster_event") {
      const { data, error } = await supabaseAdmin
        .from("cluster_events")
        .insert({
          site_id: payload.site_id,
          triggering_node_id: payload.triggering_node_id,
          evidence_score: payload.evidence_score,
          escalate: payload.escalate,
          unknown: payload.unknown,
          reason: payload.reason,
          recorded_at: payload.timestamp,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Cluster event insert failed:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        await traceStage(
          traceId,
          "PERSIST",
          "failed",
          requestStartedAt,
          payload.triggering_node_id,
          { issue: error.message },
        );

        return responseWithTrace(
          {
            error: {
              code: "DATABASE_ERROR",
              message: "Failed to store cluster event",
              details:
                process.env.NODE_ENV === "development"
                  ? [{ code: error.code, issue: error.message }]
                  : [],
            },
          },
          500,
          traceId,
        );
      }

      await traceStage(
        traceId,
        "PERSIST",
        "ok",
        requestStartedAt,
        payload.triggering_node_id,
        { cluster_event_id: data.id },
      );

      // PRD §13/§16: an escalating cluster_event triggers the alert engine
      // as an internal function call, never a separate exposed endpoint.
      let alertId: number | null = null;
      if (payload.escalate) {
        const result = await evaluateClusterEvent(
          {
            id: data.id,
            site_id: payload.site_id,
            triggering_node_id: payload.triggering_node_id,
            evidence_score: payload.evidence_score,
            escalate: payload.escalate,
            unknown: payload.unknown,
            reason: payload.reason,
            recorded_at: payload.timestamp,
          },
          traceId,
        );
        alertId = result.alertId;
      }

      return responseWithTrace(
        {
          data: {
            accepted: true,
            id: data.id,
            duplicate: false,
            alert_id: alertId,
          },
          meta: {
            generated_at: new Date().toISOString(),
            source: "live",
          },
        },
        202,
        traceId,
      );
    }

    return responseWithTrace(
      {
        error: {
          code: "UNSUPPORTED_TYPE",
          message: "Unsupported payload type",
          details: [],
        },
      },
      400,
      traceId,
    );
  } catch (error) {
    console.error("Ingest error:", error);

    return responseWithTrace(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error",
          details: [],
        },
      },
      500,
      traceId,
    );
  }
}