"""Tests for the InSAR grid importer.

Fixtures (tests/fixtures/sample_rows.csv, tests/fixtures/sample.gpkg) are
REAL rows/geometry copied verbatim from the production handoff
(AI-Smart-Mine-Subsidence-InSAR/data/handoff/) for grid_id 0, 17, 41 across
all 6 pairs - chosen because grid_id=41/pair=1 has a genuine NULL
los_displacement_m, grid_id=17 has coherence >= 0.5 (GOOD), and grid_id=0
has coherence < 0.5 (LOW). Nothing here is invented.
"""

import csv
import os
import shutil
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import read_csv  # noqa: E402
import read_gpkg  # noqa: E402
import transform  # noqa: E402
from validate import run_phase_a  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
SAMPLE_CSV = os.path.join(FIXTURES, "sample_rows.csv")
SAMPLE_GPKG = os.path.join(FIXTURES, "sample.gpkg")


def always_true(_site_id: str) -> bool:
    return True


def always_false(_site_id: str) -> bool:
    return False


# ---------------------------------------------------------------- read_csv


def test_csv_header_matches_expected():
    assert read_csv.read_header(SAMPLE_CSV) == read_csv.EXPECTED_HEADER


def test_csv_reads_all_real_rows():
    rows = read_csv.read_raw_rows(SAMPLE_CSV)
    assert len(rows) == 18  # 3 real grid cells x 6 real pairs


def test_csv_preserves_empty_los_as_empty_string_not_zero():
    rows = read_csv.read_raw_rows(SAMPLE_CSV)
    null_row = next(r for r in rows if r.grid_id == "41" and r.pair == "1")
    assert null_row.los_displacement_m == ""


# ---------------------------------------------------------------- read_gpkg


def test_gpkg_schema_is_polygon_epsg32645():
    schema = read_gpkg.read_schema(SAMPLE_GPKG)
    assert schema.geometry_type == "POLYGON"
    assert schema.srs_id == 32645


def test_gpkg_row_count_matches_csv():
    schema = read_gpkg.read_schema(SAMPLE_GPKG)
    rows = read_gpkg.read_raw_rows(SAMPLE_GPKG, schema)
    assert len(rows) == 18


def test_decode_real_polygon_is_closed_ring_in_source_crs():
    schema = read_gpkg.read_schema(SAMPLE_GPKG)
    rows = read_gpkg.read_raw_rows(SAMPLE_GPKG, schema)
    srs_id, points = read_gpkg.decode_polygon(rows[0].geometry_blob)
    assert srs_id == 32645
    assert points[0] == points[-1]  # closed ring
    assert len(points) == 5  # a simple grid-cell square: 4 corners + repeat of first

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    # 80m grid cell - real production spacing, verified during the audit.
    assert round(max(xs) - min(xs), 2) == 80.0
    assert round(max(ys) - min(ys), 2) == 80.0


def test_decode_polygon_rejects_bad_magic():
    with pytest.raises(ValueError, match="magic"):
        read_gpkg.decode_polygon(b"NOTGPKG_GARBAGE_BYTES_00000000000")


# ---------------------------------------------------------------- transform


def test_transform_produces_valid_geojson_polygon_near_west_bengal():
    schema = read_gpkg.read_schema(SAMPLE_GPKG)
    rows = read_gpkg.read_raw_rows(SAMPLE_GPKG, schema)
    _srs_id, points = read_gpkg.decode_polygon(rows[0].geometry_blob)

    geojson = transform.transform_polygon_to_4326_geojson(points)
    assert geojson["type"] == "Polygon"
    lon, lat = geojson["coordinates"][0][0]
    # Shyamsundarpur / Raniganj Coalfield, West Bengal - sanity bounds, not
    # an exact assertion (the point is "this is really in India", not a
    # hand-computed oracle value).
    assert 86.0 < lon < 88.0
    assert 23.0 < lat < 24.0


