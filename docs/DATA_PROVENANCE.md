# Data provenance

## Source repositories

Two sibling research repositories exist alongside this application
repository on disk (not nested inside it, never copied into it):

- `AI-Smart-Mine-Subsidence-InSAR` - the completed, verified InSAR
  processing pipeline. Its `data/handoff/` directory is the authoritative
  production dataset this application imports.
- `insar-project` - a separate, in-progress InSAR grid-generation effort.
  Not the source of the data imported into this application; inspected
  only to resolve a `grid_id` vs `cell_id` naming question during design
  (resolved in favor of `grid_id`, matching the authoritative handoff).

Neither repository was copied into this repository. No `.git` history,
no source code, no raw data from either repository is nested inside
`mine-monitor/`.

## Production handoff

The authoritative dataset is `AI-Smart-Mine-Subsidence-InSAR/data/handoff/`:

| File | Role |
|---|---|
| `insar_spatiotemporal.csv` | Per-cell, per-pair observations (dates, LOS displacement, coherence, look-vector angles) |
| `shyamsundarpur_insar_spatiotemporal.gpkg` | Per-cell polygon geometry, EPSG:32645 |
| `pair_metadata.json` | Acquisition pair reference/secondary dates |
| `insar_handoff_schema.json` | Source team's own schema documentation |
| `TEAM_INTEGRATION_GUIDE.md` | Source team's integration notes |

## Verification methodology

Before any import, the production files were inspected read-only (no
writes to the source repository) to independently confirm:

- 9,546 observation rows, 1,591 unique `grid_id` values, 6 distinct pairs
- 80m x 80m grid, source CRS EPSG:32645
- 39 rows with a genuinely missing `los_displacement_m` (not a formatting
  artifact - confirmed by reading the raw CSV values)
- No validated annual velocity column or product anywhere in the handoff
  (`insar_handoff_schema.json` status: `PENDING_VALIDATION` for any such
  product)

After import, `tools/insar-importer/verify_import.py` independently
re-confirmed these same facts against the **live Supabase database**
(not the source files) via read-only queries: row counts, distinct
grid/pair counts, duplicate detection, orphan detection (observations
without a matching cell), geometry validity, and spot-checked individual
field values (grid_id 0/17/41, several pairs) against the source CSV with
a floating-point tolerance check.

## Redistribution / license status

**Unclear - the production handoff data is NOT included in this
repository.**

Both source repositories were inspected for a LICENSE file and for any
license/permission/redistribution/copyright language in their README or
handoff documentation. Neither was found. Because "the data is readable
in a repository I have access to" is not the same as "redistribution to
a third party (e.g. a public GitHub repository or a hackathon judge) is
permitted," this application repository ships:

- the import pipeline and its tests (`tools/insar-importer/`)
- the database migrations that define the target schema
  (`supabase/migrations/0007_*.sql`, `0008_*.sql`)
- full documentation of the dataset's shape, statistics, and scientific
  meaning (`data/insar/README.md`, `docs/SCIENTIFIC_NOTES.md`)

but **not** the actual data files (`insar_spatiotemporal.csv`,
`shyamsundarpur_insar_spatiotemporal.gpkg`, `pair_metadata.json`,
`insar_handoff_schema.json`, `TEAM_INTEGRATION_GUIDE.md`).

**Action required before publishing:** the repository owner must confirm
with the `AI-Smart-Mine-Subsidence-InSAR` team/owner whether
redistribution of these specific files is permitted, and under what
license, before adding them to this repository or any public mirror of
it. Until that is confirmed, `data/insar/.gitignore` prevents them from
being accidentally staged even if placed locally for testing.

## Database import process

See `tools/insar-importer/README.md` for the full two-phase
(validate-then-atomically-write) import process, and
`docs/SCIENTIFIC_NOTES.md` for what the imported values do and do not
mean. The live database currently holds the real, previously-imported,
independently-verified dataset described above - importing again against
the same `site_id`/`grid_id`/`pair` keys is idempotent (upsert on
conflict), not a duplicate-inserting operation.
