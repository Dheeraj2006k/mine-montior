# ADR-001 — Ingest path: gateway → `/api/ingest`

**Status:** Decided (implemented).

**Decision:** The gateway POSTs to `POST /api/ingest`, not directly to Supabase. Auth is a shared secret (`GATEWAY_SHARED_SECRET` via `x-gateway-key` header), not the Supabase anon key.

**Why:** Matches the implementation plan's recommendation (schema validation at the boundary, in-process alert-engine trigger, easy idempotency, a natural place to record `pipeline_trace`). Confirmed working end-to-end: Zod validation, `unique(node_id, seq_num)` dedup, and `CLOUD_INGEST`/`VALIDATION`/`PERSIST` trace stages are all live and tested.

**Fallback kept alive:** RLS still allows the anon key to INSERT (not SELECT) into `readings`/`cluster_events` directly, per `supabase/migrations/0002_rls_policies.sql` — if the firmware team can't adopt `/api/ingest`, direct-to-Supabase still works, though it bypasses validation, dedup, and alert-engine triggering. Not the primary path.