# ---------------------------------------------------------------- validate (happy path)


def test_phase_a_passes_on_real_fixture_data():
    report = run_phase_a("test-site", SAMPLE_CSV, SAMPLE_GPKG, always_true)
    assert report.is_valid, report.errors
    assert report.cell_count == 3
    assert report.observation_count == 18
    assert report.pairs == {1, 2, 3, 4, 5, 6}
    assert report.null_los_count == 1
    assert 0.0 <= report.coherence_min <= report.coherence_max <= 1.0


def test_phase_a_preserves_the_one_real_null_as_none_not_zero():
    report = run_phase_a("test-site", SAMPLE_CSV, SAMPLE_GPKG, always_true)
    obs = next(o for o in report.validated_observations if o.grid_id == 41 and o.pair == 1)
    assert obs.los_displacement_m is None


def test_phase_a_cell_coherence_examples_present():
    report = run_phase_a("test-site", SAMPLE_CSV, SAMPLE_GPKG, always_true)
    good = next(o for o in report.validated_observations if o.grid_id == 17 and o.pair == 1)
    low = next(o for o in report.validated_observations if o.grid_id == 0 and o.pair == 1)
    assert good.coherence >= 0.5
    assert low.coherence < 0.5


def test_phase_a_cells_have_real_transformed_geometry():
    report = run_phase_a("test-site", SAMPLE_CSV, SAMPLE_GPKG, always_true)
    grid_ids = {c.grid_id for c in report.validated_cells}
    assert grid_ids == {0, 17, 41}
    for cell in report.validated_cells:
        assert cell.geometry_4326["type"] == "Polygon"


# ---------------------------------------------------------------- validate (rejection paths)


def test_phase_a_fails_when_site_does_not_exist():
    report = run_phase_a("nonexistent-site", SAMPLE_CSV, SAMPLE_GPKG, always_false)
    assert not report.is_valid
    assert any("site_id" in e.context for e in report.errors)
    # Site failure alone must not prevent the rest of Phase A from still
    # running and reporting - accumulate, don't stop at the first error.
    assert report.cell_count == 3


def test_phase_a_missing_files_reported_not_crashed():
    report = run_phase_a("test-site", "does-not-exist.csv", "does-not-exist.gpkg", always_true)
    assert not report.is_valid
    assert any("not found" in e.message for e in report.errors)


def test_phase_a_rejects_the_whole_import_on_one_malformed_row(tmp_path):
    # Revision 3 correction: a SINGLE bad row invalidates the entire
    # import - no skip-and-continue. Corrupt exactly one coherence value.
    bad_csv = tmp_path / "bad.csv"
    with open(SAMPLE_CSV, encoding="utf-8") as src, open(bad_csv, "w", encoding="utf-8", newline="") as dst:
        reader = csv.reader(src)
        writer = csv.writer(dst)
        rows = list(reader)
        rows[1][6] = "not-a-number"  # coherence column of the first data row
        writer.writerows(rows)

    report = run_phase_a("test-site", str(bad_csv), SAMPLE_GPKG, always_true)
    assert not report.is_valid
    assert any("coherence" in e.message for e in report.errors)


def test_phase_a_rejects_duplicate_grid_id_pair_key(tmp_path):
    dup_csv = tmp_path / "dup.csv"
    with open(SAMPLE_CSV, encoding="utf-8") as src, open(dup_csv, "w", encoding="utf-8", newline="") as dst:
        content = src.read()
        lines = content.splitlines(keepends=True)
        dst.writelines(lines + [lines[1]])  # duplicate the first data row verbatim

    report = run_phase_a("test-site", str(dup_csv), SAMPLE_GPKG, always_true)
    assert not report.is_valid
    assert any("duplicate" in e.message for e in report.errors)


