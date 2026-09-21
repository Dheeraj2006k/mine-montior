# Architecture

## High-level flow

```
Sensors (tilt / vibration / displacement)
   |  ESP-NOW
   v
Gateway (mesh receiver, batches readings)
   |  HTTPS, x-gateway-key
   v
POST /api/ingest  (Next.js route)
   |
   v
Supabase Postgres (RLS-protected)
   +-- readings            (raw sensor packets)
   +-- cluster_events      (gateway's own evidence-fusion escalation candidates)
   +-- alerts              (managed incident lifecycle: severity, state, dedup)
   +-- notifications       (per-channel delivery log)
   +-- predictions         (ML model output - trend, time-to-threshold, zone)
   +-- insar_grid_cells / insar_grid_observations  (imported InSAR evidence)
   +-- pipeline_trace      (every stage of every ingest/alert request, keyed by trace_id)
   +-- audit_log           (who changed what alert/entity state, when)
   |
   v
Next.js API routes (/api/*)  -- the ONLY thing that talks to Supabase
   |  TanStack Query, polling (no direct browser->Supabase calls, no
   |  Supabase Realtime - see docs/decisions/ADR-002-realtime.md)
   v
Dashboard / Alerts / InSAR / Twin / Data Monitor / Notifications (browser)
   |
   v
Human verification / feedback (IVR "press 1", dashboard acknowledge/resolve)
```

The browser never talks to Supabase directly and never holds the
service-role key - every read/write goes through a Next.js API route,
which uses either the RLS-respecting anon client (user-scoped) or the
service-role client (`src/lib/db/supabase-server.ts`, server-only) as
appropriate.

## Ingest -> alert pipeline

1. `POST /api/ingest` validates the payload (Zod schema,
   `src/lib/schemas/ingest.ts`), checks `x-gateway-key` against
   `GATEWAY_SHARED_SECRET`, and writes a `readings` row.
2. `src/lib/domain/node-health.ts` derives per-node health
   (`normal`/`warning`/`unknown`/`stale`/`offline`) from recent readings -
   `unknown` is a real state, never silently treated as `normal`.
3. `src/lib/domain/alert-engine.ts` + `alert-orchestrator.ts` evaluate
   whether a `cluster_events`/reading pattern should create or escalate an
   `alerts` row (severity, dedup via `correlation_key`, blast-window
   overlap enrichment via `blast_schedule` - overlap is noted, never used
   to suppress severity).
4. `notification-engine.ts` fans an alert out to configured channels
   (email via Resend, SMS/voice via Twilio) - or `DEMO_MODE` simulated
   sends when no provider credentials are configured - and logs each
   attempt to `notifications`.
5. Every stage writes a `pipeline_trace` row (`trace_id`-keyed), visible
   on an alert's detail page and in the Data Monitor.

`src/lib/domain/site-risk-state.ts` derives the dashboard hero's overall
site condition from live node risk scores and active alert severities
only - it has no InSAR, Twin, or prediction input.

## InSAR flow

```
AI-Smart-Mine-Subsidence-InSAR/data/handoff/  (production handoff, external)
   |  tools/insar-importer/  (two-phase validate-then-atomic-write, offline)
   v
insar_grid_cells + insar_grid_observations  (Supabase, RLS: authenticated-select-only)
   |
   v
GET /api/insar/grid?pair=N   |   GET /api/insar/grid/:gridId
   |
   +--> MapLibre grid layer (src/components/map/insar-grid-layer.tsx),
   |    reused by the dashboard's Node map and by /insar
   +--> /insar analysis page (pair filter, summary stats, LOS/coherence
   |    histograms, cell detail panel)
   +--> Dashboard "InSAR Evidence" card (bounded to one pair, own
   |    "Confirmation Level" evidence-availability state - never a risk score)
   +--> Data Monitor (/system/data) - read-only table browser, same
        allowlisted-registry pattern as every other table
```

See `docs/SCIENTIFIC_NOTES.md` for what every field does and does not
mean, and `docs/DATA_PROVENANCE.md` for where the source data comes from
and its redistribution status.

## Twin flow

`/twin` is a client-only React Three Fiber scene
(`src/components/twin/twin-scene.tsx`) fed by already-fetched real data
(`nodes`, `predictions`, `site_config`) plus local, page-only UI state
(extraction %, scrub position, planning-mode days). Every derived number
used by the scene is a pure function in
`src/app/(app)/twin/twin-demo-logic.ts`, unit-tested independently of the
3D rendering, and never written back to any other table or subsystem.

## Data Monitor (`/system/data`)

A single allowlisted-table registry (`src/lib/data-monitor/registry.ts`)
is the only path from the browser to a database table: the API route
(`/api/data-monitor/[table]`) rejects any table name not in
`TABLE_REGISTRY`, and only selects that table's own allowlisted column
list - there is no generic SQL or arbitrary-table access anywhere in this
application.

```
browser -> /api/data-monitor/[table] -> getTableEntry(table) allowlist check
        -> requireRole(entry.minRole) -> supabaseAdmin.from(entry.key).select(entry.columns)
```

## Authentication & authorization

- Supabase Auth (email/password) via `@supabase/ssr`; `src/middleware.ts`
  protects `/dashboard`, `/nodes`, `/alerts`, `/twin`, `/admin`,
  `/system`, `/setup`, `/predictions`, `/insar` and redirects
  unauthenticated requests to `/login`.
- Application roles (`viewer` < `operator` < `admin`) live in the
  `profiles` table, enforced server-side per route via
  `requireRole(minRole)` (`src/lib/auth/roles.ts`) - never enforced by
  hiding a button in the frontend alone.
- RLS is enabled on every table; the anon/authenticated Postgres roles
  have no broad write access, and the service-role key (which bypasses
  RLS) is read only from `process.env` in server-only modules, never sent
  to the browser.

## Known, deliberately-deferred item

`next build` prints a deprecation notice for the `middleware.ts`
convention in favor of a `proxy.ts` convention. This file is the
authentication gate for every protected route, so it was left as-is for
this pass rather than migrated as a "cleanup" - a convention rename to a
security-relevant file deserves its own reviewed change, not a bundled
cosmetic pass.
