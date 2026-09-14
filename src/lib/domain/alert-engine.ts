export type AlertSeverity = "info" | "warning" | "high" | "critical";
export type AlertState = "new" | "notified" | "acknowledged" | "resolved" | "dismissed";

// Plan §7.1 - config, not constants, in spirit: this is the one place the
// evidence_score -> severity mapping lives, so it can be swapped out without
// touching call sites.
export const SEVERITY_BANDS: { max: number; severity: AlertSeverity }[] = [
  { max: 0.4, severity: "info" },
  { max: 0.65, severity: "warning" },
  { max: 0.85, severity: "high" },
  { max: Infinity, severity: "critical" },
];

export function severityFromEvidenceScore(evidenceScore: number): AlertSeverity {
  const band = SEVERITY_BANDS.find((b) => evidenceScore < b.max);
  return band?.severity ?? "critical";
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  high: 2,
  critical: 3,
};

export function isHigherSeverity(a: AlertSeverity, b: AlertSeverity): boolean {
  return SEVERITY_RANK[a] > SEVERITY_RANK[b];
}

export function correlationKey(siteId: string, nodeId: number, severity: AlertSeverity): string {
  return `${siteId}:${nodeId}:${severity}`;
}

export type OpenAlertLike = {
  id: number;
  severity: AlertSeverity;
  state: AlertState;
  correlation_key: string;
};

export type DedupDecision =
  | { action: "update_existing"; alertId: number }
  | { action: "create_new" };

/**
 * PRD §7.2 dedup rule, and its critical exception: a dedup rule must never
 * mask an escalation. If severity has moved to a strictly higher band since
 * the open alert was created, this is a genuinely new situation - create a
 * new alert rather than silently folding it into the old one.
 */
export function decideDedup(
  existingOpenAlert: OpenAlertLike | null,
  newSeverity: AlertSeverity,
): DedupDecision {
  if (!existingOpenAlert) return { action: "create_new" };
  if (isHigherSeverity(newSeverity, existingOpenAlert.severity)) {
    return { action: "create_new" };
  }
  return { action: "update_existing", alertId: existingOpenAlert.id };
}

export function buildSummary(params: {
  nodeLabel: string;
  reason: string;
  evidenceScore: number;
  severity: AlertSeverity;
}): string {
  const { nodeLabel, reason, evidenceScore, severity } = params;
  const reasonText =
    reason === "strong_single_signal"
      ? "a single strong signal"
      : reason === "sensor_health_unknown"
        ? "sensor health preventing a confident read"
        : "combined evidence";
  return `${nodeLabel} escalated on ${reasonText} (evidence score ${evidenceScore.toFixed(2)}, severity ${severity}).`;
}

export type BlastWindow = { planned_start: string; planned_end: string };

const BLAST_MARGIN_MS = 5 * 60 * 1000;

/**
 * PRD §7.3: overlap only ever affects notification urgency, never the
 * severity shown on the dashboard. This function only answers "does an
 * overlap exist" - callers must not use it to change severity.
 */
export function overlapsBlastWindow(occurredAtIso: string, windows: BlastWindow[]): boolean {
  const occurredAt = new Date(occurredAtIso).getTime();
  return windows.some((w) => {
    const start = new Date(w.planned_start).getTime() - BLAST_MARGIN_MS;
    const end = new Date(w.planned_end).getTime() + BLAST_MARGIN_MS;
    return occurredAt >= start && occurredAt <= end;
  });
}
