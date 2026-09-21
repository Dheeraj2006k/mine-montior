"""Phase A validation - the entire dataset, zero writes.

INSAR_INTEGRATION_DESIGN.md Revision 3: every check below runs against the
complete file (not a sample), every problem found is accumulated into one
report rather than raising on the first one, and Phase B (see
import_insar_grid.py) is only ever reachable when this report's
`is_valid` is True.

Row-count/cell-count expectations are NOT hardcoded as pass/fail limits
here - this file only checks CSV-vs-GPKG *agreement* (equal counts, equal
grid_id sets), never a fixed constant, so a future larger handoff (e.g. a
7th pair) does not require a code change here.
"""

import math
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Callable, Optional

import read_csv
import read_gpkg
import transform


@dataclass
class RowError:
    context: str
    message: str


@dataclass
class ValidatedCell:
    grid_id: int
    geometry_4326: dict


@dataclass
class ValidatedObservation:
    grid_id: int
    pair: int
    reference_date: str
    secondary_date: str
    temporal_baseline_days: int
    los_displacement_m: Optional[float]
    coherence: float
    incidence_angle_rad: Optional[float]
    look_vector_phi_rad: Optional[float]
    look_vector_theta_rad: Optional[float]


@dataclass
class ValidationReport:
    errors: list[RowError] = field(default_factory=list)

    site_id: str = ""
    site_exists: bool = False

    csv_row_count: int = 0
    gpkg_row_count: int = 0
    cell_count: int = 0
    observation_count: int = 0
    pairs: set = field(default_factory=set)
    null_los_count: int = 0
    coherence_min: Optional[float] = None
    coherence_max: Optional[float] = None
    date_min: Optional[str] = None
    date_max: Optional[str] = None

    gpkg_geometry_type: str = ""
    gpkg_srs_id: Optional[int] = None

    validated_cells: list[ValidatedCell] = field(default_factory=list)
    validated_observations: list[ValidatedObservation] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def run_phase_a(
    site_id: str,
    csv_path: str,
    gpkg_path: str,
    site_checker: Callable[[str], bool],
) -> ValidationReport:
    report = ValidationReport(site_id=site_id)

    # --- site_id -----------------------------------------------------
    try:
        report.site_exists = site_checker(site_id)
        if not report.site_exists:
            report.errors.append(
                RowError("site_id", f"site_id '{site_id}' does not exist in the sites table")
            )
    except Exception as e:  # network/config failure - a real error, not a guess
        report.errors.append(RowError("site_id", f"could not verify site_id: {e}"))

    # --- file existence ------------------------------------------------
    if not os.path.isfile(csv_path):
        report.errors.append(RowError("csv", f"file not found: {csv_path}"))
        return report  # nothing else can be checked without the file
    if not os.path.isfile(gpkg_path):
        report.errors.append(RowError("gpkg", f"file not found: {gpkg_path}"))
        return report

    # --- CSV header ------------------------------------------------
    header = read_csv.read_header(csv_path)
    if header != read_csv.EXPECTED_HEADER:
        report.errors.append(
            RowError(
                "csv header",
                f"expected {read_csv.EXPECTED_HEADER}, got {header}",
            )
        )
        return report  # can't safely interpret rows against an unexpected header

    raw_rows = read_csv.read_raw_rows(csv_path)
    report.csv_row_count = len(raw_rows)

    # --- GPKG schema ------------------------------------------------
    try:
        schema = read_gpkg.read_schema(gpkg_path)
    except Exception as e:
        report.errors.append(RowError("gpkg schema", str(e)))
        return report

    report.gpkg_geometry_type = schema.geometry_type
    report.gpkg_srs_id = schema.srs_id

    if schema.geometry_type != read_gpkg.EXPECTED_GEOMETRY_TYPE:
        report.errors.append(
            RowError(
                "gpkg schema",
                f"expected geometry type {read_gpkg.EXPECTED_GEOMETRY_TYPE}, got {schema.geometry_type}",
            )
        )
    if schema.srs_id != read_gpkg.EXPECTED_SRS_ID:
        report.errors.append(
            RowError(
                "gpkg schema",
                f"expected srs_id {read_gpkg.EXPECTED_SRS_ID} (EPSG:32645), got {schema.srs_id}",
            )
        )

    gpkg_raw_rows = read_gpkg.read_raw_rows(gpkg_path, schema)
    report.gpkg_row_count = len(gpkg_raw_rows)

    # --- row-count agreement (not a hardcoded constant) -----------------
    if report.csv_row_count != report.gpkg_row_count:
        report.errors.append(
            RowError(
                "row counts",
                f"CSV has {report.csv_row_count} rows, GPKG has {report.gpkg_row_count} rows - must match",
            )
        )

    # --- decode every GPKG geometry, first-seen-per-grid_id -------------
    cells_by_grid_id: dict[int, list[tuple[float, float]]] = {}
    for raw in gpkg_raw_rows:
        try:
            srs_id, points = read_gpkg.decode_polygon(raw.geometry_blob)
        except Exception as e:
            report.errors.append(
                RowError(f"gpkg row {raw.row_index} (grid_id={raw.grid_id})", f"geometry decode failed: {e}")
            )
            continue
        if srs_id != read_gpkg.EXPECTED_SRS_ID:
            report.errors.append(
                RowError(
                    f"gpkg row {raw.row_index} (grid_id={raw.grid_id})",
                    f"geometry srs_id {srs_id} != expected {read_gpkg.EXPECTED_SRS_ID}",
                )
            )
            continue
        if raw.grid_id not in cells_by_grid_id:
            cells_by_grid_id[raw.grid_id] = points

    gpkg_grid_ids = set(cells_by_grid_id.keys())

    # --- validate + parse every CSV row (accumulate, never stop early) --
    csv_grid_ids: set[int] = set()
    seen_keys: set[tuple[int, int]] = set()
    coherences: list[float] = []
    all_dates: list[str] = []

    for raw in raw_rows:
        ctx = f"csv line {raw.line_number} (grid_id={raw.grid_id}, pair={raw.pair})"
        row_ok = True

        try:
            grid_id = int(raw.grid_id)
        except ValueError:
            report.errors.append(RowError(ctx, f"grid_id is not an integer: '{raw.grid_id}'"))
            row_ok = False
            grid_id = None

        try:
            pair = int(raw.pair)
            if pair <= 0:
                report.errors.append(RowError(ctx, f"pair must be a positive integer, got {pair}"))
                row_ok = False
        except ValueError:
            report.errors.append(RowError(ctx, f"pair is not an integer: '{raw.pair}'"))
            row_ok = False
            pair = None

        ref_date, sec_date = _parse_date_pair(raw.reference_date, raw.secondary_date, ctx, report)
        if ref_date is None or sec_date is None:
            row_ok = False
        elif ref_date >= sec_date:
            report.errors.append(
                RowError(ctx, f"reference_date ({ref_date}) must be before secondary_date ({sec_date})")
            )
            row_ok = False

        try:
            baseline = int(raw.temporal_baseline_days)
            if baseline <= 0:
                report.errors.append(RowError(ctx, f"temporal_baseline_days must be > 0, got {baseline}"))
                row_ok = False
        except ValueError:
            report.errors.append(RowError(ctx, f"temporal_baseline_days is not an integer: '{raw.temporal_baseline_days}'"))
            row_ok = False
            baseline = None

        # los_displacement_m: NULL is legitimate (39 real source rows are
        # empty) and preserved as None here - never coerced toward 0. NaN
        # and +/-Infinity are NOT legitimate for any of these five fields
        # (STEP 4A hardening) and are rejected the same way a non-numeric
        # string would be.
        los, los_ok = _parse_finite_float(raw.los_displacement_m, "los_displacement_m", ctx, report, allow_none=True)
        if not los_ok:
            row_ok = False

        coherence, coherence_ok = _parse_finite_float(raw.coherence, "coherence", ctx, report, allow_none=False)
        if coherence_ok and not (0.0 <= coherence <= 1.0):
            report.errors.append(RowError(ctx, f"coherence out of range [0,1]: {coherence}"))
            coherence_ok = False
        if not coherence_ok:
            row_ok = False

        incidence, incidence_ok = _parse_finite_float(raw.incidence_angle_rad, "incidence_angle_rad", ctx, report, allow_none=True)
        phi, phi_ok = _parse_finite_float(raw.look_vector_phi_rad, "look_vector_phi_rad", ctx, report, allow_none=True)
        theta, theta_ok = _parse_finite_float(raw.look_vector_theta_rad, "look_vector_theta_rad", ctx, report, allow_none=True)
        if not (incidence_ok and phi_ok and theta_ok):
            row_ok = False

        if grid_id is not None and pair is not None:
            key = (grid_id, pair)
            if key in seen_keys:
                report.errors.append(RowError(ctx, f"duplicate (grid_id, pair) key {key} within the CSV"))
                row_ok = False
            seen_keys.add(key)
            csv_grid_ids.add(grid_id)

        if row_ok:
            report.validated_observations.append(
                ValidatedObservation(
                    grid_id=grid_id,
                    pair=pair,
                    reference_date=str(ref_date),
                    secondary_date=str(sec_date),
                    temporal_baseline_days=baseline,
                    los_displacement_m=los,
                    coherence=coherence,
                    incidence_angle_rad=incidence,
                    look_vector_phi_rad=phi,
                    look_vector_theta_rad=theta,
                )
            )
            if los is None:
                report.null_los_count += 1
            coherences.append(coherence)
            all_dates.append(str(ref_date))
            all_dates.append(str(sec_date))
            report.pairs.add(pair)

    # --- grid_id set equality between CSV and GPKG -----------------
    only_in_csv = csv_grid_ids - gpkg_grid_ids
    only_in_gpkg = gpkg_grid_ids - csv_grid_ids
    if only_in_csv:
        report.errors.append(
            RowError("grid_id consistency", f"{len(only_in_csv)} grid_id(s) in CSV but not in GPKG, e.g. {sorted(only_in_csv)[:10]}")
        )
    if only_in_gpkg:
        report.errors.append(
            RowError("grid_id consistency", f"{len(only_in_gpkg)} grid_id(s) in GPKG but not in CSV, e.g. {sorted(only_in_gpkg)[:10]}")
        )

    # --- transform every cell geometry EPSG:32645 -> EPSG:4326 -----------
    for grid_id, points in cells_by_grid_id.items():
        try:
            geojson = transform.transform_polygon_to_4326_geojson(points)
        except Exception as e:
            report.errors.append(RowError(f"gpkg grid_id={grid_id}", f"CRS transform failed: {e}"))
            continue
        report.validated_cells.append(ValidatedCell(grid_id=grid_id, geometry_4326=geojson))

    # --- summary stats (only meaningful if nothing above failed catastrophically) --
    report.cell_count = len(report.validated_cells)
    report.observation_count = len(report.validated_observations)
    if coherences:
        report.coherence_min = min(coherences)
        report.coherence_max = max(coherences)
    if all_dates:
        report.date_min = min(all_dates)
        report.date_max = max(all_dates)

    return report


