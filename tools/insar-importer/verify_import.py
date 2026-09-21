#!/usr/bin/env python
"""Post-import verification against the live database, via the same
service-role REST client the importer itself uses (no raw SQL connection
available in this environment - PostgREST is the only access path, same
constraint as every other part of this project). Read-only: performs no
writes.
"""

import csv
import json
import sys
from collections import Counter

import requests

from supabase_client import SupabaseClient

SITE_ID = "SIH-DEMO-01"


def fetch_all(client: SupabaseClient, table: str, select: str, page_size: int = 1000):
    rows = []
    offset = 0
    while True:
        resp = requests.get(
            f"{client.url}/rest/v1/{table}",
            headers={**client._headers(), "Range-Unit": "items", "Range": f"{offset}-{offset + page_size - 1}"},
            params={"select": select, "site_id": f"eq.{SITE_ID}", "order": "id"},
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def main() -> int:
    client = SupabaseClient()

    print("Fetching insar_grid_cells ...")
    cells = fetch_all(client, "insar_grid_cells", "id,grid_id,geometry_4326")
    print(f"Fetching insar_grid_observations ...")
    observations = fetch_all(
        client,
        "insar_grid_observations",
        "id,grid_id,pair,reference_date,secondary_date,temporal_baseline_days,"
        "los_displacement_m,coherence,incidence_angle_rad,look_vector_phi_rad,look_vector_theta_rad",
    )

    print("\n" + "=" * 64)
    print("A/B. Row counts")
    print("=" * 64)
    print(f"insar_grid_cells count:         {len(cells)}  (expected 1591)")
    print(f"insar_grid_observations count:  {len(observations)}  (expected 9546)")

    print("\n" + "=" * 64)
    print("C/D. Distinct counts")
    print("=" * 64)
    distinct_grid_ids = {c["grid_id"] for c in cells}
    distinct_pairs = {o["pair"] for o in observations}
    print(f"distinct grid_id in cells:      {len(distinct_grid_ids)}  (expected 1591)")
    print(f"distinct pair in observations:  {sorted(distinct_pairs)}  (expected 6 pairs: 1-6)")

    print("\n" + "=" * 64)
    print("E. NULL LOS count")
    print("=" * 64)
    null_los = [o for o in observations if o["los_displacement_m"] is None]
    print(f"NULL los_displacement_m count:   {len(null_los)}  (expected 39)")

    print("\n" + "=" * 64)
    print("F. Duplicate cells (site_id, grid_id)")
    print("=" * 64)
    cell_key_counts = Counter(c["grid_id"] for c in cells)
    dup_cells = {k: v for k, v in cell_key_counts.items() if v > 1}
    print(f"duplicate grid_id in cells:      {len(dup_cells)} (expected 0)")
    if dup_cells:
        print(f"  {dup_cells}")

    print("\n" + "=" * 64)
    print("G. Duplicate observations (site_id, grid_id, pair)")
    print("=" * 64)
    obs_key_counts = Counter((o["grid_id"], o["pair"]) for o in observations)
    dup_obs = {k: v for k, v in obs_key_counts.items() if v > 1}
    print(f"duplicate (grid_id, pair):       {len(dup_obs)} (expected 0)")
    if dup_obs:
        print(f"  {dup_obs}")

    print("\n" + "=" * 64)
    print("H. Orphan observations (grid_id with no matching cell)")
    print("=" * 64)
    orphans = [o for o in observations if o["grid_id"] not in distinct_grid_ids]
    print(f"orphan observation rows:         {len(orphans)}  (expected 0)")

    print("\n" + "=" * 64)
    print("Geometry check")
    print("=" * 64)
    null_geom = [c for c in cells if c["geometry_4326"] is None]
    non_polygon = [c for c in cells if c["geometry_4326"] and c["geometry_4326"].get("type") != "Polygon"]
    print(f"cells with NULL geometry_4326:   {len(null_geom)}  (expected 0)")
    print(f"cells with non-Polygon geometry: {len(non_polygon)}  (expected 0)")
    sample_cell = next(c for c in cells if c["grid_id"] == 0)
    lon, lat = sample_cell["geometry_4326"]["coordinates"][0][0]
    print(f"grid_id=0 sample vertex (lon,lat): ({lon}, {lat})  (expect ~87.x, ~23.x)")
    in_range = 86.0 < lon < 88.0 and 23.0 < lat < 24.0
    print(f"grid_id=0 within expected WGS84 bounds: {in_range}")

    print("\n" + "=" * 64)
    print("Source-vs-database sample comparison")
    print("=" * 64)
    csv_path = "D:/sih 2026/project/Project/AI-Smart-Mine-Subsidence-InSAR/data/handoff/insar_spatiotemporal.csv"
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        source_rows = {
            (int(r["grid_id"]), int(r["pair"])): r
            for r in reader
            if (int(r["grid_id"]), int(r["pair"])) in {(0, 1), (17, 1), (41, 1)}
        }
    db_rows = {(o["grid_id"], o["pair"]): o for o in observations if (o["grid_id"], o["pair"]) in {(0, 1), (17, 1), (41, 1)}}

    all_match = True
    for key in [(0, 1), (17, 1), (41, 1)]:
        src = source_rows[key]
        db = db_rows[key]
        print(f"\n-- grid_id={key[0]} pair={key[1]} --")
        checks = [
            ("reference_date", src["reference_date"], db["reference_date"]),
            ("secondary_date", src["secondary_date"], db["secondary_date"]),
            ("temporal_baseline_days", int(src["temporal_baseline_days"]), db["temporal_baseline_days"]),
            (
                "los_displacement_m",
                (None if src["los_displacement_m"] == "" else float(src["los_displacement_m"])),
                db["los_displacement_m"],
            ),
            ("coherence", float(src["coherence"]), db["coherence"]),
            ("incidence_angle_rad", float(src["incidence_angle_rad"]), db["incidence_angle_rad"]),
            ("look_vector_phi_rad", float(src["look_vector_phi_rad"]), db["look_vector_phi_rad"]),
            ("look_vector_theta_rad", float(src["look_vector_theta_rad"]), db["look_vector_theta_rad"]),
        ]
        for field, src_val, db_val in checks:
            if src_val is None or db_val is None:
                ok = src_val is None and db_val is None
            elif isinstance(src_val, float):
                ok = abs(src_val - db_val) < 1e-9
            else:
                ok = src_val == db_val
            all_match = all_match and ok
            marker = "OK" if ok else "MISMATCH"
            print(f"  {field:24s} source={src_val!r:30} db={db_val!r:30} [{marker}]")

    print("\n" + "=" * 64)
    print(f"ALL SAMPLE VALUES MATCH: {all_match}")
    print("=" * 64)

    problems = (
        len(cells) != 1591
        or len(observations) != 9546
        or len(distinct_grid_ids) != 1591
        or distinct_pairs != {1, 2, 3, 4, 5, 6}
        or len(null_los) != 39
        or dup_cells
        or dup_obs
        or orphans
        or null_geom
        or non_polygon
        or not in_range
        or not all_match
    )
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
