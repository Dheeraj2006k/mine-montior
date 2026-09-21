# InSAR grid importer

Standalone, offline Python tool that imports the production InSAR grid
handoff (grid cell geometry + per-pair observations) into the IRIS
Supabase database. Not part of the Next.js app's request path - this is a
one-shot (per-site, per-handoff) operator-run script, not a service.

## What it imports

Two tables (`supabase/migrations/0007_insar_grid_cells_and_observations.sql`):

- `insar_grid_cells` - one row per 80m x 80m grid cell, static geometry
  (GeoJSON, reprojected once from the source GPKG's EPSG:32645 to
  EPSG:4326).
- `insar_grid_observations` - one row per grid cell per temporal pair:
  LOS displacement (metres, nullable), coherence (0-1), incidence/look
  angles.

See `docs/SCIENTIFIC_NOTES.md` in the app repo root for what these values
do and do not mean (LOS is not vertical subsidence; a pair is not an
annual velocity; NULL is a genuinely missing measurement, never 0).

## Input files

- `insar_spatiotemporal.csv` - the observation table (dates, displacement,
  coherence, look-vector angles) for every grid_id x pair.
- `shyamsundarpur_insar_spatiotemporal.gpkg` - the same grid_id's polygon
  geometry, source CRS EPSG:32645.

Both come from the InSAR team's `data/handoff/` directory in the sibling
`AI-Smart-Mine-Subsidence-InSAR` repository. See
`docs/DATA_PROVENANCE.md` for why these files are not copied into this
repository directly.

## Validation and safety guarantees

Import runs in two hard phases:

1. **Phase A - validation only.** Reads and validates every row of both
   input files: header shape, geometry decodability (manual GPKG-header +
   WKB parse, no GDAL dependency), CRS reprojection, numeric finiteness
   (rejects NaN/Infinity on all 5 scientific fields), cross-file
   consistency (grid_id/row-count agreement between CSV and GPKG), and
   that `--site-id` exists in the live `sites` table. Zero database writes
   happen in this phase, and every error found is accumulated and
   reported - the run does not stop at the first bad row.
2. **Phase B - atomic write.** Only reached if Phase A found **zero**
   errors. Writes both tables together in one Postgres transaction via the
   `import_insar_grid_batch` RPC (`supabase/migrations/0008_insar_grid_import_transaction.sql`):
   either the entire import commits, or it entirely rolls back. There is
   no partial-import state.

`--dry-run` always stops after Phase A's report, regardless of outcome,
and never calls Phase B.

`--site-id` is **required**, with no default and no inference from a
filename or region name - it is checked against the live `sites` table
before anything else runs.

## Usage

```bash
cd tools/insar-importer
python -m venv .venv
.venv/Scripts/activate   # or: source .venv/bin/activate
pip install -r requirements.txt

# Validate only - zero writes, safe to run repeatedly.
python import_insar_grid.py \
  --site-id=<REAL_SITE_ID> \
  --csv="/path/to/insar_spatiotemporal.csv" \
  --gpkg="/path/to/shyamsundarpur_insar_spatiotemporal.gpkg" \
  --dry-run

# Real import - only after reviewing the dry-run report.
python import_insar_grid.py \
  --site-id=<REAL_SITE_ID> \
  --csv="/path/to/insar_spatiotemporal.csv" \
  --gpkg="/path/to/shyamsundarpur_insar_spatiotemporal.gpkg"
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the
environment, or in `mine-monitor/.env.local` (read automatically via a
minimal loader in `supabase_client.py` - no extra dependency for this).

## Verification

`verify_import.py` performs a read-only post-import check: row counts,
distinct grid/pair counts, duplicate detection, orphan detection
(observations without a matching cell), geometry validity, and spot-checks
individual field values against the source CSV. Run it after any import:

```bash
python verify_import.py --site-id=<REAL_SITE_ID>
```

## Tests

```bash
pytest
```

34 tests covering CSV/GPKG parsing, geometry decode/reprojection, Phase A
happy-path and every rejection path (bad site, missing files, malformed
row, duplicate key, row-count mismatch, grid_id mismatch, NaN/Infinity in
each of the 5 scientific fields), and Phase B gating (the real Supabase
write path is never called on validation failure or `--dry-run`, and is
called exactly once with the correct payload on success - proven with a
network-free fake client, not the real database).

## Dependencies

`pyproj` and `shapely` for real CRS transform (EPSG:32645 -> EPSG:4326)
and geometry validity - `requests` for the Supabase REST calls - `pytest`
for tests. Deliberately **not** `geopandas`/`fiona`/GDAL: the GPKG is read
directly via Python's stdlib `sqlite3` + `struct` (a GeoPackage is just
SQLite with a documented binary geometry header), which keeps the
dependency footprint small for a one-shot import script.

## What's excluded from version control

`.venv/`, `__pycache__/`, `*.pyc`, `.pytest_cache/` (see this directory's
own `.gitignore`). No secrets, no local absolute paths, no generated
output live in this directory.
