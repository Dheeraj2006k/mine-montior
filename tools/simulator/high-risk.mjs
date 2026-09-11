import { loadEnv, adminClient, nextSeqNum } from "./lib.mjs";

const SITE_ID = "SIH-DEMO-01";
const NODE_ID = 2;

// Accelerating displacement/tilt over a handful of readings, then an
// escalating cluster_event — exercises the alert engine end-to-end.
export async function runHighRisk({ steps = 6 } = {}) {
  const env = loadEnv();
  const admin = adminClient(env);
  let seqNum = await nextSeqNum(admin, SITE_ID, NODE_ID);

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const risk = 0.2 + t * 0.6;
    const payload = {
      type: "reading",
      schema_version: 1,
      site_id: SITE_ID,
      node_id: NODE_ID,
      hop_count: 0,
      seq_num: seqNum++,
      timestamp: new Date().toISOString(),
      logging_mode: "event",
      tilt: { x_raw: 0.1 + t * 0.3, y_raw: -0.05, x_filt: 0.1 + t * 0.3, y_filt: -0.05, unit: "deg" },
      vibration: { raw: 0.05 + t * 0.1, filt: 0.05 + t * 0.1, unit: "TBD" },
      displacement: { raw: 1 + t * 4, filt: 1 + t * 4, unit: "mm" },
      risk_score: Math.min(1, risk),
      node_status: {
        sensor_ok: true,
        low_battery: false,
        self_test_fail: false,
        comm_quality_low: false,
        calibration_stale: false,
      },
    };
    const res = await fetch(`${env.SIMULATOR_TARGET_URL ?? "http://localhost:3000"}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-gateway-key": env.GATEWAY_SHARED_SECRET },
      body: JSON.stringify(payload),
    });
    console.log(`[high-risk] reading seq=${seqNum - 1} risk=${risk.toFixed(2)} status=${res.status}`);
    await new Promise((r) => setTimeout(r, 800));
  }

  const escalateRes = await postClusterEvent(env, {
    site_id: SITE_ID,
    triggering_node_id: NODE_ID,
    evidence_score: 0.88,
    escalate: true,
    unknown: false,
    reason: "combined_evidence",
  });
  console.log(`[high-risk] cluster_event escalate status=${escalateRes.status} alert_id=${escalateRes.body?.data?.alert_id}`);
}

async function postClusterEvent(env, fields) {
  const res = await fetch(`${env.SIMULATOR_TARGET_URL ?? "http://localhost:3000"}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-gateway-key": env.GATEWAY_SHARED_SECRET },
    body: JSON.stringify({
      type: "cluster_event",
      schema_version: 1,
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHighRisk().catch((err) => {
    console.error("simulator failed:", err.message);
    process.exit(1);
  });
}
