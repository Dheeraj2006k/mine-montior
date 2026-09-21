import type { AlertSeverity } from "./alert-engine";

// Operational risk is deliberately a separate concept from data
// availability (see siteRiskState below) - "no data" must never collapse
// into "normal". This is the project's own non-negotiable rule (unknown ≠
// normal, null ≠ zero, missing ≠ safe), applied at the site level, not just
// per-node.
export type OperationalRiskState = "normal" | "watch" | "warning" | "critical";
export type SiteDataState = "available" | "waiting";

export type SiteConditionResult = {
  dataState: SiteDataState;
  // null exactly when dataState is "waiting" - there is no operational
  // determination to make yet, not even a default one.
  riskState: OperationalRiskState | null;
};

export const SITE_RISK_LABEL: Record<OperationalRiskState, string> = {
  normal: "Normal",
  watch: "Watch",
  warning: "Warning",
  critical: "Critical",
};

export const SITE_RISK_COLOR: Record<OperationalRiskState, string> = {
  normal: "var(--normal)",
  watch: "var(--warning)",
  warning: "var(--stale)",
  critical: "var(--offline)",
};

// Deliberately NOT var(--normal)/green - waiting-for-data must never read
// as "everything's fine" at a glance, even in a projector/colour-blind
// context (icon+color+text still all vary together at the call site).
export const SITE_WAITING_COLOR = "var(--unknown)";

const RANK: Record<OperationalRiskState, number> = { normal: 0, watch: 1, warning: 2, critical: 3 };

function maxState(a: OperationalRiskState, b: OperationalRiskState): OperationalRiskState {
  return RANK[a] >= RANK[b] ? a : b;
}

// Site-level hero state (team-leader spec: Normal/Watch/Warning/Critical,
// corrected to add a distinct waiting-for-data state per the team leader's
// follow-up). Deliberately reuses the alert engine's own SEVERITY_BANDS
// thresholds (0.4/0.65/0.85, alert-engine.ts) rather than inventing new
// cutoffs, so this hero state and the alert severity a human actually sees
// never disagree about what "high" means. Pure bucketing of numbers the
// backend already produced - not a new risk calculation in the frontend.
//
// "Waiting for data" fires only when there is genuinely nothing to bucket:
// no active alert (which is itself real evidence, even without a node risk
// score) AND no node has ever produced a risk score. A node that HAS a
// (possibly stale) risk score, or is simply unhealthy/offline, is not
// "waiting" - anyNodeNotNormal still correctly escalates that case to
// "watch" below, because "we know it's offline" is data, not an absence of it.
export function siteRiskState(params: {
  maxNodeRiskScore: number | null;
  activeAlertSeverities: AlertSeverity[];
  anyNodeNotNormal: boolean;
}): SiteConditionResult {
  const { maxNodeRiskScore, activeAlertSeverities, anyNodeNotNormal } = params;

  if (maxNodeRiskScore == null && activeAlertSeverities.length === 0) {
    return { dataState: "waiting", riskState: null };
  }

  let state: OperationalRiskState = "normal";

  if (activeAlertSeverities.includes("critical")) state = maxState(state, "critical");
  if (activeAlertSeverities.includes("high")) state = maxState(state, "warning");
  if (activeAlertSeverities.includes("warning")) state = maxState(state, "watch");
  if (activeAlertSeverities.includes("info")) state = maxState(state, "watch");

  if (maxNodeRiskScore != null) {
    if (maxNodeRiskScore >= 0.85) state = maxState(state, "critical");
    else if (maxNodeRiskScore >= 0.65) state = maxState(state, "warning");
    else if (maxNodeRiskScore >= 0.4) state = maxState(state, "watch");
  }

  if (anyNodeNotNormal) state = maxState(state, "watch");

  return { dataState: "available", riskState: state };
}
