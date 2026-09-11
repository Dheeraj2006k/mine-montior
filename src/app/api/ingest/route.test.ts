import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PipelineTraceInput } from "@/lib/trace/pipeline";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createTraceId: vi.fn(() => "generated-trace-id"),
  recordPipelineTrace: vi.fn<(input: PipelineTraceInput) => Promise<{ error: Error | null }>>(
    async () => ({ error: null }),
  ),
}));

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: { from: mocks.from },
}));

vi.mock("@/lib/trace/pipeline", () => ({
  createTraceId: mocks.createTraceId,
  recordPipelineTrace: mocks.recordPipelineTrace,
}));

import { POST } from "./route";

const validReading = {
  type: "reading",
  schema_version: 1,
  site_id: "demo-site",
  node_id: 7,
  hop_count: 0,
  seq_num: 12,
  timestamp: "2026-09-11T05:00:00.000Z",
  logging_mode: "baseline",
  tilt: { x_raw: 0, y_raw: 0, x_filt: 0, y_filt: 0, unit: "deg" },
  vibration: { raw: 0, filt: 0, unit: "g" },
  displacement: { raw: 0, filt: 0, unit: "mm" },
  risk_score: 0.1,
  node_status: {
    sensor_ok: true,
    low_battery: false,
    self_test_fail: false,
    comm_quality_low: false,
    calibration_stale: false,
  },
};

function requestFor(body: unknown, traceId?: string): NextRequest {
  const headers = new Headers({
    "content-type": "application/json",
    "x-gateway-key": "test-secret",
  });
  if (traceId) headers.set("x-trace-id", traceId);
  return new NextRequest("http://localhost/api/ingest", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function configureInsert(data: { id: number }, error: null | { code: string; message: string } = null) {
  mocks.from.mockReturnValueOnce({
    insert: () => ({
      select: () => ({ single: async () => ({ data, error }) }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GATEWAY_SHARED_SECRET = "test-secret";
});

describe("POST /api/ingest pipeline tracing", () => {
  it("creates cloud, validation, and persist traces for a valid reading", async () => {
    configureInsert({ id: 42 });

    const response = await POST(requestFor(validReading));
    const body = await response.json();
    const stages = mocks.recordPipelineTrace.mock.calls.map(([trace]) => trace.stage);

    expect(response.status).toBe(202);
    expect(body.data).toMatchObject({ id: 42, duplicate: false });
    expect(stages).toEqual(["CLOUD_INGEST", "VALIDATION", "PERSIST"]);
    expect(response.headers.get("x-trace-id")).toBe("generated-trace-id");
  });

  it("traces duplicate persistence without inserting a second reading", async () => {
    mocks.from
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { code: "23505", message: "duplicate" },
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({ single: async () => ({ data: { id: 42 }, error: null }) }),
          }),
        }),
      });

    const response = await POST(requestFor(validReading));
    const body = await response.json();
    const traces = mocks.recordPipelineTrace.mock.calls.map(([trace]) => trace);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: 42, duplicate: true });
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(traces[2]).toMatchObject({ stage: "PERSIST", status: "degraded" });
    expect(traces[2].detail).toMatchObject({ idempotent_retry: true });
  });

  it("records a failed validation without a persist trace", async () => {
    const response = await POST(requestFor({ type: "reading" }));
    const body = await response.json();
    const stages = mocks.recordPipelineTrace.mock.calls.map(([trace]) => trace.stage);
    const validationTrace = mocks.recordPipelineTrace.mock.calls[1][0];

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(stages).toEqual(["CLOUD_INGEST", "VALIDATION"]);
    expect(validationTrace).toMatchObject({ stage: "VALIDATION", status: "failed" });
  });

  it("preserves a supplied trace ID", async () => {
    configureInsert({ id: 43 });

    const response = await POST(requestFor(validReading, "client-trace-id"));

    expect(response.headers.get("x-trace-id")).toBe("client-trace-id");
    expect(mocks.recordPipelineTrace.mock.calls[0][0].trace_id).toBe("client-trace-id");
    expect(mocks.createTraceId).not.toHaveBeenCalled();
  });

  it("generates a trace ID when the request does not supply one", async () => {
    configureInsert({ id: 44 });

    const response = await POST(requestFor(validReading));

    expect(response.headers.get("x-trace-id")).toBe("generated-trace-id");
    expect(mocks.createTraceId).toHaveBeenCalledOnce();
  });
});
