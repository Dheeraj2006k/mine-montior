import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async () => null as Response | null),
  getCurrentUserRole: vi.fn(async () => ({ userId: "op-1", role: "operator" as const, status: "active" as const })),
  getUserById: vi.fn(async () => ({ data: { user: { id: "op-1", email: "op@iris.local" } }, error: null })),
  auditInsert: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock("@/lib/auth/roles", () => ({
  requirePermission: mocks.requirePermission,
  getCurrentUserRole: mocks.getCurrentUserRole,
}));

function alertsBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: { id: 1, state: "new" }, error: null }));
  builder.update = vi.fn(() => builder);
  return builder;
}

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "audit_log") return { insert: mocks.auditInsert };
      return alertsBuilder();
    }),
    auth: { admin: { getUserById: mocks.getUserById } },
  },
}));

import { POST } from "./route";

function requestFor(body: unknown = {}): Request {
  return new Request("http://x", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  mocks.requirePermission.mockReset();
  mocks.requirePermission.mockResolvedValue(null);
  mocks.auditInsert.mockClear();
});

describe("POST /api/alerts/:id/acknowledge", () => {
  it("a viewer is rejected server-side via requirePermission('alerts.acknowledge')", async () => {
    const denied = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
    mocks.requirePermission.mockResolvedValueOnce(denied);

    const res = await POST(requestFor(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
    expect(mocks.requirePermission).toHaveBeenCalledWith("alerts.acknowledge");
  });

  it("an authorized operator can acknowledge, and the actor is recorded in the audit row", async () => {
    const res = await POST(requestFor(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_user_id: "op-1", action: "acknowledge" }),
    );
  });
});
