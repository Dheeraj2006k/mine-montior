# ADR-004 — Who runs the scheduled background prediction pass

**Status:** Decided (matches the plan's recommendation), not yet implemented — correctly, since it depends on infrastructure this pass doesn't own.

**Decision:** The ML team's FastAPI service owns the scheduler internally (it's a persistent process, unlike this Next.js app's serverless-shaped routes). This codebase's job is only to:

1. Expose `GET /api/predictions/latest` — done, via `src/lib/adapters/ml-adapter.ts`. Prefers a live FastAPI call (`ML_SERVICE_URL`) over a DB row over a labelled mock, and computes `is_stale` if the last prediction is older than 60 minutes.
2. Notice and surface if the pass silently stops — done, on `/system` (`GET /api/system/health`). Currently always reports `degraded` for `scheduled_ml_pass` with the note "no scheduler wired up yet in this build," which is the honest state until a real ML service exists.

**Action still needed once the ML service is real:** point `ML_SERVICE_URL` at it; nothing else in this codebase needs to change (the adapter boundary is the whole point — see plan §4.2 and Phase 8's exit criterion).
