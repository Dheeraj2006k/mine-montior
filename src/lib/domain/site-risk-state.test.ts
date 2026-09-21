import { describe, it, expect } from "vitest";
import { siteRiskState } from "./site-risk-state";

describe("siteRiskState", () => {
  it("is waiting-for-data, NOT normal, when there is no risk score and no alert", () => {
    const result = siteRiskState({ maxNodeRiskScore: null, activeAlertSeverities: [], anyNodeNotNormal: false });
    expect(result.dataState).toBe("waiting");
    expect(result.riskState).toBeNull();
  });

  it("is still waiting-for-data even if a node is flagged not-normal, as long as there's no risk score or alert", () => {
    // e.g. a brand-new node whose health_state is "unknown" because it has
    // never reported - that's an absence of data, not evidence of trouble.
    const result = siteRiskState({ maxNodeRiskScore: null, activeAlertSeverities: [], anyNodeNotNormal: true });
    expect(result.dataState).toBe("waiting");
    expect(result.riskState).toBeNull();
  });

  it("is normal when valid low-risk data exists", () => {
    const result = siteRiskState({ maxNodeRiskScore: 0.1, activeAlertSeverities: [], anyNodeNotNormal: false });
    expect(result.dataState).toBe("available");
    expect(result.riskState).toBe("normal");
  });

  it("an active alert alone counts as real data, even with no risk score", () => {
    const result = siteRiskState({ maxNodeRiskScore: null, activeAlertSeverities: ["warning"], anyNodeNotNormal: false });
    expect(result.dataState).toBe("available");
    expect(result.riskState).toBe("watch");
  });

  it("escalates to watch on a non-normal node when a risk score is present", () => {
    const result = siteRiskState({ maxNodeRiskScore: 0.1, activeAlertSeverities: [], anyNodeNotNormal: true });
    expect(result.dataState).toBe("available");
    expect(result.riskState).toBe("watch");
  });

  it("escalates to warning on a high-severity alert", () => {
    const result = siteRiskState({ maxNodeRiskScore: 0.1, activeAlertSeverities: ["high"], anyNodeNotNormal: false });
    expect(result.riskState).toBe("warning");
  });

  it("escalates to critical on a critical alert regardless of risk score", () => {
    const result = siteRiskState({
      maxNodeRiskScore: 0.05,
      activeAlertSeverities: ["critical"],
      anyNodeNotNormal: false,
    });
    expect(result.riskState).toBe("critical");
  });

  it("takes the maximum of risk-score-derived and alert-derived state, never the minimum", () => {
    // high risk score (would be "warning") but only an info-level alert (would be "watch")
    const result = siteRiskState({ maxNodeRiskScore: 0.7, activeAlertSeverities: ["info"], anyNodeNotNormal: false });
    expect(result.riskState).toBe("warning");
  });

  it("uses the same 0.4/0.65/0.85 bands as the alert engine's SEVERITY_BANDS", () => {
    expect(siteRiskState({ maxNodeRiskScore: 0.39, activeAlertSeverities: [], anyNodeNotNormal: false }).riskState).toBe(
      "normal",
    );
    expect(siteRiskState({ maxNodeRiskScore: 0.4, activeAlertSeverities: [], anyNodeNotNormal: false }).riskState).toBe(
      "watch",
    );
    expect(siteRiskState({ maxNodeRiskScore: 0.65, activeAlertSeverities: [], anyNodeNotNormal: false }).riskState).toBe(
      "warning",
    );
    expect(siteRiskState({ maxNodeRiskScore: 0.85, activeAlertSeverities: [], anyNodeNotNormal: false }).riskState).toBe(
      "critical",
    );
  });
});
