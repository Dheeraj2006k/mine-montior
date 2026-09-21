"""Read the production insar_spatiotemporal.csv - raw parsing only.

Deliberately does no type coercion or range validation here: every field
comes back as a plain string (or None for a genuinely empty
los_displacement_m), so a malformed value can never crash the read itself.
All parsing/range checks happen in validate.py, which can then accumulate
every problem across the whole file instead of stopping at the first bad
row - required by INSAR_INTEGRATION_DESIGN.md Revision 3's strict
two-phase import.
"""

import csv
from dataclasses import dataclass

EXPECTED_HEADER = [
    "grid_id",
    "pair",
    "reference_date",
    "secondary_date",
    "temporal_baseline_days",
    "los_displacement_m",
    "coherence",
    "incidence_angle_rad",
    "look_vector_phi_rad",
    "look_vector_theta_rad",
]


@dataclass
class RawObservationRow:
    line_number: int  # 1-based, matching what a human sees in the CSV
    grid_id: str
    pair: str
    reference_date: str
    secondary_date: str
    temporal_baseline_days: str
    los_displacement_m: str  # "" means genuinely missing - never coerced here
    coherence: str
    incidence_angle_rad: str
    look_vector_phi_rad: str
    look_vector_theta_rad: str


def read_header(csv_path: str) -> list[str]:
    with open(csv_path, newline="", encoding="utf-8") as f:
        return next(csv.reader(f))


def read_raw_rows(csv_path: str) -> list[RawObservationRow]:
    rows: list[RawObservationRow] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for line_number, raw in enumerate(reader, start=2):  # header is line 1
            rows.append(
                RawObservationRow(
                    line_number=line_number,
                    grid_id=raw.get("grid_id", ""),
                    pair=raw.get("pair", ""),
                    reference_date=raw.get("reference_date", ""),
                    secondary_date=raw.get("secondary_date", ""),
                    temporal_baseline_days=raw.get("temporal_baseline_days", ""),
                    los_displacement_m=raw.get("los_displacement_m", ""),
                    coherence=raw.get("coherence", ""),
                    incidence_angle_rad=raw.get("incidence_angle_rad", ""),
                    look_vector_phi_rad=raw.get("look_vector_phi_rad", ""),
                    look_vector_theta_rad=raw.get("look_vector_theta_rad", ""),
                )
            )
    return rows
