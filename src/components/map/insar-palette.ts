// Dedicated diverging colormap for InSAR LOS displacement (mm). Deliberately
// NOT the risk/health palette (RISK_COLORS in mine-map.tsx) - displacement
// direction/magnitude is a measurement, not a risk judgement, and must never
// be visually confused with node health or the site risk banner.
//
// Hex values here are duplicated (not read via CSS var()) from the
// --insar-* tokens in globals.css, because MapLibre paint expressions need
// literal color values, not CSS custom properties. The two are intentionally
// theme-independent (see globals.css comment) so this duplication is stable;
// if the tokens ever change, update both together.
export const INSAR_NO_DATA_COLOR = "#9aa0a6";

const DIVERGING_STOPS: [number, string][] = [
  [-30, "#2166ac"],
  [-10, "#67a9cf"],
  [0, "#f7f7f7"],
  [10, "#ef8a62"],
  [30, "#b2182b"],
];

const GOOD_COHERENCE_OPACITY = 0.75;
const LOW_COHERENCE_OPACITY = 0.35;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Diverging color for a LOS displacement value in millimetres, centered on
 * zero. Returns the dedicated no-data color for null (a genuinely missing
 * measurement) - never green, never the same as "near zero displacement".
 */
export function insarFillColor(displacementMm: number | null): string {
  if (displacementMm == null) return INSAR_NO_DATA_COLOR;
  const clamped = Math.max(DIVERGING_STOPS[0][0], Math.min(DIVERGING_STOPS[DIVERGING_STOPS.length - 1][0], displacementMm));
  for (let i = 0; i < DIVERGING_STOPS.length - 1; i++) {
    const [loVal, loColor] = DIVERGING_STOPS[i];
    const [hiVal, hiColor] = DIVERGING_STOPS[i + 1];
    if (clamped >= loVal && clamped <= hiVal) {
      const t = (clamped - loVal) / (hiVal - loVal);
      return mix(loColor, hiColor, t);
    }
  }
  return INSAR_NO_DATA_COLOR;
}

/**
 * Fill opacity driven by cell_coherence_quality only - low coherence stays
 * visible (never hidden, never treated as "zero deformation"), just
 * rendered with reduced confidence.
 */
export function insarFillOpacity(quality: "GOOD" | "LOW"): number {
  return quality === "GOOD" ? GOOD_COHERENCE_OPACITY : LOW_COHERENCE_OPACITY;
}

/** MapLibre data-driven paint expression mirroring insarFillColor exactly. */
export function insarFillColorExpression(): unknown[] {
  return [
    "case",
    ["==", ["get", "los_displacement_mm"], null],
    INSAR_NO_DATA_COLOR,
    [
      "interpolate",
      ["linear"],
      ["get", "los_displacement_mm"],
      ...DIVERGING_STOPS.flatMap(([v, c]) => [v, c]),
    ],
  ];
}

/** MapLibre data-driven paint expression mirroring insarFillOpacity exactly. */
export function insarFillOpacityExpression(): unknown[] {
  return ["case", ["==", ["get", "cell_coherence_quality"], "GOOD"], GOOD_COHERENCE_OPACITY, LOW_COHERENCE_OPACITY];
}

export const INSAR_LEGEND_STOPS = DIVERGING_STOPS;
