# InSAR production data

## Status: data files intentionally NOT included in this repository

This directory documents the InSAR dataset IRIS imports and is meant to
hold the production handoff files listed below - but **the actual data
files (`insar_spatiotemporal.csv`, `shyamsundarpur_insar_spatiotemporal.gpkg`,
`pair_metadata.json`, `insar_handoff_schema.json`, `TEAM_INTEGRATION_GUIDE.md`)
are deliberately not copied into this repository.**

Reason: neither source repository
(`AI-Smart-Mine-Subsidence-InSAR` nor `insar-project`) contains a LICENSE
file, and neither repository's README or handoff documentation states a
redistribution/license policy for this data. "The data exists in a
repository I can read" is not the same as "redistribution is permitted."
Rather than assume permission, this repository ships the **import
pipeline and its documentation only**, and expects the repository owner
to place the real files locally (never committed) before running an
import - see [Local setup](#local-setup-before-importing) below.

**The repository owner must confirm actual redistribution/license
permission with whoever owns `AI-Smart-Mine-Subsidence-InSAR` before
adding these files to git history or a public repository.**

## What this dataset is

Grid-level Interferometric Synthetic Aperture Radar (InSAR) evidence for
the Shyamsundarpur site, produced by the sibling `AI-Smart-Mine-Subsidence-InSAR`
team and independently verified (row counts, geometry, and sample field
values cross-checked against the live database) before import.

- **Source repository:** `AI-Smart-Mine-Subsidence-InSAR`
- **Source dataset location:** `data/handoff/` in that repository
- **Grid size:** 80m x 80m per cell
- **Source CRS:** EPSG:32645 (UTM zone 45N)
- **Stored database geometry:** WGS84 GeoJSON (`geometry_4326`), reprojected
  once at import time - the source EPSG:32645 geometry itself is never
  stored in IRIS and never mutated
- **Grid cells:** 1,591 (unique `grid_id`, static across all pairs)
- **Observations:** 9,546 (one row per grid cell per temporal pair)
- **Acquisition pairs:** 6
- **NULL LOS observations:** 39 of 9,546 - a genuinely missing source
  measurement, not a zero
- **LOS displacement:** stored in **metres** (`los_displacement_m`,
  `double precision`, nullable)
- **Coherence:** 0-1 (`double precision`, not null)

All of the above counts were independently verified against the live
Supabase database after import (see `tools/insar-importer/verify_import.py`
and the phase reports in this project's history) - they are not taken on
faith from the source handoff's own documentation.

## What this dataset is NOT

- **Not vertical subsidence.** `los_displacement_m` is line-of-sight
  displacement between two satellite passes - never automatically
  converted to or labeled as vertical ground movement anywhere in this
  application.
- **Not an annual velocity.** A single acquisition pair measures
  displacement between exactly two dates. There is no
  `insar_los_velocity_mm_per_year` field anywhere in this schema,
  deliberately, because no validated multi-date velocity product exists
  in the source handoff.
- **NULL does not mean zero, stable, or safe.** A NULL `los_displacement_m`
  means no measurement was available for that cell/pair - it is rendered
  as "No LOS measurement" or "-" everywhere in the UI, never as 0.
- **Low coherence does not mean zero deformation.** Coherence below 0.5
  (`cell_coherence_quality = "LOW"`) means reduced measurement
  reliability for that cell/pair - it is shown de-emphasized, never as a
  green/safe/stable state.

See `docs/SCIENTIFIC_NOTES.md` for the full terminology rules this
application follows.

## Import workflow

1. Obtain the production handoff files (see below) with confirmed
   redistribution permission, and place them anywhere locally.
2. Run `tools/insar-importer/import_insar_grid.py --dry-run` first -
   validates the complete dataset with zero database writes.
3. Review the Phase A report.
4. Run the same command without `--dry-run` to perform the real,
   single-transaction import.
5. Run `tools/insar-importer/verify_import.py` to independently confirm
   row counts, duplicates, orphans, and sample values against the live
   database.

Full details: `tools/insar-importer/README.md`.

## Local setup before importing

Place the following files anywhere on disk (this directory is a
reasonable default, and is `.gitignore`d for exactly this purpose - see
below) and pass their paths to the importer via `--csv`/`--gpkg`:

- `insar_spatiotemporal.csv`
- `shyamsundarpur_insar_spatiotemporal.gpkg`
- `pair_metadata.json` (reference)
- `insar_handoff_schema.json` (reference)
- `TEAM_INTEGRATION_GUIDE.md` (reference)

These come from `AI-Smart-Mine-Subsidence-InSAR/data/handoff/` in the
sibling research repository. This directory's `.gitignore` excludes
anything placed here except this README, so accidentally running `git
add .` here will not stage the real data files.

## Provenance

See `docs/DATA_PROVENANCE.md` for the full chain: source repositories,
verification methodology, and the redistribution-status decision recorded
above.
