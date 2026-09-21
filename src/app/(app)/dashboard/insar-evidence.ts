// Pure, DOM-free logic for the dashboard's InSAR Evidence card (Phase 10).
// Deliberately NOT a risk/probability score - "Confirmation Level" here is
// a simple evidence-availability/quality-availability state, derived only
// from whether grid data exists for the selected pair and whether any of
// it meets the already-established (Phase 6) cell_coherence_quality GOOD
// threshold. It never reads los_displacement_m, never computes a mean/
// min/max, and never feeds back into operational risk.
export type InsarConfirmationLevel = "unavailable" | "available" | "available_limited_coherence";

export const INSAR_CONFIRMATION_LABEL: Record<InsarConfirmationLevel, string> = {
  unavailable: "Unavailable",
  available: "Available",
  available_limited_coherence: "Available — limited by coherence",
};

/**
 * totalCells / goodCoherenceCount come from computeInsarPairSummary
 * (src/app/(app)/insar/insar-analysis-utils.ts) - the same pure summary
 * function the /insar analysis page already uses, not a re-derivation.
 */
export function deriveInsarConfirmationLevel(input: {
  totalCells: number;
  goodCoherenceCount: number;
}): InsarConfirmationLevel {
  if (input.totalCells === 0) return "unavailable";
  return input.goodCoherenceCount > 0 ? "available" : "available_limited_coherence";
}
