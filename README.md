# IRIS — Intelligent Real-time Instability Sensing

A mine-subsidence monitoring platform combining live sensor telemetry,
an operational alert pipeline, imported satellite (InSAR) evidence, a
predictive model integration point, and an illustrative planning
visualization — built as a reproducible demo/engineering prototype.

## 1. Overview

IRIS fuses several independent evidence sources for underground/opencast
mine instability monitoring:

- **Operational**: live sensor readings -> derived node health -> a
  managed alert lifecycle with human-verification feedback loops
  (dashboard acknowledge, IVR "press 1").
- **Supplementary**: imported InSAR satellite evidence (real production
  data, independently verified) and ML model prediction output.
- **Illustrative**: a 3D "digital twin" planning visualization.

The three are deliberately kept separate — see [Scientific
limitations](#14-scientific-limitations) — because conflating "observed,"
"predicted," and "illustrative" is the single easiest way to make a
monitoring system dangerously misleading.

## 2. Problem being solved

Underground and opencast mines need early warning of ground instability
from more than one signal, because any single cheap sensor can produce a
false positive (or a false negative from a dead sensor reading as
"quiet"). IRIS's operational pipeline fuses tilt/vibration/displacement
readings into one evidence score before escalating, tracks node health
so a *dead* sensor is never confused with a *quiet* one, and gives every
alert a human-confirmation step rather than acting on raw sensor output
alone. InSAR and prediction data supplement that operational picture as
independently-labeled evidence, never as a silent input to it.

## 3. Architecture

```
Sensors --ESP-NOW--> Gateway --HTTPS--> /api/ingest --> Supabase
                                                            |
                                                            v
                                    Dashboard / Alerts / InSAR / Twin / Data Monitor
                                                            |
                                                            v
                                          Human verification / feedback
```

Full detail, including the InSAR import flow and the auth/authorization
model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 4. Core features

- **Live sensor dashboard** — node health, active alerts, a single
  site-condition hero state (never shown as falsely "Normal" while
  waiting for first data).
- **Alert pipeline** — evidence-fused escalation, blast-window
  awareness (noted, never used to suppress severity), per-stage
  pipeline trace, email/SMS/voice notification with an IVR
  confirmation loop.
- **InSAR evidence** — a real, independently-verified production
  dataset (1,591 grid cells / 9,546 observations / 6 acquisition pairs),
  surfaced as a MapLibre map layer, a dedicated analysis page
  (`/insar`), a dashboard evidence card, and rows in the internal Data
  Monitor — never as an operational risk input.
- **Prediction integration point** — displays real ML model output
  (trend, time-to-threshold range, predicted-zone severity) when a
  service is connected; an honest "not available yet" state otherwise.
- **Digital twin (`/twin`)** — an illustrative longwall/bord-and-pillar
  visualization for demonstrating mine geometry and extraction
  progression, clearly labeled as not a validated physical simulation.
- **Data Monitor (`/system/data`)** — an internal, role-gated,
  allowlisted-table database browser for verifying what's actually in
  Supabase.
- **RBAC** — Supabase Auth + `viewer`/`operator`/`admin` roles,
  enforced server-side on every mutating and role-restricted route.

## 5. Technology stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(Postgres + RLS + Auth) · TanStack Query · MapLibre GL · Recharts ·
react-three-fiber / Three.js · Zod · Twilio · Resend · Vitest · Python
3.13 (InSAR importer only).

## 6. Repository structure

```
mine-monitor/
├── src/
│   ├── app/            Next.js App Router pages + API routes
│   ├── components/     UI components (map, status, data-monitor, twin, ...)
│   └── lib/             domain logic, adapters, auth, schemas
├── supabase/
│   └── migrations/      SQL migrations (applied manually, see §9)
├── tools/
│   ├── insar-importer/  standalone Python import pipeline
│   └── simulator/        Node.js demo/scenario data generator
├── data/
│   └── insar/            dataset documentation (data files excluded — see §10)
├── docs/                 architecture, provenance, scientific notes, demo guide
├── public/               static assets
├── .env.example
└── package.json
```

## 7. Local setup

```bash
git clone <this-repo>
cd mine-monitor
npm install
cp .env.example .env.local   # fill in real values, see §8
npm run dev
```

Open http://localhost:3000.

## 8. Environment variables

See [`.env.example`](.env.example) for the full list with explanations.
At minimum you need a Supabase project (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and a
`GATEWAY_SHARED_SECRET` for `/api/ingest`. Email/SMS/voice/ML integration
variables are optional — the app runs in an honest `DEMO_MODE` without
them.

**Never commit `.env.local`.** It is excluded by `.gitignore`; only
`.env.example` (a template with no real values) is tracked.

## 9. Database setup

1. Create a Supabase project.
2. Apply every migration in `supabase/migrations/` in order, via the
   Supabase SQL editor or `supabase db push`. Migrations are applied
   manually in this project (no CI-driven auto-migration) — do not
   re-run an already-applied migration or renumber files.
3. Seed a site row and demo nodes (see `tools/simulator/` for a scripted
   way to generate demo sensor activity once the schema exists).
4. Bootstrap the demo administrator: `npm run seed:admin`. Creates/syncs
   `admin@iris.local` / `test123` (**local/demo only** — override via
   `IRIS_ADMIN_EMAIL`/`IRIS_ADMIN_PASSWORD` for any real deployment) with
   `role = admin` via Supabase Auth's admin API — never as a plaintext
   password in an application table. Every other signup at `/signup`
   becomes `role = viewer` automatically. See
   [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#authentication--authorization-rbac)
   for the full RBAC model.

## 10. InSAR data / import workflow

The real production InSAR dataset (1,591 grid cells, 9,546 observations,
6 pairs) is already-imported into the reference Supabase project this
was built against, but **the raw data files are not included in this
repository** — redistribution permission was not confirmed with the
source repository. See [`docs/DATA_PROVENANCE.md`](docs/DATA_PROVENANCE.md)
and [`data/insar/README.md`](data/insar/README.md) for the full
explanation and for how to run the import yourself once you have the
source files and confirmed permission. The importer itself
(`tools/insar-importer/`) is fully included, tested, and documented.

## 11. Running the app

```bash
npm run dev      # local dev server
npm run build    # production build
npm run start    # run the production build
```

## 12. Testing

```bash
npm test -- --run     # Vitest, run once (no watch)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
```

The InSAR importer has its own Python test suite —
`cd tools/insar-importer && pytest` (see that directory's README).

## 13. Demo walkthrough

See [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) for a feature tour, and
[`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md) for a timed rehearsal
checklist.

## 14. Scientific limitations

This project is deliberately conservative about what it claims. Full
detail in [`docs/SCIENTIFIC_NOTES.md`](docs/SCIENTIFIC_NOTES.md);
summary:

- **Operational risk comes only from the live sensor/alert pipeline** —
  never from InSAR, the Twin, or prediction output.
- **InSAR LOS displacement is not vertical subsidence**, and a single
  acquisition pair is not an annual velocity — there is no validated
  velocity product in the source data, and none is fabricated here.
- **NULL LOS and low coherence are never shown as safe/stable/zero** —
  they render as explicit no-data / reduced-confidence states.
- **The Twin is illustrative**, not a validated physical subsidence
  simulator — its extraction-slider effects and "combined indicator" are
  fixed, simple, explicitly-labeled demo formulas, never written back to
  real risk/alerts/predictions/InSAR.
- **Prediction output is model output, not observed reality** — always
  shown as a range with a model version, never a single confident date.

## 15. Mock/demo vs. real data

- **Mock**: sensor node positions (labeled "mock position, not GNSS"
  everywhere), Twin geometry/extraction response, the Twin's illustrative
  susceptibility indicator.
- **Real**: the imported InSAR dataset, sensor readings/alerts/
  notifications written by the real ingest pipeline (whether from actual
  hardware or the `tools/simulator/` scenario generator standing in for
  it), and ML prediction output when a model service is connected.

The UI is written to make this distinction hard to miss — see
`docs/SCIENTIFIC_NOTES.md` for the exact labels used.

## 16. Security notes

- The Supabase **service-role key never reaches the browser** — it is
  read only in server-only modules (`src/lib/db/supabase-server.ts`) and
  used only in API routes / the offline importer.
- Every table has RLS enabled; the Data Monitor's only path to a table is
  a server-side allowlist (`src/lib/data-monitor/registry.ts`) — there is
  no generic database browser or arbitrary-table access anywhere.
- Role/permission checks (`requireRole`, `requirePermission`,
  `requireRolePage`) are enforced server-side on every read, mutating, and
  admin-only route and page — not just hidden in the nav. A signed-in
  session with no `role` claim resolves to `viewer`, never `admin`; the
  client can never assert its own role.
- Every new signup is `role = viewer` by default (a database trigger, not
  client logic) — nobody can choose `operator`/`admin` at signup.
- A deactivated account (`profiles.status = 'inactive'`) is denied all
  application access on the next request, regardless of role.
- Role changes, activation/deactivation, role resets, and site-ownership
  transfers are all admin-only and written to an audit trail
  (`GET /api/admin/audit`) — see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#authentication--authorization-rbac).
- `/api/ingest` requires a shared secret (`GATEWAY_SHARED_SECRET`) header.

## 17. Data provenance

See [`docs/DATA_PROVENANCE.md`](docs/DATA_PROVENANCE.md) for the full
chain of custody for the InSAR dataset, including the redistribution/
license status that led to excluding the raw files from this repository.

## 18. License / ownership status

**Application license not yet declared.** This repository does not
currently include a LICENSE file for its own source code — the
repository owner should choose and add one before publishing. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for third-party
dependency and data licensing notes.
