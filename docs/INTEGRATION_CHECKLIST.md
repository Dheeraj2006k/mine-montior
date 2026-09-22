# Integration checklist

Tracks what's actually done vs. pending for each external-team
integration and for production deployment. See `docs/contracts/` for the
detailed contract each section references — this file is the
at-a-glance status, not a duplicate of the detail.

Node positions remain mock/assigned coordinates (`nodes.is_mock`) until a
real GNSS-registered handoff exists. No item below should be checked off
by fabricating real coordinates, real ML output, or a real node↔InSAR
mapping to make the checklist look more complete than the system is.

## Hardware team — see `docs/contracts/HARDWARE_INGEST.md`

- [x] `POST /api/ingest` implemented, schema-validated (zod), live-tested
- [x] Shared-secret gateway auth (`x-gateway-key` / `GATEWAY_SHARED_SECRET`)
- [x] Idempotent reading ingest (`(node_id, seq_num)` unique, duplicate → 200 not error)
- [x] `pipeline_trace` written for every stage of every request
- [x] Node registration (`POST /api/nodes`, operator+) with explicit mock/real source flag
- [ ] `vibration.unit` confirmed by firmware team (currently literal `"TBD"` everywhere — ADR-003)
- [ ] Per-device authentication (currently one shared secret for the whole site)
- [ ] `seq_num` reset-on-reboot behavior confirmed
- [ ] `risk_score` on-device computation documented/versioned somewhere durable
- [ ] Direct-to-Supabase anon-insert fallback (ADR-001) either fixed (RLS currently denies it live) or formally retired
- [ ] Real GNSS-registered node coordinates received for any node currently marked `is_mock: true` that should stop being mock

## ML team — see `docs/contracts/ML_PREDICTION.md`

- [x] Adapter boundary implemented (`ML_SERVICE_URL` → DB row → mock, in that order)
- [x] `GET /api/predictions/latest` live, reports `source: "live" | "mock"` honestly
- [x] Staleness detection (`is_stale`, 60 min threshold) implemented
- [x] Predictions never feed alert-engine/site-risk-state (grep-confirmed, live-verified separation)
- [ ] Real `ML_SERVICE_URL` connected (currently unset — every prediction served is `mock-0.0`)
- [ ] `predicted_zone` shape confirmed and consumed meaningfully by the UI (currently opaque passthrough)
- [ ] `trend` enum vocabulary confirmed
- [ ] `confidence` range/meaning confirmed
- [ ] Response schema validation added (currently no validation on the ML service's response, unlike `/api/ingest`)
- [ ] Scheduling ownership confirmed (this app polls; does the ML service run its own periodic pass?)

## InSAR team — see `docs/contracts/INSAR_HANDOFF.md`

- [x] Production handoff imported and independently verified (1,591 cells, 9,546 observations, 6 pairs)
- [x] `GET /api/insar/grid` + `/api/insar/grid/[gridId]` live, RBAC-gated
- [x] Null LOS displacement preserved end-to-end (never coerced to 0) — live-verified (grid_id 41/pair 1)
- [x] Low-coherence cells rendered de-emphasized, never hidden — live-verified
- [x] MapLibre rendering fixed and live-verified on production (grid overlay, click detail, pair switching)
- [x] InSAR confirmed absent from alert-engine/notification-engine/site-risk-state (grep-confirmed)
- [ ] Node ↔ `grid_id` mapping contract — **does not exist yet, deliberately not invented**
- [ ] Additional acquisition pairs beyond the current 6 — update cadence/mechanism confirmed
- [ ] Pair-level `coherence_ge_0_5_percent` QC value — confirmed not needed, or a decision to import it
- [ ] Validated velocity/time-series product — status `PENDING_VALIDATION` at source; contract shape TBD
- [ ] Source data redistribution license resolved (raw handoff files still not included in this repo)

## Notifications — see `docs/contracts/ALERT_NOTIFICATION.md`

- [x] Alert state machine implemented and RBAC-gated (operator+ for all mutations), live-verified
- [x] Every mutation writes an `audit_log` row (actor, target, before/after state) — live-verified
- [x] Email/SMS/voice adapters implemented with automatic demo-mode fallback
- [x] IVR digit 1/2/3 semantics implemented, shared between real Twilio webhook and demo simulate-feedback
- [x] `simulate-feedback` confirmed to self-disable once real Twilio credentials are present (live-verified: 403 for all roles on this project)
- [x] Suppression scoped to notifications only, never ingestion/alerting (grep-confirmed)
- [ ] Digit 9 semantics confirmed (currently accepted but no-op)
- [ ] Durable escalation scheduler (current implementation uses in-process `setTimeout`, does not survive serverless redeploy/cold start)
- [ ] Suppression window configurability (currently a hardcoded 30-minute constant, comment says "admin-configurable per plan" but no such UI exists)
- [ ] Escalation ladder beyond `escalation_priority` 1–3 confirmed as final, or extended

## Production deployment

- [x] RBAC verified live: anon/viewer/operator/admin route matrix (15 routes × 4 roles)
- [x] Signup trigger verified live (new account → `role: viewer, status: active`)
- [x] Admin workflow verified live (role change/reset, activate/deactivate, ownership transfer, audit trail)
- [x] Data Monitor registry matches live schema (`profiles`/`audit_log` columns current as of migration 0009)
- [x] 211/211 tests passing, lint clean, typecheck clean, build clean
- [x] Committed and pushed to `origin/main`
- [x] Vercel auto-deploy confirmed live (worker asset freshness + full route smoke test on the deployed URL)
- [x] Production smoke test: `/login`, `/dashboard`, `/nodes`, `/alerts`, `/insar`, `/twin`, `/system/data`, `/admin/users`, `/admin/ownership`, `/admin/audit` — all 200, zero console errors
- [ ] Durable escalation scheduler (see Notifications section — blocks reliable production alerting on Vercel's serverless model)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`/other secrets confirmed set in Vercel's own environment variable store (not verifiable from this codebase — operational task for whoever owns the Vercel project)
- [ ] Demo admin (`admin@iris.local` / `test123`) credentials rotated for any non-demo use of this production project
