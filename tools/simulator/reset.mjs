import { loadEnv, adminClient } from "./lib.mjs";

// Clears transactional/demo data while keeping the seeded sites/nodes/contacts.
// DESTRUCTIVE — run deliberately (`npm run simulate:reset`), never automatically.
const TABLES_TO_CLEAR = [
  "pipeline_trace",
  "audit_log",
  "alert_feedback",
  "call_sessions",
  "notifications",
  "alerts",
  "cluster_events",
  "readings",
  "blast_schedule",
];

async function main() {
  const env = loadEnv();
  const admin = adminClient(env);

  for (const table of TABLES_TO_CLEAR) {
    // Supabase requires a filter on delete; match every row via a condition
    // that's always true for an identity/bigint PK.
    const { error, count } = await admin.from(table).delete({ count: "exact" }).gte("id", 0);
    if (error) {
      console.error(`${table}: FAILED — ${error.message}`);
    } else {
      console.log(`${table}: cleared ${count ?? "?"} rows`);
    }
  }
  console.log("\nSites, nodes, and contacts were left untouched.");
}

main().catch((err) => {
  console.error("reset failed:", err.message);
  process.exit(1);
});
