# InSAR handoff contract

Status: **implemented, imported, live-verified** against the production
handoff from `AI-Smart-Mine-Subsidence-InSAR`. For import provenance and
verification methodology, see `docs/DATA_PROVENANCE.md` — this document
covers the **schema and semantics** this application actually stores and
serves, as the currently supported real handoff.

## Two tables, not one

`insar_grid_cells` (static geometry, one row per `grid_id`, shared across
all pairs) and `insar_grid_observations` (one row per `grid_id` per
`pair`) are deliberately separate — a cell's shape is a fact about the
cell, not about any one pair's measurement. See migration
`0007_insar_grid_cells_and_observations.sql` for the authoritative DDL.

## `insar_grid_cells`

| Field | Type | Notes |
|---|---|---|
| `site_id` | text | |
| `grid_id` | int | unique per `(site_id, grid_id)`; **not** a physical sensor node id — see "Node ↔ InSAR mapping" below |
| `geometry_4326` | GeoJSON `Polygon`, jsonb | reprojected once at import time from the source GPKG's native **EPSG:32645**; coordinates in this table and in every API response are **EPSG:4326** (lon/lat), never the source CRS |
| `source_repository`, `source_dataset` | text | provenance, defaults to the real handoff filenames |
| `imported_at` | timestamptz | when this cell's geometry was imported — this is a static/one-time value, not a live event stream |

80m × 80m production InSAR sampling cells. **1,591 unique `grid_id` values**
confirmed both at the source and independently re-verified against the
live database post-import.

## `insar_grid_observations`

| Field | Type | Notes |
|---|---|---|
| `site_id`, `grid_id` | | FK to `insar_grid_cells (site_id, grid_id)` |
| `pair` | int | acquisition pair number — **6 distinct pairs** in the current handoff |
| `reference_date`, `secondary_date` | date | the two acquisition dates this pair's displacement is measured between |
| `temporal_baseline_days` | int | `secondary_date - reference_date` |
| `los_displacement_m` | double precision, **nullable** | see below |
| `coherence` | double precision, `0–1`, `not null` | see below |
| `incidence_angle_rad`, `look_vector_phi_rad`, `look_vector_theta_rad` | double precision, nullable | satellite look-vector geometry, passed through unmodified |

**9,546 observation rows** total (1,591 cells × 6 pairs, minus none
missing — every cell has an observation for every pair). Unique on
`(site_id, grid_id, pair)`.

### `los_displacement_m` — what it is and is not

- **Line-of-sight displacement only** — NOT vertical subsidence. No
  vertical-decomposition column exists anywhere in this schema.
- **Pair-relative, not a velocity.** A single pair measures displacement
  between exactly two dates. There is no `insar_los_velocity_mm_per_year`
  field or equivalent anywhere in this schema, deliberately — the source
  handoff's own schema documentation marks any such validated-velocity
  product as `PENDING_VALIDATION`. Do not derive or display an annualized
  rate from this table.
- **Null means genuinely missing**, not zero. **39 of the 9,546 rows are
  `NULL`** in the current handoff (confirmed at source and re-confirmed
  live post-import). Every layer of this application — API
  (`toDisplacementMm()` in `src/lib/insar-grid/coherence.ts`), the
  MapLibre paint expression, the cell detail panel — must preserve `NULL`
  as `NULL`/"No LOS measurement", never coerce to `0`. This is enforced
  by code review and by `insar-palette.test.ts`, not by a DB constraint
  (a `NOT NULL` constraint would be scientifically wrong here).
- **Unit**: metres in the database; the API (`GET /api/insar/grid`)
  additionally returns `los_displacement_mm` (×1000, null-safe) as a
  convenience for the frontend, alongside the original metres value.

### `coherence` and `cell_coherence_quality`

- Raw `coherence` (0–1) is stored for every row, always present
  (`not null`), even for low-quality cells — coherence itself is never
  the thing that's missing, only the displacement measurement sometimes
  is.
- The application derives `cell_coherence_quality: "GOOD" | "LOW"` from
  this value with a single threshold, `coherence >= 0.5`
  (`cellCoherenceQuality()` in `src/lib/insar-grid/coherence.ts`) — the
  **only** place this threshold is implemented; every consumer (API,
  MapLibre fill-opacity expression, cell detail panel) calls this
  function rather than re-implementing the comparison.
