import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async () => null as Response | null),
  getCurrentUserRole: vi.fn(async () => ({ userId: "admin-1", role: "admin" as const, status: "active" as const })),
  recordAdminAudit: vi.fn(async () => undefined),
  getUserById: vi.fn(async (id: string) => ({ data: { user: { id, email: `${id}@iris.local` } }, error: null })),
}));

vi.mock("@/lib/auth/roles", () => ({
  requirePermission: mocks.requirePermission,
  getCurrentUserRole: mocks.getCurrentUserRole,
}));

vi.mock("@/lib/auth/audit", () => ({
  recordAdminAudit: mocks.recordAdminAudit,
}));

function sitesBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: { owner_user_id: "old-owner" }, error: null }));
  builder.update = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: { site_id: "SIH-DEMO-01", owner_user_id: "new-owner" }, error: null }));
  return builder;
}

function profilesBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: { status: "active" }, error: null }));
  builder.upsert = vi.fn(async () => ({ data: null, error: null }));
  return builder;
}

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => (table === "sites" ? sitesBuilder() : profilesBuilder())),
    auth: { admin: { getUserById: mocks.getUserById } },
  },
}));

import { POST } from "./route";

function requestFor(body: unknown): Request {
  return new Request("http://x", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  mocks.requirePermission.mockReset();
  mocks.requirePermission.mockResolvedValue(null);
  mocks.recordAdminAudit.mockClear();
});

describe("POST /api/admin/ownership", () => {
  it("defers to requirePermission('ownership.manage')", async () => {
    const denied = new Response(JSON.stringify({ error: {} }), { status: 403 });
    mocks.requirePermission.mockResolvedValueOnce(denied);
    const res = await POST(requestFor({ new_owner_user_id: "new-owner" }));
    expect(res.status).toBe(403);
  });

  it("400s when new_owner_user_id is missing", async () => {
    const res = await POST(requestFor({}));
    expect(res.status).toBe(400);
  });

  it("transfers ownership and writes an audit record with previous and new owner", async () => {
    const res = await POST(requestFor({ new_owner_user_id: "new-owner" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.owner_user_id).toBe("new-owner");
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ownership_transferred",
        entityTable: "sites",
        targetUserId: "new-owner",
        fromState: "old-owner",
        toState: "new-owner",
      }),
    );
  });
});
