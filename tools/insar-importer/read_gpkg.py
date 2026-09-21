"""Read grid-cell geometry from the production GeoPackage.

Uses Python's stdlib sqlite3 + struct to decode GeoPackage geometry blobs
directly, rather than geopandas/Fiona/GDAL. This is the same approach
independently verified during the InSAR Source Repository Audit (a real
polygon was manually decoded this way and confirmed to have an exact
80m x 80m envelope in EPSG:32645 - not an approximation). A GeoPackage is
just SQLite with a documented, stable geometry blob format (a small custom
header wrapping standard WKB), so no heavy GIS dependency is required to
read one correctly.

Table/column names used in the SQL below come from the GeoPackage's own
gpkg_contents/gpkg_geometry_columns metadata tables, never from unvalidated
external input, so building those queries with an f-string does not carry
the risk normal SQL string-building would.
"""

import sqlite3
import struct
from dataclasses import dataclass

EXPECTED_GEOMETRY_TYPE = "POLYGON"
EXPECTED_SRS_ID = 32645
WKB_POLYGON_TYPE = 3


@dataclass
class GpkgSchemaInfo:
    layer: str
    geometry_column: str
    geometry_type: str
    srs_id: int


@dataclass
class RawGpkgRow:
    row_index: int
    grid_id: int
    geometry_blob: bytes


def read_schema(gpkg_path: str) -> GpkgSchemaInfo:
    con = sqlite3.connect(gpkg_path)
    try:
        cur = con.cursor()
        row = cur.execute(
            "SELECT table_name FROM gpkg_contents WHERE data_type = 'features' LIMIT 1"
        ).fetchone()
        if not row:
            raise ValueError("gpkg_contents contains no 'features' layer")
        layer = row[0]

        geom_row = cur.execute(
            "SELECT column_name, geometry_type_name, srs_id "
            "FROM gpkg_geometry_columns WHERE table_name = ?",
            (layer,),
        ).fetchone()
        if not geom_row:
            raise ValueError(f"No geometry column registered for layer '{layer}'")

        return GpkgSchemaInfo(
            layer=layer,
            geometry_column=geom_row[0],
            geometry_type=geom_row[1],
            srs_id=geom_row[2],
        )
    finally:
        con.close()


def read_raw_rows(gpkg_path: str, schema: GpkgSchemaInfo) -> list[RawGpkgRow]:
    con = sqlite3.connect(gpkg_path)
    try:
        cur = con.cursor()
        cur.execute(f"SELECT grid_id, {schema.geometry_column} FROM {schema.layer}")
        rows = []
        for i, (grid_id, blob) in enumerate(cur.fetchall()):
            rows.append(RawGpkgRow(row_index=i, grid_id=grid_id, geometry_blob=blob))
        return rows
    finally:
        con.close()


def decode_polygon(blob: bytes) -> tuple[int, list[tuple[float, float]]]:
    """Decode one GeoPackage geometry blob -> (srs_id, closed ring of
    (x, y) points in the source CRS). Raises ValueError on anything that
    isn't a single-ring WKB Polygon - never guesses or substitutes."""
    if blob[0:2] != b"GP":
        raise ValueError("not a GeoPackage geometry blob (bad magic bytes)")
    version = blob[2]
    flags = blob[3]
    endian = "<" if (flags & 0x01) else ">"
    env_indicator = (flags >> 1) & 0x07
    srs_id = struct.unpack(endian + "i", blob[4:8])[0]

    env_lengths = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    if env_indicator not in env_lengths:
        raise ValueError(f"unrecognized envelope indicator {env_indicator}")
    offset = 8 + env_lengths[env_indicator]
    wkb = blob[offset:]

    byte_order = wkb[0]
    e = "<" if byte_order else ">"
    geom_type = struct.unpack(e + "I", wkb[1:5])[0]
    if geom_type != WKB_POLYGON_TYPE:
        raise ValueError(f"expected WKB Polygon (type {WKB_POLYGON_TYPE}), got type {geom_type}")

    num_rings = struct.unpack(e + "I", wkb[5:9])[0]
    if num_rings != 1:
        raise ValueError(f"expected exactly 1 ring for an 80m grid-cell square, got {num_rings}")

    num_points = struct.unpack(e + "I", wkb[9:13])[0]
    points: list[tuple[float, float]] = []
    p = 13
    for _ in range(num_points):
        x, y = struct.unpack(e + "2d", wkb[p : p + 16])
        points.append((x, y))
        p += 16

    if len(points) < 4 or points[0] != points[-1]:
        raise ValueError("ring is not closed (first point != last point)")

    return srs_id, points
