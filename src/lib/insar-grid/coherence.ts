export type CellCoherenceQuality = "GOOD" | "LOW";

const CELL_COHERENCE_GOOD_THRESHOLD = 0.5;

// Derived SOLELY from one grid cell's own numeric coherence (0-1) for one
// pair. Deliberately named cell_coherence_quality (not the ambiguous
// "coherence_quality") to avoid confusion with the InSAR source handoff's
// separate pair-level coherence_ge_0_5_percent temporal QC classification
// (percentage of pixels above threshold, across the whole pair) - that
// value is not imported into this application at all. See
// INSAR_INTEGRATION_DESIGN.md (Revision 3) §18/§3 for why the two must
// never be conflated. Single source of truth - every place that renders a
// GOOD/LOW label (API, future map layer, future Data Monitor formatting)
// calls this function rather than re-implementing the >= 0.5 rule.
export function cellCoherenceQuality(coherence: number): CellCoherenceQuality {
  return coherence >= CELL_COHERENCE_GOOD_THRESHOLD ? "GOOD" : "LOW";
}

// Pair-wise LOS displacement, metres -> millimetres. Null-safe: a
// genuinely missing source measurement (39 real rows in the current
// handoff) stays null all the way through - never coerced to 0.
export function toDisplacementMm(displacementM: number | null): number | null {
  return displacementM == null ? null : displacementM * 1000;
}
