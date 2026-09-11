import { loadEnv, adminClient, nextSeqNum, postReading, baselineReadingPayload } from "./lib.mjs";

const SITE_ID = "SIH-DEMO-01";
const NODE_IDS = [1, 2];

export async function runNormal({ iterations = 10, intervalMs = 3000 } = {}) {
  const env = loadEnv();
  const admin = adminClient(env);

  const seqCursors = {};
  for (const nodeId of NODE_IDS) {
    seqCursors[nodeId] = await nextSeqNum(admin, SITE_ID, nodeId);
  }

  for (let i = 0; i < iterations; i++) {
    for (const nodeId of NODE_IDS) {
      const seqNum = seqCursors[nodeId]++;
      const payload = baselineReadingPayload({ siteId: SITE_ID, nodeId, seqNum });
      const { status, body } = await postReading(env, payload);
      const ok = status === 202 || status === 200;
      console.log(
        `[normal] node=${nodeId} seq=${seqNum} status=${status} ${ok ? "ok" : "FAILED: " + JSON.stringify(body)}`,
      );
    }
    if (i < iterations - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNormal().catch((err) => {
    console.error("simulator failed:", err.message);
    process.exit(1);
  });
}
