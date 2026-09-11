import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

export function loadEnv() {
  const envText = readFileSync(path.join(projectRoot, ".env.local"), "utf8");
  const env = {};
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

export function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function nextSeqNum(admin, siteId, nodeId) {
  const { data } = await admin
    .from("readings")
    .select("seq_num")
    .eq("site_id", siteId)
    .eq("node_id", nodeId)
    .order("seq_num", { ascending: false })
    .limit(1);
  const maxSeq = data && data.length > 0 ? data[0].seq_num : 0;
  return maxSeq + 1;
}

export async function postReading(env, payload) {
  const res = await fetch(`${env.SIMULATOR_TARGET_URL ?? "http://localhost:3000"}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gateway-key": env.GATEWAY_SHARED_SECRET,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export function baselineReadingPayload({ siteId, nodeId, seqNum, riskBaseline = 0.15 }) {
  const jitter = () => (Math.random() - 0.5) * 0.02;
  const risk = Math.max(0, Math.min(1, riskBaseline + jitter()));

  return {
    type: "reading",
    schema_version: 1,
    site_id: siteId,
    node_id: nodeId,
    hop_count: 0,
    seq_num: seqNum,
    timestamp: new Date().toISOString(),
    logging_mode: "baseline",
    tilt: {
      x_raw: 0.1 + jitter(),
      y_raw: -0.05 + jitter(),
      x_filt: 0.1 + jitter() * 0.5,
      y_filt: -0.05 + jitter() * 0.5,
      unit: "deg",
    },
    vibration: { raw: 0.03 + Math.abs(jitter()), filt: 0.02 + Math.abs(jitter()) * 0.5, unit: "TBD" },
    displacement: { raw: 1.0 + jitter(), filt: 1.0 + jitter() * 0.5, unit: "mm" },
    risk_score: risk,
    node_status: {
      sensor_ok: true,
      low_battery: false,
      self_test_fail: false,
      comm_quality_low: false,
      calibration_stale: false,
    },
  };
}