def _parse_date_pair(ref_raw: str, sec_raw: str, ctx: str, report: ValidationReport):
    ref_date = _parse_date(ref_raw, "reference_date", ctx, report)
    sec_date = _parse_date(sec_raw, "secondary_date", ctx, report)
    return ref_date, sec_date


def _parse_date(raw: str, field_name: str, ctx: str, report: ValidationReport) -> Optional[date]:
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        report.errors.append(RowError(ctx, f"{field_name} is not a valid YYYY-MM-DD date: '{raw}'"))
        return None


def _parse_finite_float(
    raw: str, field_name: str, ctx: str, report: ValidationReport, allow_none: bool
) -> tuple[Optional[float], bool]:
    """Returns (value, ok). ok=False means a RowError was appended and the
    whole row must be excluded from validated_observations (STEP 4A: one
    bad field still invalidates the row, and one bad row still invalidates
    the whole import - no partial acceptance).

    NaN and +/-Infinity are rejected unconditionally, for every one of the
    five scientific float fields, regardless of whether the field itself
    permits NULL - `float()` happily parses the strings "nan"/"inf" and
    Python's own float type allows them, so this check has to be explicit;
    nothing about them is ever a legitimate InSAR measurement."""
    if raw.strip() == "":
        if allow_none:
            return None, True
        report.errors.append(RowError(ctx, f"{field_name} is required and cannot be empty"))
        return None, False
    try:
        value = float(raw)
    except ValueError:
        report.errors.append(RowError(ctx, f"{field_name} is not numeric: '{raw}'"))
        return None, False
    if not math.isfinite(value):
        report.errors.append(RowError(ctx, f"{field_name} must be a finite number, got {value!r} (NaN/Infinity are never valid)"))
        return None, False
    return value, True
