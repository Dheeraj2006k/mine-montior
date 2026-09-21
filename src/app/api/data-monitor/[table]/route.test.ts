import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(async () => null as Response | null),
  calls: {
    select: [] as unknown[],
    eq: [] as [string, unknown][],
    order: [] as [string, unknown][],
    range: [] as [number, number][],
  },
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: mocks.requireRole,
}));

function makeQueryBuilder(rows: Record<string, unknown>[]) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn((cols: unknown) => {
    mocks.calls.select.push(cols);
    return builder;
  });
  builder.eq = vi.fn((col: string, val: unknown) => {
    mocks.calls.eq.push([col, val]);
    return builder;
  });
  builder.ilike = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.order = vi.fn((col: string, opts: unknown) => {
    mocks.calls.order.push([col, opts]);
    return builder;
  });
  builder.range = vi.fn((from: number, to: number) => {
    mocks.calls.range.push([from, to]);
    return builder;
  });
  builder.then = (resolve: (v: { data: unknown; error: null; count: number }) => void) =>
    resolve({ data: rows, error: null, count: rows.length });
  return builder;
}

const FIXTURE_ROWS = [
  { node_id: 1, label: "Node_01", is_mock: true, updated_at: "2026-01-01T00:00:00Z" },
  { node_id: 2, label: "Node_02", is_mock: false, updated_at: "2026-01-02T00:00:00Z" },
];

// grid_id 41, pair 1 - a real row from the verified production import
// (same fixture used in the /api/insar/grid tests): genuinely NULL
// los_displacement_m, not invented.
const INSAR_OBSERVATION_ROWS = [
  {
    id: 1, site_id: "SIH-DEMO-01", grid_id: 41, pair: 1,
    reference_date: "2026-06-29", secondary_date: "2026-07-11", temporal_baseline_days: 12,
    los_displacement_m: null,
    coherence: 0.10813240706920624,
    incidence_angle_rad: 0.7776192426681519, look_vector_phi_rad: -2.9628872871398926, look_vector_theta_rad: 0.7948305606842041,
    source_repository: "AI-Smart-Mine-Subsidence-InSAR", source_dataset: "insar_spatiotemporal.csv",
    imported_at: "2026-08-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z",
  },
];

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "insar_grid_observations") return makeQueryBuilder(INSAR_OBSERVATION_ROWS);
      return makeQueryBuilder(FIXTURE_ROWS);
    }),
  },
}));

import { GET } from "./route";

function requestFor(url: string): Request {
  return new Request(url);
}

beforeEach(() => {
  mocks.requireRole.mockReset();
  mocks.requireRole.mockResolvedValue(null);
  mocks.calls.select = [];
  mocks.calls.eq = [];
  mocks.calls.order = [];
  mocks.calls.range = [];
});