def test_phase_a_rejects_row_count_mismatch(tmp_path):
    short_csv = tmp_path / "short.csv"
    with open(SAMPLE_CSV, encoding="utf-8") as src:
        lines = src.readlines()
    with open(short_csv, "w", encoding="utf-8", newline="") as dst:
        dst.writelines(lines[:-1])  # drop the last data row - CSV now has one fewer row than the GPKG

    report = run_phase_a("test-site", str(short_csv), SAMPLE_GPKG, always_true)
    assert not report.is_valid
    assert any("row counts" in e.context for e in report.errors)


def test_phase_a_rejects_grid_id_not_present_in_gpkg(tmp_path):
    extra_csv = tmp_path / "extra.csv"
    with open(SAMPLE_CSV, encoding="utf-8") as src:
        lines = src.readlines()
    fabricated = lines[1].replace("0,1,", "99999,1,", 1)
    with open(extra_csv, "w", encoding="utf-8", newline="") as dst:
        dst.writelines(lines + [fabricated])

    report = run_phase_a("test-site", str(extra_csv), SAMPLE_GPKG, always_true)
    assert not report.is_valid
    assert any("grid_id consistency" in e.context for e in report.errors)


def test_fixtures_are_copies_of_real_production_files_not_synthetic():
    # Guards against the fixtures silently being replaced with invented
    # data in a future edit - the whole point of using real rows.
    assert os.path.getsize(SAMPLE_GPKG) > 10_000  # a real GeoPackage, not a stub
    with open(SAMPLE_CSV, encoding="utf-8") as f:
        first_data_row = f.readlines()[1]
    assert first_data_row.startswith("0,1,2026-06-29,2026-07-11,12,0.0006510872044600546,0.2957930266857147")


# ---------------------------------------------------------------- STEP 4A: finite-value validation


def _write_csv_with_replaced_field(tmp_path, column_index: int, new_value: str):
    """Copy the real fixture CSV, replacing one field on the first data
    row. Everything else stays real."""
    out = tmp_path / "mutated.csv"
    with open(SAMPLE_CSV, encoding="utf-8") as src:
        rows = list(csv.reader(src))
    rows[1][column_index] = new_value
    with open(out, "w", encoding="utf-8", newline="") as dst:
        csv.writer(dst).writerows(rows)
    return str(out)


LOS_COL = read_csv.EXPECTED_HEADER.index("los_displacement_m")
COHERENCE_COL = read_csv.EXPECTED_HEADER.index("coherence")
INCIDENCE_COL = read_csv.EXPECTED_HEADER.index("incidence_angle_rad")
PHI_COL = read_csv.EXPECTED_HEADER.index("look_vector_phi_rad")
THETA_COL = read_csv.EXPECTED_HEADER.index("look_vector_theta_rad")


@pytest.mark.parametrize(
    "column_index,bad_value,field_label",
    [
        (LOS_COL, "nan", "los_displacement_m/NaN"),
        (LOS_COL, "inf", "los_displacement_m/Infinity"),
        (LOS_COL, "-inf", "los_displacement_m/-Infinity"),
        (COHERENCE_COL, "nan", "coherence/NaN"),
        (COHERENCE_COL, "inf", "coherence/Infinity"),
        (INCIDENCE_COL, "nan", "incidence_angle_rad/NaN"),
        (PHI_COL, "inf", "look_vector_phi_rad/Infinity"),
        (THETA_COL, "-inf", "look_vector_theta_rad/-Infinity"),
    ],
)
def test_phase_a_rejects_nan_and_infinity_everywhere(tmp_path, column_index, bad_value, field_label):
    bad_csv = _write_csv_with_replaced_field(tmp_path, column_index, bad_value)
    report = run_phase_a("test-site", bad_csv, SAMPLE_GPKG, always_true)
    assert not report.is_valid, f"expected rejection for {field_label}"
    assert any("finite" in e.message or "cannot be empty" in e.message for e in report.errors), report.errors
    # The actual zero-write guarantee is `report.is_valid` gating Phase B
    # entirely (proven separately below by the FakeClient tests) - a
    # partially-populated validated_observations list is harmless and
    # expected internally (it's simply never used, since is_valid is
    # False), so this test only needs to confirm the gate itself trips.


