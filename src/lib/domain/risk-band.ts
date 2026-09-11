export type RiskBand = "low" | "medium" | "high";

// A 3-band read of the Fuzzy Risk Index for at-a-glance display. Distinct
// from the alert engine's 4-band severity (info/warning/high/critical,
// src/lib/domain/alert-engine.ts) — that one drives alerting/notification
// decisions; this one is purely a dashboard legibility aid over the same
// underlying rule-derived score. Never rendered as a probability (PRD §12) —
// pair with <FuzzyIndexLabel /> wherever this is shown.
export function riskBand(score: number): RiskBand {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export const RISK_BAND_COLOR: Record<RiskBand, string> = {
  low: "var(--normal)",
  medium: "var(--warning)",
  high: "var(--offline)",
};

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};
