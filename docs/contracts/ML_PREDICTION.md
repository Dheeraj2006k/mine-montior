# ML prediction contract — `GET /api/predictions/latest`

Status: **adapter implemented and live-tested; no real ML service
connected yet.** This document describes the contract the adapter
(`src/lib/adapters/ml-adapter.ts`) actually enforces — it is the boundary
the ML team's service must match, not a wishlist.

## Source-of-truth precedence

The adapter tries three sources in order and returns the first that
succeeds — the ML team does not need to coordinate a "mode flag" with this
codebase; presence of working infrastructure is the switch:

1. **Live HTTP call** to `${ML_SERVICE_URL}/predict` (only attempted if
   `ML_SERVICE_URL` is set).
2. **Most recent row** in the `predictions` table (for a batch/scheduled
   process that writes directly to Postgres instead of serving HTTP).
3. **Labelled mock** (`model_version: "mock-0.0"`, `trend: "stable"`,
   empty `predicted_zone`, everything else `null`) — returned only when
   neither of the above produced anything, and always reported to the
   frontend as `source: "mock"` in the response envelope, never silently
   presented as real.

## HTTP contract (option 1)

```
POST {ML_SERVICE_URL}/predict
Content-Type: application/json
Authorization: Bearer {ML_SERVICE_TOKEN}   (only if ML_SERVICE_TOKEN is set)

{ "site_id": "SIH-DEMO-01" }
```

- 5 second timeout (`AbortSignal.timeout(5000)`). A non-`ok` response, a
  timeout, or any thrown error is treated the same: fall through to source
  2, **never** crash the dashboard.
- Expected response body — the adapter reads these fields verbatim, so
  they are the actual contract the ML service must return:

```jsonc
{
  "model_version": "string",       // required by the adapter (passed through as-is)
  "predicted_zone": /* any JSON */, // opaque to this codebase — stored/displayed, never parsed
  "trend": "string",                // opaque — no enum enforced here (see Open Questions)
  "time_to_threshold": {
    "low_days": 12.5,               // number | null
    "high_days": 30.0,              // number | null
    "confidence": 0.6                // number | null — no documented range enforced
  },
  "generated_at": "2026-09-22T12:00:00Z" // ISO 8601 — required to compute staleness
}
```

If any of these fields are absent, the adapter passes `undefined`/
`null` through rather than validating — **there is currently no schema
validation on the ML service's response** (unlike `/api/ingest`, which
validates hardware payloads with `zod`). This is a real gap the ML team
should be aware of: a malformed response will surface as broken/undefined
values in the UI, not a clean rejection.

## DB contract (option 2)

If the ML team's process writes directly to Postgres instead of serving
HTTP, insert into the `predictions` table (migration 0001):

| Column | Type | Notes |
|---|---|---|
| `site_id` | text | must match the site this dashboard reads (`DEMO_SITE_ID`) |
| `model_version` | text | required |
| `predicted_zone` | jsonb | opaque to this codebase |
| `trend` | text | opaque, no enum enforced |
| `time_to_threshold_low_days` | real, nullable | |
| `time_to_threshold_high_days` | real, nullable | |
| `confidence` | real, nullable | |
| `generated_at` | timestamptz | defaults to `now()` if omitted; the adapter always orders by this and takes the most recent row per `site_id` |

## Prediction vs. observation — the rule this codebase enforces

Prediction output is model output, never treated as observed truth:
- `predictions`/the ML adapter feed **only** the dedicated `/predictions`
  page — grep-confirmed zero references from `predictions`/`ml-adapter.ts`
  into `alert-engine.ts`, `alert-orchestrator.ts`, or
  `site-risk-state.ts`. A model's forecast cannot itself create or
  escalate an alert in this codebase as it stands today.
- `is_stale` (computed client-side by the adapter: `now - generated_at >
  60 minutes`) must always be surfaced in the UI when true — a stale
  prediction is not deleted or hidden, it's labelled.
- `/system/health` reports `scheduled_ml_pass` as permanently `degraded`
  with the note "no scheduler wired up yet in this build" — this is
  intentionally honest, not a bug to silence (see
  `docs/decisions/ADR-004-scheduled-ml-pass.md`). The ML team's service is
  expected to own its own scheduling; this codebase only calls it and
  reports if it goes stale.

## Errors / failure behavior

There is no error response from `GET /api/predictions/latest` in the
`{error: {...}}` envelope sense — every failure mode (HTTP unreachable,
malformed body, DB empty) degrades to the mock prediction with
`source: "mock"`. The route itself does not currently sit behind an
explicit auth check beyond the general session requirement applied
platform-wide — no additional restriction is placed on prediction reads.

## Open questions for the ML team

1. **`predicted_zone` shape** — currently completely opaque (`unknown`
   type in this codebase). What does the frontend actually need to render
   it (a GeoJSON polygon? a list of node IDs? something else)? Nothing is
   currently rendered from this field beyond passing it through.
2. **`trend` enum** — no fixed set of values is enforced or documented on
   either side. Confirm the intended vocabulary (e.g. `"stable" |
   "accelerating" | "decelerating"`?) so the UI can render it meaningfully
   instead of an opaque string.
3. **`confidence` range/meaning** — is this 0–1? A percentage? What does
   `null` mean vs. `0`?
4. **Response validation** — does the ML team want this codebase to add
   strict schema validation (like `/api/ingest`'s zod schema) on the
   `/predict` response, and if so, what should happen on a validation
   failure — fall back to mock, or surface a distinct "prediction service
   returned malformed data" state?
5. **Scheduling ownership** — confirm the ML service is expected to run
   its own periodic pass and this codebase only polls the latest result;
   if that's wrong, `/api/predictions/latest`'s pull-based design needs to
   change to accept push/webhook updates instead.
6. **Per-site vs. per-node predictions** — the current contract is
   site-scoped only (`predicted_zone` for the whole site, not per node).
   Confirm this matches what the model actually produces.
