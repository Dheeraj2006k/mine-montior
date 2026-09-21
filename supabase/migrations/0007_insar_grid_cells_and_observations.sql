-- Production grid-level InSAR (INSAR_INTEGRATION_DESIGN.md, Revision 3 -
-- authoritative spec for this migration). Additive - does not touch 0001-
-- 0006, does not touch the existing node-level `insar_node_features` table
-- (0001), which remains a separate, unmerged, legacy/sparse evidence
-- source. See INSAR_INTEGRATION_DESIGN.md §12 for the documented
-- relationship between the two.
--
-- NOT YET APPLIED to the live project - same constraint as every migration
-- in this build (0003-0006): no direct DDL access from this environment.
-- Apply via the Supabase SQL editor or `supabase db push`, then confirm
-- before the importer (tools/insar-importer/) is run against it.
--
-- Source: AI-Smart-Mine-Subsidence-InSAR/data/handoff/ (verified via the
-- InSAR Source Repository Audit - independently confirmed against the real
-- CSV/GPKG, not assumed from documentation alone):
--   insar_spatiotemporal.csv                9,546 rows, 1,591 unique grid_id, 6 pairs
--   shyamsundarpur_insar_spatiotemporal.gpkg  same grid_id/row shape + POLYGON geometry, EPSG:32645
-- 80m grid. 39 of the 9,546 rows have a genuinely missing los_displacement_m
-- (must be stored NULL, never coerced to 0 - enforced at the importer layer,
-- not by a DB constraint, since NULL is itself the correct, valid state).

-- ============================================================
-- insar_grid_cells: static geometry, one row per grid_id, ever.
-- Normalized out of the observations table (Revision 2 correction) because
-- the same 1,591 polygons are shared across all 6 temporal pairs - a cell's
-- shape is a fact about the cell, not about any one pair's measurement.
-- ============================================================
create table if not exists insar_grid_cells (
  id                 bigint generated always as identity primary key,
  site_id            text not null references sites(site_id),
  grid_id            int  not null,

  -- GeoJSON Polygon, EPSG:4326. Reprojected once at import time from the
  -- source GPKG's native EPSG:32645 - PostGIS availability was not
  -- confirmed for this project (no existing migration/table uses a
  -- `geometry` column anywhere; every existing spatial value is a plain
  -- double precision lat/lon pair), so this defaults to the documented
  -- safe path (INSAR_INTEGRATION_DESIGN.md §4) rather than assuming an
  -- extension is enabled. The source EPSG:32645 geometry itself is never
  -- stored here and never mutated at its origin.
  geometry_4326      jsonb not null,

  source_repository  text not null default 'AI-Smart-Mine-Subsidence-InSAR',
  source_dataset     text not null default 'shyamsundarpur_insar_spatiotemporal.gpkg',
  imported_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),

  unique (site_id, grid_id)
);

comment on column insar_grid_cells.geometry_4326 is
  'GeoJSON Polygon, EPSG:4326, reprojected once at import time from the source GPKG (EPSG:32645). Grid cells are 80m x 80m production InSAR sampling cells - NOT physical sensor nodes and NOT GNSS-surveyed positions. Never mutate the source geometry to produce this value.';

-- ============================================================
-- insar_grid_observations: one row per grid_id per temporal pair.
-- ============================================================
create table if not exists insar_grid_observations (
  id                      bigint generated always as identity primary key,
  site_id                 text not null,
  grid_id                 int  not null,
  pair                    int  not null,

  reference_date          date not null,
  secondary_date          date not null,
  temporal_baseline_days  int  not null,

  -- Scientific measurement columns - double precision, not real, to
  -- preserve source precision (source values are 64-bit floats; real is
  -- ~7 significant digits and would silently truncate every one of them).
  --
  -- los_displacement_m: PAIR-WISE LOS displacement between reference_date
  -- and secondary_date, in metres. This is NOT vertical subsidence
  -- (line-of-sight only) and NOT a validated velocity (a single pair
  -- measures displacement between two dates, nothing longer-term).
  -- Nullable - 39 of the 9,546 source rows have no value; NULL must stay
  -- NULL forever downstream (API, UI) and must never be coerced to 0,
  -- "stable", or "safe".
  los_displacement_m      double precision,

  -- InSAR coherence, 0-1. Low coherence means insufficient/unreliable
  -- confirmation for that cell/pair - never zero deformation, never a
  -- "normal"/green state.
  coherence               double precision not null check (coherence >= 0 and coherence <= 1),

  incidence_angle_rad     double precision,
  look_vector_phi_rad     double precision,
  look_vector_theta_rad   double precision,

  source_repository       text not null default 'AI-Smart-Mine-Subsidence-InSAR',
  source_dataset          text not null default 'insar_spatiotemporal.csv',
  imported_at             timestamptz not null default now(),
  created_at              timestamptz not null default now(),

  unique (site_id, grid_id, pair),
  foreign key (site_id, grid_id) references insar_grid_cells (site_id, grid_id)
);

comment on column insar_grid_observations.los_displacement_m is
  'Pair-wise LOS displacement (metres) between reference_date and secondary_date. NOT vertical subsidence. NOT a validated multi-date velocity - no insar_los_velocity_mm_per_year field exists anywhere in this schema, deliberately, because the source handoff does not contain one (status: PENDING_VALIDATION per insar_handoff_schema.json). 39 of the current 9,546 source rows are NULL - preserve as NULL, never 0.';
comment on column insar_grid_observations.coherence is
  'InSAR coherence, 0-1, per cell per pair. Distinct from the source handoffs separate pair-level coherence_ge_0_5_percent temporal QC classification (which is not imported into this table - see INSAR_INTEGRATION_DESIGN.md §18). A per-row GOOD/LOW label derived from this column alone is called cell_coherence_quality at the application layer, precisely to avoid confusing the two.';
comment on table insar_grid_observations is
  'Dense, grid-level (80m cell), pair-relative InSAR evidence. Distinct from and never merged with insar_node_features (0001), the sparse node-scoped legacy table. No code path from this table into alert-engine.ts, notification-engine.ts, or siteRiskState() - InSAR here is supplementary observational evidence only.';

create index if not exists insar_grid_observations_site_pair_idx
  on insar_grid_observations (site_id, pair);
create index if not exists insar_grid_observations_grid_id_idx
  on insar_grid_observations (grid_id);
create index if not exists insar_grid_observations_has_displacement_idx
  on insar_grid_observations (site_id, pair) where los_displacement_m is not null;

-- ============================================================
-- RLS: same posture as every other operational table in this schema
-- (0002's pattern) - authenticated read, no anon policy at all (the
-- gateway/ingest path has no reason to ever write InSAR data; only the
-- offline Python importer, using the service-role key, writes here), no
-- PII so no admin-only gate needed.
-- ============================================================

alter table insar_grid_cells enable row level security;
create policy authenticated_select_insar_grid_cells on insar_grid_cells
  for select to authenticated using (true);

alter table insar_grid_observations enable row level security;
create policy authenticated_select_insar_grid_observations on insar_grid_observations
  for select to authenticated using (true);

-- service_role (used by /api/insar/grid* and by the importer) bypasses RLS
-- entirely by default in Supabase; no explicit write policy needed, same
-- as every other table in this schema.
