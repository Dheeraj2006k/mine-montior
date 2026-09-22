import { describe, it, expect, vi } from "vitest";

// Real grid_id=41 observations across pairs 1-2 (subset) - pair 1's
// los_displacement_m is genuinely null in the real handoff/live database,
// values copied from the live verification pass (verify_import.py),
// pair 2's value is also real (from the same production CSV).
const REAL_CELL = {
  grid_id: 41,
  geometry_4326: {
    type: "Polygon",
    coordinates: [
      [
        [87.24324094578498, 23.632054993237034],
        [87.24324228057, 23.6327],
        [87.2424, 23.6327],
        [87.2424, 23.632054993237034],
        [87.24324094578498, 23.632054993237034],
      ],
    ],
  },
};

const REAL_OBSERVATIONS = [
  {
    pair: 1,
    reference_date: "2026-06-29",
    secondary_date: "2026-07-11",
    temporal_baseline_days: 12,
    los_displacement_m: null,
    coherence: 0.10813240706920624,
    incidence_angle_rad: 0.7776192426681519,
    look_vector_phi_rad: -2.9628872871398926,
    look_vector_theta_rad: 0.7948305606842041,
  },
  {
    pair: 2,
    reference_date: "2026-07-11",
    secondary_date: "2026-07-23",
    temporal_baseline_days: 12,
    los_displacement_m: 0.04016754403710365,
    coherence: 0.3688735067844391,
    incidence_angle_rad: 0.7776275277137756,
    look_vector_phi_rad: -2.96286940574646,
    look_vector_theta_rad: 0.7948222756385803,
  },
];

function makeQueryBuilder(rows: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: rows, error: null }));
  builder.then = (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null });
  return builder;
}

vi.mock("@/lib/db/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "insar_grid_cells") return makeQueryBuilder(REAL_CELL);
      if (table === "insar_grid_observations") return makeQueryBuilder(REAL_OBSERVATIONS);
      return makeQueryBuilder([]);
    }),
  },
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: vi.fn(async () => null),
}));

import { GET } from "./route";

function requestFor(gridId: string) {
  return { params: Promise.resolve({ gridId }) };
}

describe("GET /api/insar/grid/[gridId]", () => {
  it("400s on a non-integer grid id", async () => {
    const res = await GET(new Request("http://x"), requestFor("not-a-number"));
    expect(res.status).toBe(400);
  });

  it("returns the cell geometry and all pairs for a real grid_id", async () => {
    const res = await GET(new Request("http://x"), requestFor("41"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.grid_id).toBe(41);
    expect(body.data.geometry.type).toBe("Polygon");
    expect(body.data.observations).toHaveLength(2);
  });

  it("preserves NULL los_displacement_m (and derives NULL mm) for pair 1, and converts pair 2 correctly", async () => {
    const res = await GET(new Request("http://x"), requestFor("41"));
    const body = await res.json();
    const pair1 = body.data.observations.find((o: { pair: number }) => o.pair === 1);
    const pair2 = body.data.observations.find((o: { pair: number }) => o.pair === 2);
    expect(pair1.los_displacement_m).toBeNull();
    expect(pair1.los_displacement_mm).toBeNull();
    expect(pair2.los_displacement_m).toBeCloseTo(0.04016754403710365, 12);
    expect(pair2.los_displacement_mm).toBeCloseTo(0.04016754403710365 * 1000, 12);
  });

  it("derives cell_coherence_quality per pair from that pair's own coherence", async () => {
    const res = await GET(new Request("http://x"), requestFor("41"));
    const body = await res.json();
    const pair1 = body.data.observations.find((o: { pair: number }) => o.pair === 1);
    const pair2 = body.data.observations.find((o: { pair: number }) => o.pair === 2);
    expect(pair1.cell_coherence_quality).toBe("LOW"); // 0.108...
    expect(pair2.cell_coherence_quality).toBe("LOW"); // 0.369...
  });

  it("404s when the grid cell does not exist", async () => {
    const { supabaseAdmin } = await import("@/lib/db/supabase-server");
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => makeQueryBuilder(null) as never);
    const res = await GET(new Request("http://x"), requestFor("999999"));
    expect(res.status).toBe(404);
  });
});
