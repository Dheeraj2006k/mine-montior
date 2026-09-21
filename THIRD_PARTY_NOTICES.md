# Third-party notices

This file exists because the project bundles third-party open-source
dependencies and (optionally, if the redistribution question is
resolved) a third-party dataset. It does not declare a license for this
project's own source code — see `README.md` §18.

## Direct npm dependencies

License values below were read directly from each package's own
`package.json` (`license` field) as installed in this repository's
`node_modules`, not guessed. Run `npm ls` and inspect
`node_modules/<package>/LICENSE` for the authoritative, full-text terms.

| Package | License |
|---|---|
| @react-three/drei | MIT |
| @react-three/fiber | MIT |
| @supabase/ssr | MIT |
| @supabase/supabase-js | MIT |
| @tanstack/react-query | MIT |
| maplibre-gl | BSD-3-Clause |
| next | MIT |
| react / react-dom | MIT |
| recharts | MIT |
| resend | MIT |
| three | MIT |
| twilio | MIT |
| zod | MIT |

Dev-only dependencies (`eslint`, `tailwindcss`, `typescript`, `vitest`,
and their respective plugin packages) are also standard MIT/permissively
licensed OSS tooling and are not redistributed as part of any built
artifact.

## Python importer dependencies (`tools/insar-importer/`)

`pyproj`, `shapely`, `requests`, `pytest` — all permissively licensed
(MIT/BSD-family), used only by the offline import tool, never bundled
into the web application.

## Map tiles

The MapLibre basemap uses OpenStreetMap raster tiles
(`https://tile.openstreetmap.org/...`), attributed in-app as
"(c) OpenStreetMap contributors" per the OSM tile usage policy.

## InSAR dataset

The production InSAR dataset (grid geometry + observations) originates
from the sibling `AI-Smart-Mine-Subsidence-InSAR` repository. **Its
redistribution/license status is unconfirmed** — see
`docs/DATA_PROVENANCE.md` for the full explanation. The raw data files
are not included in this repository; only the import pipeline, schema,
and documentation of the dataset's shape are. Do not treat the presence
of this repository's importer/schema as implying redistribution rights
over the underlying data itself.

## What this file does not do

It does not declare a license for IRIS's own source code (see
`README.md` §18: "Application license not yet declared") and it does not
assert any license terms not read directly from the dependency's own
declared metadata.