def test_finite_float_helper_rejects_nan_directly():
    from validate import ValidationReport, _parse_finite_float

    report = ValidationReport()
    value, ok = _parse_finite_float("nan", "coherence", "ctx", report, allow_none=False)
    assert ok is False
    assert value is None
    assert "finite" in report.errors[0].message


def test_finite_float_helper_rejects_infinity_directly():
    from validate import ValidationReport, _parse_finite_float

    report = ValidationReport()
    value, ok = _parse_finite_float("Infinity", "los_displacement_m", "ctx", report, allow_none=True)
    assert ok is False
    assert value is None


def test_finite_float_helper_still_allows_legitimate_none():
    from validate import ValidationReport, _parse_finite_float

    report = ValidationReport()
    value, ok = _parse_finite_float("", "los_displacement_m", "ctx", report, allow_none=True)
    assert ok is True
    assert value is None
    assert report.errors == []


def test_finite_float_helper_still_accepts_real_finite_value():
    from validate import ValidationReport, _parse_finite_float

    report = ValidationReport()
    value, ok = _parse_finite_float("0.5204799771308899", "coherence", "ctx", report, allow_none=False)
    assert ok is True
    assert value == pytest.approx(0.5204799771308899)
    assert report.errors == []


# ---------------------------------------------------------------- STEP 4A: atomic Phase B gating (fake client, no network)


class FakeClient:
    """Records what would have been sent, performs no real network I/O.
    Standing in for SupabaseClient in tests so the phase-gating logic
    (does Phase B run, does it run exactly once, does it run with the
    right data) is provable without touching a real database, per the
    instruction not to use real production writes in tests."""

    def __init__(self, site_exists_result: bool = True):
        self._site_exists_result = site_exists_result
        self.import_batch_calls: list[tuple[str, list, list]] = []

    def site_exists(self, _site_id: str) -> bool:
        return self._site_exists_result

    def import_batch_transactional(self, site_id: str, cells: list[dict], observations: list[dict]) -> dict:
        self.import_batch_calls.append((site_id, cells, observations))
        return {"cells_written": len(cells), "observations_written": len(observations)}


def _args(dry_run: bool):
    from import_insar_grid import parse_args

    argv = [
        "--site-id=test-site",
        f"--csv={SAMPLE_CSV}",
        f"--gpkg={SAMPLE_GPKG}",
    ]
    if dry_run:
        argv.append("--dry-run")
    return parse_args(argv)


def test_dry_run_never_calls_the_transactional_write_path():
    from import_insar_grid import run

    client = FakeClient(site_exists_result=True)
    exit_code = run(_args(dry_run=True), client)
    assert exit_code == 0
    assert client.import_batch_calls == []


def test_invalid_site_never_calls_the_transactional_write_path():
    from import_insar_grid import run

    client = FakeClient(site_exists_result=False)
    exit_code = run(_args(dry_run=False), client)
    assert exit_code == 1
    assert client.import_batch_calls == []


def test_successful_validation_calls_the_transactional_write_path_exactly_once_with_full_dataset():
    from import_insar_grid import run

    client = FakeClient(site_exists_result=True)
    exit_code = run(_args(dry_run=False), client)
    assert exit_code == 0
    assert len(client.import_batch_calls) == 1
    site_id, cells, observations = client.import_batch_calls[0]
    assert site_id == "test-site"
    assert len(cells) == 3
    assert len(observations) == 18
    # The one real NULL LOS value must have survived all the way to the
    # payload that would be sent to the atomic RPC.
    null_row = next(o for o in observations if o["grid_id"] == 41 and o["pair"] == 1)
    assert null_row["los_displacement_m"] is None
