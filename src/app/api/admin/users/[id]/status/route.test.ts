import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(async () => null as Response | null),
  getCurrentUserRole: vi.fn(async () => ({ userId: "admin-1", role: "admin" as const, status: "active" as const })),
  recordAdminAudit: vi.fn(async () => undefined),
  getUserById: vi.fn(async () => ({ data: { user: { id: "admin-1", email: "admin@iris.local" } }, error: null })),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: mocks.requireRole,
  getCurrentUserRole: mocks.getCurrentUserRole,
}));

vi.mock("@/lib/auth/audit", () => ({
  recordAdminAudit: mocks.recordAdminAudit,
}));

function makeProfileBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: { status: "active" }, error: null }));
  builder.upsert = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: { user_id: "target-1", status: "inactive" }, error: null }));
  return builder;
}

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => makeProfileBuilder()),
    auth: { admin: { getUserById: mocks.getUserById } },
  },
}));

import { POST } from "./route";

function requestFor(body: unknown): Request {
  return new Request("http://x", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  mocks.requireRole.mockReset();
  mocks.requireRole.mockResolvedValue(null);
  mocks.getCurrentUserRole.mockClear();
  mocks.getCurrentUserRole.mockResolvedValue({ userId: "admin-1", role: "admin", status: "active" });
  mocks.recordAdminAudit.mockClear();
});

describe("POST /api/admin/users/:id/status", () => {
  it("defers to requireRole('admin')", async () => {
    const denied = new Response(JSON.stringify({ error: {} }), { status: 403 });
    mocks.requireRole.mockResolvedValueOnce(denied);
    const res = await POST(requestFor({ status: "inactive" }), { params: Promise.resolve({ id: "target-1" }) });
    expect(res.status).toBe(403);
  });

  it("rejects an invalid status value", async () => {
    const res = await POST(requestFor({ status: "banned" }), { params: Promise.resolve({ id: "target-1" }) });
    expect(res.status).toBe(400);
  });

  it("blocks an admin from deactivating their own account", async () => {
    const res = await POST(requestFor({ status: "inactive" }), { params: Promise.resolve({ id: "admin-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("SELF_DEACTIVATION_BLOCKED");
  });

  it("deactivates another user and writes an audit record", async () => {
    const res = await POST(requestFor({ status: "inactive" }), { params: Promise.resolve({ id: "target-1" }) });
    expect(res.status).toBe(200);
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user_deactivated", targetUserId: "target-1", toState: "inactive" }),
    );
  });
});
