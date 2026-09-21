"""EPSG:32645 -> EPSG:4326 reprojection.

Uses pyproj - a real, standard projection library - never a manual or
approximate formula. This is the one deliberate geometric transformation
in the whole pipeline (INSAR_INTEGRATION_DESIGN.md §4): the source GPKG
geometry itself is never mutated; this function only ever produces a new,
separate representation for storage in insar_grid_cells.geometry_4326.
"""

from pyproj import Transformer
from shapely.geometry import Polygon, mapping

_transformer = Transformer.from_crs("EPSG:32645", "EPSG:4326", always_xy=True)


def transform_polygon_to_4326_geojson(points_32645: list[tuple[float, float]]) -> dict:
    """points_32645: a closed ring of (x, y) in EPSG:32645.
    Returns a GeoJSON Polygon dict in EPSG:4326.
    Raises ValueError if the transformed ring isn't a valid polygon."""
    points_4326 = [_transformer.transform(x, y) for x, y in points_32645]
    polygon = Polygon(points_4326)
    if not polygon.is_valid:
        raise ValueError(f"transformed geometry is not a valid polygon: {polygon}")
    return mapping(polygon)
