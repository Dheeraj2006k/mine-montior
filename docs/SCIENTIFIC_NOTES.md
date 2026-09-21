# Scientific notes

This document is the single reference for what IRIS's data actually
means, and - just as importantly - what it does not mean. Every
user-facing label in the app is expected to be consistent with this
document. If you find one that isn't, that's a bug.

## LOS displacement

`los_displacement_m` (InSAR) is the **line-of-sight (LOS) displacement**
between two satellite acquisition dates for one 80m x 80m grid cell,
measured in metres, stored with full source precision (`double
precision`, never down-cast to `real`).

- **Not vertical subsidence.** LOS displacement is the component of
  ground motion along the satellite's viewing direction, not the vertical
  component. Converting LOS to vertical displacement requires the
  incidence angle and an assumption about motion direction (usually pure
  vertical) that this dataset does not validate. IRIS never performs this
  conversion and never labels LOS displacement as "subsidence,"
  "vertical movement," or "ground drop."
- **Not a rate or velocity.** Each pair measures displacement between
  exactly two dates (`reference_date` -> `secondary_date`), a handful of
  days to weeks apart (`temporal_baseline_days`). There is no
  `insar_los_velocity_mm_per_year` field anywhere in the schema - it was
  deliberately never added, because the source handoff contains no
  validated multi-date velocity product (`insar_handoff_schema.json`
  status: `PENDING_VALIDATION`). "Pairwise LOS displacement" or "LOS
  displacement between {date} and {date}" are the only honest framings.
- **Display units.** Stored in metres in the database; converted to
  millimetres (`los_displacement_mm = los_displacement_m * 1000`) only
  for display, via one shared function (`toDisplacementMm` in
  `src/lib/insar-grid/coherence.ts`) - never re-derived ad hoc at a call
  site.

## NULL LOS displacement

39 of the 9,546 imported observations have a genuinely missing
`los_displacement_m` - the source handoff simply has no value for that
cell/pair (commonly due to decorrelation or processing failure for that
specific acquisition). This is preserved as SQL `NULL` end-to-end:
database -> API (`los_displacement_m: null`, `los_displacement_mm: null`)
-> UI (`"No LOS measurement"` or `"-"`, never `"0"`, never `"0.00 mm"`,
never a green/safe/stable indicator).

## Coherence and cell coherence quality

`coherence` is a 0-1 InSAR coherence value per cell per pair. Low
coherence means **reduced measurement reliability**, not zero ground
motion - a decorrelated (low-coherence) cell simply cannot be measured
confidently in either direction.

`cell_coherence_quality` is a derived `GOOD`/`LOW` label
(`coherence >= 0.5` -> `GOOD`, else `LOW`), computed by exactly one
function (`cellCoherenceQuality` in `src/lib/insar-grid/coherence.ts`)
and reused everywhere it's shown (API, map layer, analysis page, Data
Monitor). It is deliberately **not** the same thing as the source
handoff's separate `coherence_ge_0_5_percent` pair-level temporal QC
metric (a percentage of pixels above threshold across an entire pair) -
that value is not imported into this application at all, to avoid
conflating a per-cell classification with a pair-level QC statistic.

Low coherence is never rendered as green, "safe," "stable," or "zero
movement" - only as visually de-emphasized (reduced opacity on the map,
a neutral badge elsewhere), while remaining fully visible.

## Prediction vs. observation

`predictions` (the ML model's `trend`/`time_to_threshold`/`predicted_zone`
output) and InSAR evidence are two separate, never-merged concepts:

- **Prediction is model output** - always labeled as such ("Predicted
  deformation (model output - not observed)"), always shown as a range
  (never a single date), and carries its own `model_version`/`confidence`/
  `is_stale` fields.
- **InSAR is observed satellite evidence** - real measured LOS
  displacement and coherence, not a forecast.

Neither feeds into the operational risk score, the alert engine, or the
other. Operational risk (`siteRiskState()`) is computed solely from live
sensor readings and active alerts - see `src/lib/domain/site-risk-state.ts`.

## InSAR is supplementary evidence, not an alert trigger

No code path exists from `insar_grid_observations`/`insar_node_features`
into `src/lib/domain/alert-engine.ts`, `notification-engine.ts`, or
`siteRiskState()`. InSAR data is read-only evidence surfaced on the
dashboard, `/insar`, and the Data Monitor - it never triggers, escalates,
or suppresses an alert, and never contributes a numeric term to the
operational risk score.

## The Twin (`/twin`) is illustrative, not a simulation

The digital twin is a **demonstration / planning visualization**, not a
validated physical subsidence model. Specifically:

- The bord-and-pillar pillar-removal pattern and roof-plane sag are a
  fixed, simple, explicitly-illustrative function of the extraction %
  slider (`src/app/(app)/twin/twin-demo-logic.ts`) - not a rock-mechanics
  or finite-element calculation.
- The "combined indicator" blends a real live node risk score with the
  extraction % slider via one fixed, unvalidated formula, purely for
  demonstration - rendered with a dedicated neutral
  "illustrative"-styled badge (`IllustrativeSusceptibilityBadge`), never
  the operational `RiskBadge`/risk-color palette, so it cannot be
  mistaken for a real risk score.
- PHSR/CPHSR (Pillar Health/Stability Rating concepts) are explicitly
  labeled "Illustrative planning baseline - not available as a validated
  structural model." No numeric PHSR/CPHSR value is ever fabricated.
- The longwall terrain's predicted deformation visualization is driven by
  real `predicted_zone` model output (scaled for the 3D view), always
  labeled "Predicted deformation (model output - not observed)."
- The extraction slider and the planning-mode "hypothetical" days slider
  affect **only** this page's own visualization state - never
  operational risk, alerts, predictions, or InSAR.

A persistent banner ("Illustrative model - not a validated physical
simulation") is shown on `/twin` regardless of mode or mine type.

## Mock vs. real data

- **Mock sensor node positions** (`nodes.mock_latitude`/`mock_longitude`)
  are illustrative, not GNSS-surveyed - labeled "mock position (not
  GNSS)" everywhere they appear (map markers, node detail, Twin pins).
  A future real deployment would populate `registered_latitude`/
  `registered_longitude` from an actual GNSS survey; that path exists in
  the schema but is not populated in this demo.
- **The imported InSAR grid is real, independently-verified production
  data** (see `docs/DATA_PROVENANCE.md`) - not mock, not synthetic.
- **Sensor readings, cluster events, and alerts** are real rows written
  by `/api/ingest` (either from real hardware via the gateway, or the
  `tools/simulator/` scenario scripts standing in for hardware in a
  demo) - the pipeline logic itself does not know or care which.
- **Prediction output** is real model output when an ML service is
  connected; otherwise the app shows an honest "Prediction not available
  yet" state, never a fabricated forecast.

## Geography note: mock sensors vs. the real InSAR grid

The mock sensor node cluster and the real imported InSAR grid are **not
co-located** - they cover genuinely different geographic areas (the mock
nodes sit near a placeholder demo coordinate; the InSAR grid covers the
real Shyamsundarpur site surveyed by the source dataset). IRIS does not
move either dataset to make them appear aligned, and does not fabricate
a site AOI or GNSS reference position to reconcile them. The dashboard's
InSAR Evidence card says so explicitly and links to `/insar` (which
renders the InSAR grid on its own map, at its own real coordinates)
rather than silently recentering the shared sensor map.
