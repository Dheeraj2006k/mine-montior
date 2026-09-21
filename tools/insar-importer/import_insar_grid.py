#!/usr/bin/env python
"""Controlled importer for the production InSAR grid handoff.

Implements INSAR_INTEGRATION_DESIGN.md (Revision 3) plus the STEP 4A
safety hardening: two hard phases, and an atomic Phase B write. Phase A
validates the COMPLETE dataset (every row, every geometry, every numeric
value checked for finiteness) with zero writes. Phase B is only reachable
if Phase A found zero errors, and writes both tables in a single Postgres
transaction via RPC (import_insar_grid_batch, migration 0008) - either the
complete import commits, or the complete import rolls back. --dry-run
always stops after printing the Phase A report, regardless of outcome, and
never calls Phase B.

Usage:
    python import_insar_grid.py \\
        --site-id=<REAL_SITE_ID> \\
        --csv="...\\insar_spatiotemporal.csv" \\
        --gpkg="...\\shyamsundarpur_insar_spatiotemporal.gpkg" \\
        --dry-run
"""

import argparse
import sys

from supabase_client import SupabaseClient, SupabaseConfigError
from validate import run_phase_a


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import the production InSAR grid handoff into IRIS.")
    parser.add_argument(
        "--site-id",
        required=True,
        help="Real IRIS site_id to attach this import to. No default. Never inferred from the mine name, "
        "region, or source filenames - it is validated against the live `sites` table before anything else runs.",
    )
    parser.add_argument("--csv", required=True, help="Path to insar_spatiotemporal.csv")
    parser.add_argument("--gpkg", required=True, help="Path to shyamsundarpur_insar_spatiotemporal.gpkg")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run Phase A validation only. Zero writes are performed, regardless of validation outcome.",
    )
    return parser.parse_args(argv)


def print_report(report, args: argparse.Namespace) -> None:
    print("=" * 64)
    print("InSAR Grid Import - Phase A Validation Report")
    print("=" * 64)
    print(f"site_id:              {args.site_id}  (exists in sites table: {report.site_exists})")
    print(f"csv:                  {args.csv}")
    print(f"gpkg:                 {args.gpkg}")
    print(f"gpkg geometry_type:   {report.gpkg_geometry_type}")
    print(f"gpkg srs_id:          {report.gpkg_srs_id}")
    print(f"CSV rows detected:    {report.csv_row_count}")
    print(f"GPKG rows detected:   {report.gpkg_row_count}")
    print(f"Distinct cells:       {report.cell_count}")
    print(f"Observation rows:     {report.observation_count}")
    print(f"Pairs detected:       {sorted(report.pairs)}  ({len(report.pairs)} total)")
    print(f"NULL LOS count:       {report.null_los_count}")
    print(f"Coherence range:      {report.coherence_min} .. {report.coherence_max}")
    print(f"Date range:           {report.date_min} .. {report.date_max}")
    print(f"Validation errors:    {len(report.errors)}")
    if report.errors:
        print("-" * 64)
        for err in report.errors[:50]:
            print(f"  [{err.context}] {err.message}")
        if len(report.errors) > 50:
            print(f"  ... and {len(report.errors) - 50} more")
    print("=" * 64)


def build_payloads(report, site_id: str) -> tuple[list[dict], list[dict]]:
    cells_payload = [
        {"site_id": site_id, "grid_id": c.grid_id, "geometry_4326": c.geometry_4326}
        for c in report.validated_cells
    ]
    obs_payload = [
        {
            "site_id": site_id,
            "grid_id": o.grid_id,
            "pair": o.pair,
            "reference_date": o.reference_date,
            "secondary_date": o.secondary_date,
            "temporal_baseline_days": o.temporal_baseline_days,
            "los_displacement_m": o.los_displacement_m,
            "coherence": o.coherence,
            "incidence_angle_rad": o.incidence_angle_rad,
            "look_vector_phi_rad": o.look_vector_phi_rad,
            "look_vector_theta_rad": o.look_vector_theta_rad,
        }
        for o in report.validated_observations
    ]
    return cells_payload, obs_payload


def run(args: argparse.Namespace, client) -> int:
    """Separated from main() so tests can inject a fake client and a
    plain args namespace - no real network call and no real environment
    variables required to test the phase-gating logic itself (STEP 4A)."""
    report = run_phase_a(
        site_id=args.site_id,
        csv_path=args.csv,
        gpkg_path=args.gpkg,
        site_checker=client.site_exists,
    )

    print_report(report, args)

    if not report.is_valid:
        print(f"\nABORTED - {len(report.errors)} validation error(s) found. Zero writes performed.")
        return 1

    if args.dry_run:
        print("\nDRY RUN - validation passed. Zero writes performed (--dry-run).")
        print(f"Would upsert {report.cell_count} cells and {report.observation_count} observations.")
        return 0

    # ---- Phase B: only reachable when Phase A found zero errors, never
    # in --dry-run. Single transactional RPC call - both tables together. ----
    print("\nPhase A passed with zero errors. Starting Phase B (atomic write)...")

    cells_payload, obs_payload = build_payloads(report, args.site_id)

    try:
        result = client.import_batch_transactional(args.site_id, cells_payload, obs_payload)
    except Exception as e:
        print(f"\nPHASE B FAILURE (operational/connectivity/transaction rollback, not a data-quality issue): {e}")
        print("Either nothing was written, or the database rolled back everything from this call - not a partial import.")
        return 3

    print(f"\nPhase B complete (atomic). {result}")
    return 0


def main() -> int:
    args = parse_args()
    try:
        client = SupabaseClient()
    except SupabaseConfigError as e:
        print(f"CONFIG ERROR: {e}")
        return 2
    return run(args, client)


if __name__ == "__main__":
    sys.exit(main())
