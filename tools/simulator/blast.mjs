import { loadEnv, adminClient, nextSeqNum } from "./lib.mjs";

const SITE_ID = "SIH-DEMO-01";
const NODE_ID = 1;

// Sharp vibration spike, fast decay, no tilt trend — the signature a blast
// leaves vs. genuine subsidence (plan §7.3/§12.4). Schedules a blast window
// overlapping "now" first, so the alert engine's blast enrichment fires.
export async function runBlast() {
  const env = loadEnv();
  const admin = adminClient(env);
  let seqNum = await nextSeqNum(admin, SITE_ID, NODE_ID);

  const now = new Date();
  await admin.from("blast_schedule").insert({
    site_id: SITE_ID,
    panel_label: "Panel A3 (simulated)",
    planned_start: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    planned_end: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    entered_by: "simulator",
    note: "blast.mjs scenario",
  });
  console.log("[blast] scheduled a blast window overlapping now");

  const spikeSteps = [0.05, 0.4, 0.9, 0.5, 0.15, 0.06]; // sharp rise, fast decay
  for (const vibration of spikeSteps) {
    const payload = {
      type: "reading",
      schema_version: 1,
      site_id: SITE_ID,
      node_id: NODE_ID,
      hop_count: 0,
      seq_num: seqNum++,
      timestamp: new Date().toISOString(),
      logging_mode: "event",
      tilt: { x_raw: 0.1, y_raw: -0.05, x_filt: 0.1, y_filt: -0.05, unit: "deg" }, // flat — no tilt trend
      vibration: { raw: vibration, filt: vibration * 0.9, unit: "TBD" },
      displacement: { raw: 1.0, filt: 1.0, unit: "mm" }, // flat — no displacement trend
      risk_score: Math.min(1, vibration * 0.6),
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
    console.log(`[blast] reading seq=${seqNum - 1} vibration=${vibration} status=${res.status}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  const res = await fetch(`${env.SIMULATOR_TARGET_URL ?? "http://localhost:3000"}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-gateway-key": env.GATEWAY_SHARED_SECRET },
    body: JSON.stringify({
      type: "cluster_event",
      schema_version: 1,
      site_id: SITE_ID,
      timestamp: new Date().toISOString(),
      triggering_node_id: NODE_ID,
      evidence_score: 0.7,
      escalate: true,
      unknown: false,
      reason: "strong_single_signal",
    }),
  });
  const body = await res.json().catch(() => null);
  console.log(`[blast] cluster_event escalate status=${res.status} alert_id=${body?.data?.alert_id}`);
  console.log("[blast] check the alert detail page: severity should show unchanged, but blast_suspected=true with the overlap note");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBlast().catch((err) => {
    console.error("simulator failed:", err.message);
    process.exit(1);
  });
}
