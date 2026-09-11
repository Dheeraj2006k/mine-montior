import { describe, expect, it } from "vitest";
import { computeNodeHealth, type ReadingLike } from "./node-health";

function reading(overrides: Partial<ReadingLike>): ReadingLike {
  return {
    seq_num: 1,
    recorded_at: new Date().toISOString(),
    sensor_ok: true,
    low_battery: false,
    comm_quality_low: false,
    calibration_stale: false,
    ...overrides,
  };
}

describe("computeNodeHealth", () => {
  it("returns unknown with no readings", () => {
    expect(computeNodeHealth([])).toEqual({
      last_seen_at: null,
      packet_loss_pct: null,
      health_state: "unknown",
    });
  });

  it("is normal for a fresh, healthy, contiguous stream", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    const readings = [1, 2, 3].map((seq_num) =>
      reading({ seq_num, recorded_at: "2026-01-01T00:09:30Z" }),
    );
    const result = computeNodeHealth(readings, now);
    expect(result.health_state).toBe("normal");
    expect(result.packet_loss_pct).toBe(0);
  });

  it("never reports unknown sensor health as normal/green, even if recent", () => {
    const now = new Date("2026-01-01T00:00:05Z");
    const readings = [reading({ recorded_at: "2026-01-01T00:00:00Z", sensor_ok: false })];
    const result = computeNodeHealth(readings, now);
    expect(result.health_state).toBe("unknown");
  });

  it("reports offline after a long silence, taking priority over sensor_ok", () => {
    const now = new Date("2026-01-01T01:00:00Z");
    const readings = [reading({ recorded_at: "2026-01-01T00:00:00Z", sensor_ok: true })];
    const result = computeNodeHealth(readings, now);
    expect(result.health_state).toBe("offline");
  });

  it("reports stale between the stale and offline thresholds", () => {
    const now = new Date("2026-01-01T00:07:00Z");
    const readings = [reading({ recorded_at: "2026-01-01T00:00:00Z" })];
    const result = computeNodeHealth(readings, now);
    expect(result.health_state).toBe("stale");
  });

  it("computes packet loss from seq_num gaps", () => {
    const now = new Date("2026-01-01T00:00:10Z");
    const readings = [1, 2, 5].map((seq_num) =>
      reading({ seq_num, recorded_at: "2026-01-01T00:00:00Z" }),
    );
    const result = computeNodeHealth(readings, now);
    // expected span 1..5 = 5, only 3 present -> 40% loss
    expect(result.packet_loss_pct).toBe(40);
  });

  it("flags warning for degraded-but-healthy status flags", () => {
    const now = new Date("2026-01-01T00:00:10Z");
    const readings = [reading({ recorded_at: "2026-01-01T00:00:00Z", low_battery: true })];
    const result = computeNodeHealth(readings, now);
    expect(result.health_state).toBe("warning");
  });
});
