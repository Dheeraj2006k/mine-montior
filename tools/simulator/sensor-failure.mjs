import { loadEnv, adminClient, nextSeqNum } from "./lib.mjs";

const SITE_ID = "SIH-DEMO-01";
const NODE_ID = 2;

// sensor_ok=false — exercises the UNKNOWN path (PRD §14.1: never render
// this as green/normal). Also fires a cluster_event with unknown=true so
// the alert engine's "unknown is not suppressed" rule is demonstrable.
export async function runSensorFailure() {
  const env = loadEnv();
  const admin = adminClient(env);
  let seqNum = await nextSeqNum(admin, SITE_ID, NODE_ID);

  const payload = {
    type: "reading",
    schema_version: 1,
    site_id: SITE_ID,
    node_id: NODE_ID,
    hop_count: 0,
    seq_num: seqNum++,
    timestamp: new Date().toISOString(),
    logging_mode: "event",
    tilt: { x_raw: 0, y_raw: 0, x_filt: 0, y_filt: 0, unit: "deg" },
    vibration: { raw: 0, filt: 0, unit: "TBD" },
    displacement: { raw: 0, filt: 0, unit: "mm" },
    risk_score: 0,
    node_status: {
      sensor_ok: false,
      low_battery: false,
      self_test_fail: true,
      comm_quality_low: false,
      calibration_stale: false,
    },
  };
  const res = await fetch(`${env.SIMULATOR_TARGET_URL ?? "http://localhost:3000"}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-gateway-key": env.GATEWAY_SHARED_SECRET },
    body: JSON.stringify(payload),
  });
  console.log(`[sensor-failure] reading seq=${seqNum - 1} sensor_ok=false status=${res.status}`);
  console.log("[sensor-failure] check /nodes: this node should now show UNKNOWN (grey), never green");

  const eventRes = await fetch(`${env.SIMULATOR_TARGET_URL ?? "http://localhost:3000"}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-gateway-key": env.GATEWAY_SHARED_SECRET },
    body: JSON.stringify({
      type: "cluster_event",
      schema_version: 1,
      site_id: SITE_ID,
      timestamp: new Date().toISOString(),
      triggering_node_id: NODE_ID,
      evidence_score: 0.5,
      escalate: true,
      unknown: true,
      reason: "sensor_health_unknown",
    }),
  });
  const body = await eventRes.json().catch(() => null);
  console.log(`[sensor-failure] cluster_event unknown=true status=${eventRes.status} alert_id=${body?.data?.alert_id}`);
  console.log("[sensor-failure] this alert must exist, not be suppressed — unknown is never treated as safe");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSensorFailure().catch((err) => {
    console.error("simulator failed:", err.message);
    process.exit(1);
  });
}
