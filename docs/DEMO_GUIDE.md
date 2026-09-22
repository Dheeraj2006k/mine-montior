# Demo guide

A recommended walkthrough for showing IRIS to a judge/reviewer. For a
timed rehearsal runbook with T-minus checklist items, see
`docs/DEMO_RUNBOOK.md` (written earlier in the project, before InSAR/Twin/
Data Monitor existed - this document is the up-to-date feature tour).

Every step below is either real data or explicitly labeled illustrative/
mock - say so out loud as you go. That honesty is a feature of this
project, not an apology.

## Before you present: check the demo state

The dashboard hero reflects **real, currently-stored** rows - if past
testing/rehearsal left several `alerts` in `new`/`notified` state and a
couple of nodes reporting `offline`, the hero will honestly show
"Critical" with those counts. That is the alert engine working correctly
on real leftover data, not a bug, and it is **not** something to fix by
editing `site-risk-state.ts` or the alert engine - fix the data instead:

```bash
npm run simulate:reset   # DESTRUCTIVE: clears readings/alerts/notifications/
                          # cluster_events/etc. Keeps seeded sites/nodes/contacts.
```

After a reset, the dashboard should show "Waiting for data" (no
readings yet) rather than "Normal" - that is also correct, not a bug;
"Normal" only appears once real readings exist and are all within
range. Run a scenario (see step 2) to bring it to life for the audience,
live, instead of starting from a pre-loaded "Normal" state.

## 0. Login

`/login` - Supabase Auth email/password. Every page below except
`/login`/`/signup` requires a session (`src/middleware.ts`); role
(`viewer`/`operator`/`admin`) gates specific actions server-side, not
just in the UI. A deactivated account is signed out and redirected back to
`/login` with a clear message, even mid-session.

**Demo admin login** (run `npm run seed:admin` once against your Supabase
project first):

```
Email:    admin@iris.local
Password: test123
```

**LOCAL/DEMO ONLY** - these are the documented default bootstrap
credentials (`tools/seed-admin.mjs`, overridable via `IRIS_ADMIN_EMAIL`/
`IRIS_ADMIN_PASSWORD`). Never rely on these defaults for a real
deployment; set both env vars to real, unique values there.

**New user registration** - sign up at `/signup` with any email. The
account is created with `role = viewer` automatically (a database trigger
on `auth.users`, not client-side logic) - read-only monitoring access
only, no admin/operator UI to accidentally grant a higher role at signup.
An admin can promote the account afterward from `/admin/users`.

### Admin Control Center (`/admin/*`, admin role required)

- **Users** (`/admin/users`) - every registered user, role, active/
  inactive status, assigned site, created/last-login dates. Change role,
  deactivate/reactivate, or reset a user's role back to viewer - each a
  confirmed, audited action.
- **Role & access** (`/admin/roles`) - what viewer/operator/admin can and
  cannot do, in one place.
- **Site ownership** (`/admin/ownership`) - current owner, assigned users,
  and a confirmed ownership transfer flow (current owner -> new owner).
- **Audit** (`/admin/audit`) - every role change, activation/
  deactivation, role reset, and ownership transfer, with actor, target,
  and before/after state.
- Contacts, notification log, blast schedule, and site setup remain where
  they were - now each gated server-side (redirects a non-admin away
  before the page even renders), not just hidden from the nav.

## 1. Dashboard (`/dashboard`)

- **Command strip + hero**: one dominant site condition
  (Normal/Watch/Warning/Critical, or an honest "Waiting for data" state -
  never shown as falsely "Normal" when there's simply no data yet).
- **Node map**: real MapLibre map, mock sensor positions (labeled "mock
  position, not GNSS"), health-colored markers. Toggle "InSAR Evidence" in
  the top-right of the map to show the real imported InSAR grid as a
  second layer on the same map - point out the grid is real, the node
  positions are illustrative.
- **InSAR Evidence card**: separate from the hero/risk indicators on
  purpose. Shows "Confirmation Level" (an evidence-availability state -
  Unavailable / Available / Available - limited by coherence), not a risk
  score. "Open InSAR Analysis" goes to `/insar`.
- **Prediction panel**: real ML model output if a service is connected,
  otherwise an honest "not available yet" state - never a fabricated
  forecast.

## 2. Alerts (`/alerts`, `/alerts/:id`)

Trigger a scenario if no live hardware is connected:

```bash
npm run simulate -- --scenario high-risk
```

Watch an alert appear on the dashboard within one poll cycle (<=5s, no
manual refresh). Open it: the pipeline timeline
(`CLOUD_INGEST -> VALIDATION -> PERSIST -> ALERT_EVAL -> ALERT_CREATED ->
NOTIFY_*`) shows real per-stage latencies from `pipeline_trace`. "Simulate
IVR response" demonstrates the human-confirmation loop without a real
phone call configured.

## 3. InSAR analysis (`/insar`)

Dedicated evidence page: pick one of the 6 real acquisition pairs (real
dates, not "Pair 1/2/3"), see the map render real 80m grid cell polygons
colored by LOS displacement (diverging scale, centered on zero - not the
risk color palette), click a cell for its full detail (grid id, pair,
dates, baseline, LOS displacement in mm, coherence, cell coherence
quality, incidence/look angles). Point out: NULL LOS cells render as
explicit no-data, never green; low-coherence cells are visible but
de-emphasized. The summary stats and histograms below the map describe
the selected pair only, never claimed as a site-wide figure.

## 4. Data Monitor (`/system/data`)

Internal table browser - `viewer`+ role required, same as most read
pages. Browse `insar_grid_cells`/`insar_grid_observations` alongside the
operational tables (nodes, readings, alerts, predictions) to show the raw
imported rows match what the map/analysis page render - same allowlisted-
table architecture as every other table here, nothing InSAR-specific
bypasses it.

## 5. Twin (`/twin`)

Illustrative planning visualization - the persistent banner says so.
Switch mine type in Plain/Technical view mode; for bord-and-pillar, drag
the extraction % slider and watch pillars disappear and the roof plane
sag - purely a visualization effect, explained in `docs/SCIENTIFIC_NOTES.md`.
The "combined indicator" badge is deliberately styled differently from
the real `RiskBadge` used elsewhere, specifically so it can't be mistaken
for operational risk.

## 6. Node detail / history (`/nodes/:id`)

Real tilt/vibration/displacement/risk time series for one node, backing
the dashboard's live feed sparkline.

## Recommended sequence for a timed demo

1. Dashboard - condition + node map + InSAR toggle (1-2 min)
2. Trigger `npm run simulate -- --scenario high-risk`, show the alert
   appear + pipeline timeline (2 min)
3. `/insar` - pick a pair, click a cell, show the honesty states (2 min)
4. `/twin` - extraction slider, illustrative banner (1 min)
5. `/system/data` - only if the audience is technical (1 min)

## What to say if something doesn't work

- No ML service connected -> Prediction panel and Twin terrain are
  honestly flat/"not available yet". This is correct behavior, not a bug.
- No Twilio/Resend credentials -> notifications run in `DEMO_MODE`
  (simulated, logged, not actually delivered) - say so.
- Venue WiFi is a captive portal -> use a mobile hotspot; the gateway
  path needs a plain HTTPS connection.
