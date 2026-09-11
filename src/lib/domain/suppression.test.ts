import { describe, expect, it } from "vitest";
import { computeSuppression } from "./suppression";

describe("computeSuppression", () => {
  it("is not suppressed with no feedback history", () => {
    expect(computeSuppression(2, "high", [])).toEqual({ suppressed: false });
  });

  it("suppresses within the window after a blast_or_disturbance verdict", () => {
    const now = new Date("2026-01-01T14:10:00Z");
    const feedback = [
      { verdict: "blast_or_disturbance", node_id: 2, severity: "high", created_at: "2026-01-01T14:00:00Z" },
    ];
    const result = computeSuppression(2, "high", feedback, now);
    expect(result.suppressed).toBe(true);
  });

  it("expires after the suppression window", () => {
    const now = new Date("2026-01-01T14:31:00Z");
    const feedback = [
      { verdict: "blast_or_disturbance", node_id: 2, severity: "high", created_at: "2026-01-01T14:00:00Z" },
    ];
    expect(computeSuppression(2, "high", feedback, now)).toEqual({ suppressed: false });
  });

  it("never suppresses a higher severity band on the same node", () => {
    const now = new Date("2026-01-01T14:10:00Z");
    const feedback = [
      { verdict: "blast_or_disturbance", node_id: 2, severity: "warning", created_at: "2026-01-01T14:00:00Z" },
    ];
    expect(computeSuppression(2, "critical", feedback, now)).toEqual({ suppressed: false });
  });

  it("never suppresses a different node", () => {
    const now = new Date("2026-01-01T14:10:00Z");
    const feedback = [
      { verdict: "blast_or_disturbance", node_id: 2, severity: "high", created_at: "2026-01-01T14:00:00Z" },
    ];
    expect(computeSuppression(3, "high", feedback, now)).toEqual({ suppressed: false });
  });

  it("ignores non-blast verdicts", () => {
    const now = new Date("2026-01-01T14:10:00Z");
    const feedback = [
      { verdict: "real_event", node_id: 2, severity: "high", created_at: "2026-01-01T14:00:00Z" },
    ];
    expect(computeSuppression(2, "high", feedback, now)).toEqual({ suppressed: false });
  });
});