- **Low coherence cells are never hidden or zeroed.** They render at
  reduced opacity (0.35 vs. 0.75 for GOOD) — de-emphasized, not absent —
  and are never treated as "stable" or "no movement."
- This per-cell numeric `coherence` is **distinct from** the source
  handoff's separate pair-level `coherence_ge_0_5_percent` temporal QC
  classification (percentage of pixels above threshold across an entire
  pair) — that field is **not imported** into this application at all.
  Do not conflate the two if referencing the original handoff schema.

## API surface

`GET /api/insar/grid?pair={n}&limit={1-1000}&offset={n}&coherence_min={0-1}&coherence_max={0-1}`
returns a GeoJSON `FeatureCollection`. Each feature's `properties`:

```jsonc
{
  "grid_id": 41,
  "pair": 1,
  "reference_date": "2026-06-29",
  "secondary_date": "2026-07-11",
  "temporal_baseline_days": 12,
  "los_displacement_m": null,          // real value or null — never 0 for missing
  "los_displacement_mm": null,         // derived, same null-safety
  "coherence": 0.108132407069206,
  "cell_coherence_quality": "LOW",     // derived, see above
  "incidence_angle_rad": 0.777619242668152,
  "look_vector_phi_rad": -2.96288728713989,
  "look_vector_theta_rad": 0.794830560684204
}
```

`GET /api/insar/grid/[gridId]` returns one cell's geometry plus its full
observation history across all pairs. `pair` is a **required** query
parameter on the grid-list endpoint — there is no "all pairs at once"
response, by design (avoids ever accidentally rendering displacement
values from two different date ranges as if they were comparable).

Both endpoints require an authenticated session (`viewer`+) — no anonymous
access, confirmed live.

## Scientific limitations (must stay visible in any consumer)

1. Not a validated velocity/time-series product — single-pair only.
2. LOS, not vertical — cannot be directly compared to a vertical
   subsidence measurement without the look-vector geometry, which is
   provided but not applied by this application.
3. Coherence below 0.5 is a real, visible-but-reduced-confidence
   measurement, not a "no data" state distinct from `los_displacement_m
   IS NULL`.
4. **No code path from either InSAR table into `alert-engine.ts`,
   `alert-orchestrator.ts`, `notification-engine.ts`, or
   `site-risk-state.ts`** — grep-confirmed. InSAR is supplementary
   observational evidence only, never an alert trigger, matching the
   "Supplementary evidence — not a standalone alert trigger" banner shown
   on the `/insar` page itself.

## Node ↔ InSAR mapping — does not exist

`insar_grid_cells.grid_id` has **no relationship** to `nodes.node_id`
anywhere in the schema or application code. The two are visually
overlaid on the same map (`/insar` page shows both node markers and the
InSAR grid) purely for spatial/geographic context — there is no foreign
key, join, or code path that associates a specific sensor node with a
specific InSAR grid cell. **Do not add one without an explicit mapping
contract from the source teams** (which grid cell, if any, corresponds
to which physical node's installed position, and what confidence that
mapping carries) — the task authorizing this document explicitly
prohibits inventing this mapping.

## Open questions for the InSAR team

1. **Node ↔ grid_id mapping** — is there an intended correspondence
   between physical sensor node positions and specific `grid_id` cells?
   If so, what's the authoritative source for it (nearest-cell by
   coordinate? an explicit table from your side?), and what happens when
   a node isn't near any cell?
2. **Additional pairs** — the current handoff has 6 pairs; confirm the
   cadence/expected update frequency for new pairs, and whether new pairs
   arrive via the same importer or a different mechanism.
3. **`coherence_ge_0_5_percent` (pair-level QC)** — currently not
   imported. Is there a use case for surfacing it (e.g. "this whole
   pair's acquisition was poor quality"), separate from per-cell
   coherence?
4. **Validated velocity product** — status is `PENDING_VALIDATION` per
   your own handoff schema. When (if ever) that becomes available, what
   should the contract for it look like — a new nullable column on
   `insar_grid_observations`, or a separate table?
5. **Redistribution/license** — per `docs/DATA_PROVENANCE.md`, no
   explicit license was found for the source handoff data. Needs
   resolution before the raw files can be added to this repository (they
   currently are not).
