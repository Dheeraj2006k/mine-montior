import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mocks.profileMaybeSingle,
        })),
      })),
    })),
  },
}));

import { getCurrentUserRole, roleAtLeast, hasRole, requireRole, requirePermission } from "./roles";

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.profileMaybeSingle.mockReset();
});

describe("getCurrentUserRole", () => {
  it("returns userId=null for an unauthenticated request", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const result = await getCurrentUserRole();
    expect(result.userId).toBeNull();
    expect(result.role).toBe("viewer");
  });

  it("defaults to viewer/active when the user has no profile row - never admin", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getCurrentUserRole();
    expect(result.role).toBe("viewer");
    expect(result.status).toBe("active");
  });

  it("defaults to viewer when the profiles table doesn't exist yet (42P01)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: { code: "42P01" } });
    const result = await getCurrentUserRole();
    expect(result.role).toBe("viewer");
  });

  it("resolves the real role and status from the profiles row", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "admin", status: "inactive" }, error: null });
    const result = await getCurrentUserRole();
    expect(result.role).toBe("admin");
    expect(result.status).toBe("inactive");
  });
});

describe("roleAtLeast / hasRole", () => {
  it("ranks viewer < operator < admin", () => {
    expect(roleAtLeast("viewer", "operator")).toBe(false);
    expect(roleAtLeast("operator", "viewer")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
  });

  it("hasRole returns false for a null role (not yet loaded)", () => {
    expect(hasRole(null, "viewer")).toBe(false);
  });
});

describe("requireRole", () => {
  it("401s when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const denied = await requireRole("viewer");
    expect(denied?.status).toBe(401);
  });

  it("403s a deactivated account even if the role would otherwise qualify", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "admin", status: "inactive" }, error: null });
    const denied = await requireRole("viewer");
    expect(denied?.status).toBe(403);
    const body = await denied?.json();
    expect(body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("403s a viewer calling an operator-gated route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "viewer", status: "active" }, error: null });
    const denied = await requireRole("operator");
    expect(denied?.status).toBe(403);
  });

  it("allows an active operator through an operator-gated route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "operator", status: "active" }, error: null });
    const denied = await requireRole("operator");
    expect(denied).toBeNull();
  });
});

describe("requirePermission", () => {
  it("403s a viewer requesting an operator-only permission", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "viewer", status: "active" }, error: null });
    const denied = await requirePermission("alerts.acknowledge");
    expect(denied?.status).toBe(403);
  });

  it("allows an operator through an operator-level permission", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "operator", status: "active" }, error: null });
    const denied = await requirePermission("alerts.acknowledge");
    expect(denied).toBeNull();
  });

  it("403s an operator requesting an admin-only permission", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.profileMaybeSingle.mockResolvedValue({ data: { role: "operator", status: "active" }, error: null });
    const denied = await requirePermission("ownership.manage");
    expect(denied?.status).toBe(403);
  });
});
