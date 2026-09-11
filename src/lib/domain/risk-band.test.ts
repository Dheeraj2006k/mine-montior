import { describe, expect, it } from "vitest";
import { riskBand } from "./risk-band";

describe("riskBand", () => {
  it.each([
    [0, "low"],
    [0.39, "low"],
    [0.4, "medium"],
    [0.69, "medium"],
    [0.7, "high"],
    [1, "high"],
  ])("maps %f -> %s", (score, expected) => {
    expect(riskBand(score)).toBe(expected);
  });
});
