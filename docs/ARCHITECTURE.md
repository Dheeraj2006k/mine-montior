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

## Authentication & authorization (RBAC)

```
Supabase Auth (email/password)
    v
profiles table (role, status, assigned_site_id) - auto-created viewer
    v                                              row on signup (migration 0009 trigger)
role: viewer | operator | admin
    v
site access / ownership (sites.owner_user_id, profiles.assigned_site_id)
    v
permission matrix (src/lib/auth/permissions.ts)
```

- Supabase Auth (email/password) via `@supabase/ssr`; `src/middleware.ts`
  protects `/dashboard`, `/nodes`, `/alerts`, `/twin`, `/admin`,
  `/system`, `/setup`, `/predictions`, `/insar` - redirecting
  unauthenticated requests to `/login`, and deactivated accounts
  (`profiles.status = 'inactive'`) to `/login?error=inactive` (signing them
  out first).
- **Roles.** `viewer` < `operator` < `admin`, stored on the `profiles`
  table (`supabase/migrations/0006_profiles.sql`, hardened in
  `0009_rbac_hardening.sql`). Every new Supabase Auth signup gets a
  `profiles` row via an `on_auth_user_created` trigger with
  `role = 'viewer'` - the least-privilege default is a real column default
  plus a trigger, not something application code has to remember to set.
  A pre-migration account with no profile row also resolves to
  viewer/active (`src/lib/auth/roles.ts` `getCurrentUserRole`), never
  admin - there is no "default to admin" fallback in this build.
- **Permissions.** `src/lib/auth/permissions.ts` is the single source of
  truth for what each role can do (`dashboard.view`, `alerts.acknowledge`,
  `roles.manage`, `ownership.manage`, ...). Every route, layout, and page
  calls one of four shared helpers in `src/lib/auth/roles.ts` rather than
  comparing role strings inline:
  - `requireRole(min)` / `requirePermission(permission)` - API route
    guards, return a 401/403 `NextResponse` or `null` (proceed).
  - `requireRolePage(min)` - Server Component/layout guard, redirects
    instead of returning JSON (used by every `/admin/*` and `/setup`
    page as defense in depth on top of the API-level guard).
  - `hasRole(role, min)` - synchronous boolean for client components that
    already have a resolved role (e.g. disabling an Acknowledge button for
    a viewer rather than just letting the API reject it).
  Nav visibility (`src/components/layout/app-shell.tsx` `visibleFor`) is
  presentation only - hiding a link is a UX courtesy, never the security
  boundary; every API route re-checks independently.
- **Site ownership.** Single-tenant prototype (`src/lib/config/site.ts`),
  so ownership is one column: `sites.owner_user_id`. "Assigned users" is
  every `profiles` row whose `assigned_site_id` matches the site.
  Transfers go through `/api/admin/ownership` (admin-only,
  `requirePermission("ownership.manage")`), which validates the new owner
  exists and is active, updates the owner column atomically, and always
  writes an audit row with the previous and new owner - history is
  preserved via the audit trail rather than by deleting anything.
- **Audit.** Role changes, activation/deactivation, role resets, and
  ownership transfers are written to the existing generic `audit_log`
  table (shared with the alert pipeline's own audit rows) via
  `src/lib/auth/audit.ts`, with `actor_user_id`/`target_user_id` columns
  (migration 0009) so they're queryable relationally. Read via
  `GET /api/admin/audit` (admin-only) and the `/admin/audit` page.
- RLS is enabled on every table; the anon/authenticated Postgres roles
  have no broad write access, and the service-role key (which bypasses
  RLS) is read only from `process.env` in server-only modules, never sent
  to the browser. All RBAC mutations go through service-role API routes
  guarded by the helpers above - the browser never gets a path to write
  `profiles.role` or `sites.owner_user_id` directly.

### Permission matrix

| Permission | viewer | operator | admin |
| --- | --- | --- | --- |
| dashboard.view / map.view / alerts.view / insar.view / twin.view / readings.view | Y | Y | Y |
| alerts.acknowledge / alerts.investigate / alerts.note | - | Y | Y |
| nodes.operational_action (node registration) | - | Y | Y |
| users.view / users.manage / roles.manage | - | - | Y |
| ownership.manage / sites.manage | - | - | Y |
| settings.manage / audit.view | - | - | Y |

### Demo admin bootstrap

`npm run seed:admin` (`tools/seed-admin.mjs`) creates or upgrades the
bootstrap administrator via Supabase Auth's admin API - it never writes a
password into any application table. Credentials come from
`IRIS_ADMIN_EMAIL` / `IRIS_ADMIN_PASSWORD`, defaulting to the documented
local/demo values (`admin@iris.local` / `test123`) only when unset; see
`docs/DEMO_GUIDE.md`. The script is idempotent and never resets an
existing user's password - re-running it just re-syncs that account's
`profiles` row to `role = admin, status = active`.

## Known, deliberately-deferred item

`next build` prints a deprecation notice for the `middleware.ts`
convention in favor of a `proxy.ts` convention. This file is the
authentication gate for every protected route, so it was left as-is for
this pass rather than migrated as a "cleanup" - a convention rename to a
security-relevant file deserves its own reviewed change, not a bundled
cosmetic pass.
