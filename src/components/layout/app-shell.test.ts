import { describe, it, expect } from "vitest";
import { visibleFor, type AppRole } from "./app-shell";

describe("visibleFor (nav RBAC presentation filter)", () => {
  it("shows everything while the role hasn't loaded yet - the API is the real boundary, not a flash of missing nav", () => {
    expect(visibleFor(null, { minRole: "admin" })).toBe(true);
    expect(visibleFor(null, { minRole: "viewer" })).toBe(true);
  });

  it("viewer sees only viewer-level items", () => {
    expect(visibleFor("viewer", { minRole: "viewer" })).toBe(true);
    expect(visibleFor("viewer", { minRole: "operator" })).toBe(false);
    expect(visibleFor("viewer", { minRole: "admin" })).toBe(false);
  });

  it("operator sees viewer and operator items, not admin", () => {
    expect(visibleFor("operator", { minRole: "viewer" })).toBe(true);
    expect(visibleFor("operator", { minRole: "operator" })).toBe(true);
    expect(visibleFor("operator", { minRole: "admin" })).toBe(false);
  });

  it("admin sees everything", () => {
    const roles: AppRole[] = ["viewer", "operator", "admin"];
    for (const minRole of roles) {
      expect(visibleFor("admin", { minRole })).toBe(true);
    }
  });
});