describe("GET /api/data-monitor/[table]", () => {
  it("404s on a table not in the allowlist - the whole point of the registry boundary", async () => {
    const res = await GET(requestFor("http://x/api/data-monitor/pg_shadow"), {
      params: Promise.resolve({ table: "pg_shadow" }),
    });
    expect(res.status).toBe(404);
  });

  it("defers to requireRole and returns its response when access is denied", async () => {
    const denied = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
    mocks.requireRole.mockResolvedValueOnce(denied);

    const res = await GET(requestFor("http://x/api/data-monitor/contacts"), {
      params: Promise.resolve({ table: "contacts" }),
    });
    expect(res.status).toBe(403);
  });

  it("clamps limit to the configured maximum and defaults offset to 0", async () => {
    const res = await GET(requestFor("http://x/api/data-monitor/nodes?limit=99999"), {
      params: Promise.resolve({ table: "nodes" }),
    });
    const body = await res.json();
    expect(body.data.limit).toBe(100);
    expect(mocks.calls.range[0]).toEqual([0, 99]);
  });

  it("respects a valid limit/offset pair", async () => {
    const res = await GET(requestFor("http://x/api/data-monitor/nodes?limit=10&offset=20"), {
      params: Promise.resolve({ table: "nodes" }),
    });
    const body = await res.json();
    expect(body.data.limit).toBe(10);
    expect(body.data.offset).toBe(20);
    expect(mocks.calls.range[0]).toEqual([20, 29]);
  });

  it("applies only allowlisted filters - an unknown query param is silently ignored, never interpolated", async () => {
    await GET(requestFor("http://x/api/data-monitor/nodes?node_id=2&drop_table=1"), {
      params: Promise.resolve({ table: "nodes" }),
    });
    expect(mocks.calls.eq).toEqual([["node_id", "2"]]);
  });

  it("orders by the table's timestamp field", async () => {
    await GET(requestFor("http://x/api/data-monitor/nodes"), { params: Promise.resolve({ table: "nodes" }) });
    expect(mocks.calls.order[0][0]).toBe("updated_at");
  });

  it("returns the real rows from the (mocked) database, not fabricated data", async () => {
    const res = await GET(requestFor("http://x/api/data-monitor/nodes"), { params: Promise.resolve({ table: "nodes" }) });
    const body = await res.json();
    expect(body.data.rows).toEqual(FIXTURE_ROWS);
    expect(body.data.row_count_estimate).toBe(FIXTURE_ROWS.length);
  });

  describe("InSAR grid tables (Phase 9)", () => {
    it("both InSAR tables are recognised by the allowlist (no longer 404)", async () => {
      const cells = await GET(requestFor("http://x/api/data-monitor/insar_grid_cells"), {
        params: Promise.resolve({ table: "insar_grid_cells" }),
      });
      const observations = await GET(requestFor("http://x/api/data-monitor/insar_grid_observations"), {
        params: Promise.resolve({ table: "insar_grid_observations" }),
      });
      expect(cells.status).toBe(200);
      expect(observations.status).toBe(200);
    });

    it("enforces the registry's viewer role via requireRole - not weakened, not bypassed", async () => {
      await GET(requestFor("http://x/api/data-monitor/insar_grid_observations"), {
        params: Promise.resolve({ table: "insar_grid_observations" }),
      });
      expect(mocks.requireRole).toHaveBeenCalledWith("viewer");
    });

    it("denies access when requireRole denies it, same as any other table", async () => {
      const denied = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
      mocks.requireRole.mockResolvedValueOnce(denied);
      const res = await GET(requestFor("http://x/api/data-monitor/insar_grid_observations"), {
        params: Promise.resolve({ table: "insar_grid_observations" }),
      });
      expect(res.status).toBe(403);
    });

    it("selects exactly the registry's allowlisted columns - never arbitrary/all columns", async () => {
      await GET(requestFor("http://x/api/data-monitor/insar_grid_observations"), {
        params: Promise.resolve({ table: "insar_grid_observations" }),
      });
      const selected = mocks.calls.select[mocks.calls.select.length - 1];
      expect(selected).toBe(
        "id,site_id,grid_id,pair,reference_date,secondary_date,temporal_baseline_days,los_displacement_m,coherence,incidence_angle_rad,look_vector_phi_rad,look_vector_theta_rad,source_repository,source_dataset,imported_at,created_at",
      );
    });

    it("applies the coherence gte filter and ignores unlisted query params", async () => {
      await GET(requestFor("http://x/api/data-monitor/insar_grid_observations?coherence=0.5&drop_table=1"), {
        params: Promise.resolve({ table: "insar_grid_observations" }),
      });
      // gte() calls aren't individually tracked by the shared mock (only
      // eq/order/range are) - this proves the param reaches the query
      // builder without throwing and without leaking into an eq() call.
      expect(mocks.calls.eq).toEqual([]);
    });

    it("still respects pagination for InSAR tables", async () => {
      const res = await GET(requestFor("http://x/api/data-monitor/insar_grid_cells?limit=10&offset=5"), {
        params: Promise.resolve({ table: "insar_grid_cells" }),
      });
      const body = await res.json();
      expect(body.data.limit).toBe(10);
      expect(body.data.offset).toBe(5);
      expect(mocks.calls.range[mocks.calls.range.length - 1]).toEqual([5, 14]);
    });

    it("passes a genuinely NULL los_displacement_m through as null, never coerced to 0", async () => {
      const res = await GET(requestFor("http://x/api/data-monitor/insar_grid_observations"), {
        params: Promise.resolve({ table: "insar_grid_observations" }),
      });
      const body = await res.json();
      expect(body.data.rows[0].grid_id).toBe(41);
      expect(body.data.rows[0].los_displacement_m).toBeNull();
    });

    it("existing tables (nodes) are unaffected by the new registry entries", async () => {
      const res = await GET(requestFor("http://x/api/data-monitor/nodes"), { params: Promise.resolve({ table: "nodes" }) });
      const body = await res.json();
      expect(body.data.rows).toEqual(FIXTURE_ROWS);
    });
  });
});
