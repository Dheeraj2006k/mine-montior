import { describe, it, expect } from "vitest";
import { deriveInsarConfirmationLevel, INSAR_CONFIRMATION_LABEL } from "./insar-evidence";

describe("deriveInsarConfirmationLevel", () => {
  it("is unavailable when there are no grid cells for the selected pair", () => {
    expect(deriveInsarConfirmationLevel({ totalCells: 0, goodCoherenceCount: 0 })).toBe("unavailable");
  });

  it("is available when at least one cell meets the GOOD coherence threshold", () => {
    expect(deriveInsarConfirmationLevel({ totalCells: 1591, goodCoherenceCount: 1 })).toBe("available");
    expect(deriveInsarConfirmationLevel({ totalCells: 1591, goodCoherenceCount: 1591 })).toBe("available");
  });

  it("is available-limited-by-coherence when cells exist but none meet GOOD coherence", () => {
    expect(deriveInsarConfirmationLevel({ totalCells: 1591, goodCoherenceCount: 0 })).toBe(
      "available_limited_coherence",
    );
  });

  it("never returns a numeric score, probability, or percentage - only one of three fixed states", () => {
    const result = deriveInsarConfirmationLevel({ totalCells: 500, goodCoherenceCount: 10 });
    expect(["unavailable", "available", "available_limited_coherence"]).toContain(result);
    expect(typeof result).toBe("string");
  });

  it("labels never use probability/likelihood/danger language", () => {
    for (const label of Object.values(INSAR_CONFIRMATION_LABEL)) {
      expect(label).not.toMatch(/probability|likelihood|percent|danger|risk/i);
    }
  });
});
