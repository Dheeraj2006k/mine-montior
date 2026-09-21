import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { computeNodeHealth, type ReadingLike } from "@/lib/domain/node-health";
import { requireRole } from "@/lib/auth/roles";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";

const RECENT_WINDOW = 50;

export async function GET() {
  const { data: nodes, error: nodesError } = await supabaseAdmin
    .from("nodes")
    .select("*")
    .order("node_id", { ascending: true });

  if (nodesError) {
    return fail("DATABASE_ERROR", "Failed to load nodes", [{ issue: nodesError.message }], 500);
  }

  const enriched = await Promise.all(
    (nodes ?? []).map(async (node) => {
      const { data: readings } = await supabaseAdmin
        .from("readings")
        .select("seq_num, recorded_at, sensor_ok, low_battery, comm_quality_low, calibration_stale, risk_score")
        .eq("node_id", node.node_id)
        .order("recorded_at", { ascending: false })
        .limit(RECENT_WINDOW);

      const health = computeNodeHealth((readings ?? []) as ReadingLike[]);
      const latestRiskScore = readings && readings.length > 0 ? readings[0].risk_score : null;

      return {
        ...node,
        latest_risk_score: latestRiskScore,
        ...health,
      };
    }),
  );

  return ok(enriched);
}

// PRD-2 §2 Step 3 / Phase B — node registration. Real nodes carry a real
// GNSS-registered position (captured once here, not tracked continuously);
// mock nodes stay clearly flagged everywhere downstream (existing
// is_mock / MockPositionLabel convention, unchanged).
export async function POST(request: Request) {
  const denied = await requireRole("operator");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.node_id !== "number" || typeof body.label !== "string") {
    return fail("VALIDATION_FAILED", "node_id (number) and label are required", [], 400);
  }

  const isMock = body.source !== "real";
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;

  if (latitude == null || longitude == null) {
    return fail("VALIDATION_FAILED", "latitude and longitude are required", [], 400);
  }
  if (!isMock && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    return fail("VALIDATION_FAILED", "latitude/longitude out of range for a real GNSS position", [], 400);
  }

  const registeredAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("nodes")
    .insert({
      node_id: body.node_id,
      site_id: SITE_ID,
      label: body.label,
      // Always populated - this is what the map and every existing label
      // component read, for both real and mock nodes.
      mock_latitude: latitude,
      mock_longitude: longitude,
      is_mock: isMock,
      install_note: typeof body.install_note === "string" ? body.install_note : null,
      installed_at: registeredAt,
      is_active: true,
      // Only set for real nodes - a genuine GNSS capture, not the same
      // field reused. Mock nodes never get a registered_* value.
      registered_latitude: isMock ? null : latitude,
      registered_longitude: isMock ? null : longitude,
      registered_at: isMock ? null : registeredAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return fail("DUPLICATE_NODE_ID", `Node ${body.node_id} already exists`, [], 409);
    }
    return fail("DATABASE_ERROR", "Failed to register node", [{ issue: error?.message }], 500);
  }

  return ok(data, 201);
}
