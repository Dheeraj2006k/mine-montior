import { describe, expect, it } from "vitest";
import { projectToLocalMetres } from "./project";

describe("projectToLocalMetres", () => {
  it("places the origin at (0,0)", () => {
    const origin = { lat: 23.7957, lon: 86.4304 };
    expect(projectToLocalMetres(origin, origin)).toEqual({ x: 0, y: 0 });
  });

  it("moves north (higher lat) to positive y", () => {
    const origin = { lat: 23.7957, lon: 86.4304 };
    const point = { lat: 23.7967, lon: 86.4304 };
    const { y } = projectToLocalMetres(point, origin);
    expect(y).toBeGreaterThan(0);
  });

  it("moves east (higher lon) to positive x", () => {
    const origin = { lat: 23.7957, lon: 86.4304 };
    const point = { lat: 23.7957, lon: 86.4314 };
    const { x } = projectToLocalMetres(point, origin);
    expect(x).toBeGreaterThan(0);
  });
});
