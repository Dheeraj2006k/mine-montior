import { describe, it, expect } from "vitest";
import { findBaselineReading } from "./node-baseline";

describe("findBaselineReading", () => {
  it("returns null when no candidates exist", () => {
    expect(findBaselineReading([], "2026-01-01T00:00:00Z")).toBeNull();
  });

  it("returns null when every reading predates registration", () => {
    const candidates = [
      { id: 1, recorded_at: "2025-12-31T23:00:00Z" },
      { id: 2, recorded_at: "2025-12-31T23:30:00Z" },
    ];
    expect(findBaselineReading(candidates, "2026-01-01T00:00:00Z")).toBeNull();
  });

  it("picks the earliest reading at or after registration, ignoring later ones", () => {
    const candidates = [
      { id: 3, recorded_at: "2026-01-01T00:10:00Z" },
      { id: 1, recorded_at: "2026-01-01T00:05:00Z" },
      { id: 2, recorded_at: "2026-01-01T00:05:30Z" },
    ];
    expect(findBaselineReading(candidates, "2026-01-01T00:00:00Z")).toEqual({
      id: 1,
      recorded_at: "2026-01-01T00:05:00Z",
    });
  });

  it("accepts a reading recorded at exactly the registration timestamp", () => {
    const candidates = [{ id: 1, recorded_at: "2026-01-01T00:00:00Z" }];
    expect(findBaselineReading(candidates, "2026-01-01T00:00:00Z")).toEqual(candidates[0]);
  });
});
