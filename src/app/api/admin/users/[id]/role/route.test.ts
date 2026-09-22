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

function makeProfileBuilder(before: { role: string } | null) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: before, error: null }));
  builder.upsert = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: { user_id: "target-1", role: "operator" }, error: null }));
  return builder;
}

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => makeProfileBuilder({ role: "viewer" })),
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
  mocks.recordAdminAudit.mockClear();
});

describe("POST /api/admin/users/:id/role", () => {
  it("defers to requireRole('admin') and returns its denial for non-admins", async () => {
    const denied = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
    mocks.requireRole.mockResolvedValueOnce(denied);

    const res = await POST(requestFor({ role: "admin" }), { params: Promise.resolve({ id: "target-1" }) });
    expect(res.status).toBe(403);
  });

  it("rejects an invalid role value", async () => {
    const res = await POST(requestFor({ role: "superuser" }), { params: Promise.resolve({ id: "target-1" }) });
    expect(res.status).toBe(400);
  });

  it("sets the role and writes an audit record with the actor and before/after state", async () => {
    const res = await POST(requestFor({ role: "operator" }), { params: Promise.resolve({ id: "target-1" }) });
    expect(res.status).toBe(200);
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        action: "role_changed",
        targetUserId: "target-1",
        fromState: "viewer",
        toState: "operator",
      }),
    );
  });
});
