import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "./permissions";

describe("RBAC permission matrix", () => {
  it("viewer has only read-only monitoring permissions", () => {
    expect(hasPermission("viewer", "dashboard.view")).toBe(true);
    expect(hasPermission("viewer", "alerts.view")).toBe(true);
    expect(hasPermission("viewer", "insar.view")).toBe(true);
    expect(hasPermission("viewer", "twin.view")).toBe(true);
    expect(hasPermission("viewer", "alerts.acknowledge")).toBe(false);
    expect(hasPermission("viewer", "nodes.operational_action")).toBe(false);
    expect(hasPermission("viewer", "users.manage")).toBe(false);
    expect(hasPermission("viewer", "roles.manage")).toBe(false);
    expect(hasPermission("viewer", "ownership.manage")).toBe(false);
  });

  it("operator has viewer permissions plus operational actions, never admin ones", () => {
    for (const p of ROLE_PERMISSIONS.viewer) {
      expect(hasPermission("operator", p)).toBe(true);
    }
    expect(hasPermission("operator", "alerts.acknowledge")).toBe(true);
    expect(hasPermission("operator", "alerts.investigate")).toBe(true);
    expect(hasPermission("operator", "alerts.note")).toBe(true);
    expect(hasPermission("operator", "nodes.operational_action")).toBe(true);
    expect(hasPermission("operator", "users.manage")).toBe(false);
    expect(hasPermission("operator", "roles.manage")).toBe(false);
    expect(hasPermission("operator", "ownership.manage")).toBe(false);
    expect(hasPermission("operator", "settings.manage")).toBe(false);
    expect(hasPermission("operator", "audit.view")).toBe(false);
  });

  it("admin has every permission operator and viewer have, plus administration", () => {
    for (const p of ROLE_PERMISSIONS.operator) {
      expect(hasPermission("admin", p)).toBe(true);
    }
    expect(hasPermission("admin", "users.view")).toBe(true);
    expect(hasPermission("admin", "users.manage")).toBe(true);
    expect(hasPermission("admin", "roles.manage")).toBe(true);
    expect(hasPermission("admin", "ownership.manage")).toBe(true);
    expect(hasPermission("admin", "sites.manage")).toBe(true);
    expect(hasPermission("admin", "settings.manage")).toBe(true);
    expect(hasPermission("admin", "audit.view")).toBe(true);
  });

  it("permission sets strictly nest viewer ⊆ operator ⊆ admin", () => {
    expect(ROLE_PERMISSIONS.viewer.every((p) => ROLE_PERMISSIONS.operator.includes(p))).toBe(true);
    expect(ROLE_PERMISSIONS.operator.every((p) => ROLE_PERMISSIONS.admin.includes(p))).toBe(true);
  });
});
