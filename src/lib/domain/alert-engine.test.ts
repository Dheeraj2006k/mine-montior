import { describe, expect, it } from "vitest";
import {
  severityFromEvidenceScore,
  correlationKey,
  decideDedup,
  overlapsBlastWindow,
  buildSummary,
  type OpenAlertLike,
} from "./alert-engine";

describe("severityFromEvidenceScore", () => {
  it.each([
    [0.1, "info"],
    [0.39, "info"],
    [0.4, "warning"],
    [0.64, "warning"],
    [0.65, "high"],
    [0.84, "high"],
    [0.85, "critical"],
    [1.0, "critical"],
  ])("maps %f -> %s", (score, expected) => {
    expect(severityFromEvidenceScore(score)).toBe(expected);
  });
});

describe("correlationKey", () => {
  it("combines site, node, and severity band", () => {
    expect(correlationKey("SIH-DEMO-01", 2, "high")).toBe("SIH-DEMO-01:2:high");
  });
});

describe("decideDedup", () => {
  it("creates a new alert when none is open", () => {
    expect(decideDedup(null, "warning")).toEqual({ action: "create_new" });
  });

  it("folds into the existing alert at the same severity band", () => {
    const existing: OpenAlertLike = {
      id: 42,
      severity: "warning",
      state: "notified",
      correlation_key: "SIH-DEMO-01:2:warning",
    };
    expect(decideDedup(existing, "warning")).toEqual({
      action: "update_existing",
      alertId: 42,
    });
  });

  it("never masks an escalation to a strictly higher band", () => {
    const existing: OpenAlertLike = {
      id: 42,
      severity: "warning",
      state: "notified",
      correlation_key: "SIH-DEMO-01:2:warning",
    };
    expect(decideDedup(existing, "critical")).toEqual({ action: "create_new" });
  });

  it("still folds a lower-severity repeat into the existing higher-severity alert", () => {
    const existing: OpenAlertLike = {
      id: 42,
      severity: "critical",
      state: "notified",
      correlation_key: "SIH-DEMO-01:2:critical",
    };
    // A repeat event actually computes its own band's correlation key in
    // practice, but the dedup function itself must not "escalate" a lower
    // reading against an already-critical open alert.
    expect(decideDedup(existing, "warning")).toEqual({
      action: "update_existing",
      alertId: 42,
    });
  });
});

describe("overlapsBlastWindow", () => {
  const window = { planned_start: "2026-01-01T14:00:00Z", planned_end: "2026-01-01T14:20:00Z" };

  it("detects a direct overlap", () => {
    expect(overlapsBlastWindow("2026-01-01T14:10:00Z", [window])).toBe(true);
  });

  it("applies the 5-minute margin on both sides", () => {
    expect(overlapsBlastWindow("2026-01-01T13:57:00Z", [window])).toBe(true);
    expect(overlapsBlastWindow("2026-01-01T14:24:00Z", [window])).toBe(true);
  });

  it("returns false well outside the window + margin", () => {
    expect(overlapsBlastWindow("2026-01-01T15:00:00Z", [window])).toBe(false);
  });

  it("returns false with no windows", () => {
    expect(overlapsBlastWindow("2026-01-01T14:10:00Z", [])).toBe(false);
  });
});

describe("buildSummary", () => {
  it("produces a deterministic, evidence-grounded sentence", () => {
    const summary = buildSummary({
      nodeLabel: "Node_02",
      reason: "combined_evidence",
      evidenceScore: 0.87,
      severity: "high",
    });
    expect(summary).toContain("Node_02");
    expect(summary).toContain("0.87");
    expect(summary).toContain("high");
  });
});
