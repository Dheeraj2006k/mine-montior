// Pure, DOM/WebGL-free logic backing the /twin demonstration page (Phase
// 11). Everything here is explicitly illustrative/planning-visualization
// logic - none of it is read by, or writes to, the operational risk
// engine, alert engine, prediction engine, or InSAR. Values flow ONE WAY
// only: real data (a live node risk score, real configured geometry) may
// be READ into these functions to make the demo more grounded, but nothing
// computed here is ever written back to real system state.

/** Clamp a slider value into the valid 0-100 extraction-percent range. */
export function clampExtractionPct(pct: number): number {
  if (Number.isNaN(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Bord-and-pillar illustrative pillar-removal pattern: "remove every Nth
 * pillar" so a higher extraction % visually removes more pillars. This is
 * a display pattern, not a claim about which real pillars were extracted
 * (the setup wizard only captures a pillar_width_m/gallery_width_m scalar
 * pair, never surveyed pillar positions - see PillarGrid in twin-scene.tsx).
 */
export function pillarRemovedEvery(extractionPct: number): number {
  const pct = clampExtractionPct(extractionPct);
  if (pct >= 90) return 1;
  if (pct <= 0) return Infinity;
  return Math.max(1, Math.round(100 / pct));
}

/**
 * The Twin's "combined indicator (illustrative)" - blends a REAL live max
 * node risk score with the REAL/slider extraction % via a simple, fixed,
 * explicitly-unvalidated formula, purely for demonstration. Never a
 * physics-based subsidence prediction, never written back to
 * siteRiskState()/alert-engine/predictions/InSAR - read here, one-way,
 * from already-computed real values, and rendered with a distinct
 * "illustrative" badge (never RiskBadge) so it cannot be mistaken for
 * operational risk.
 */
export function deriveIllustrativeSusceptibility(input: {
  maxLiveRisk: number | null;
  extractionPct: number;
}): number | null {
  if (input.maxLiveRisk == null) return null;
  const pct = clampExtractionPct(input.extractionPct);
  return Math.min(1, input.maxLiveRisk * 0.7 + (pct / 100) * 0.3);
}

/**
 * Longwall planning-mode "hypothetical" scrub position - extrapolates the
 * existing real predicted_zone severities forward by a user-chosen number
 * of days via a fixed multiplier. Still driven entirely by real model
 * output, just scaled for the demo; never re-runs or replaces the model.
 */
export function deriveHypotheticalScrub(input: {
  scrubT: number;
  hypotheticalDays: number;
  planningMode: boolean;
  mineType: "longwall" | "bord_and_pillar";
}): number {
  if (input.mineType !== "longwall" || !input.planningMode) return input.scrubT;
  const multiplier = 1 + Math.min(1, input.hypotheticalDays / 30) * 0.6;
  return Math.min(1, input.scrubT * multiplier);
}

/**
 * Formats a possibly-missing configured value honestly - never fabricates
 * a number/string to "fill in" an incomplete site setup.
 */
export function formatConfiguredValue(value: number | string | undefined | null, unit?: string): string {
  if (value == null || value === "") return "Not configured";
  return unit ? `${value} ${unit}` : String(value);
}
