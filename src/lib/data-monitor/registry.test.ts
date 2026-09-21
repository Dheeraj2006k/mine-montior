import { describe, it, expect } from "vitest";
import { TABLE_REGISTRY, TABLE_KEYS, getTableEntry } from "./registry";

describe("data monitor table registry", () => {
  it("returns null for an unknown table key - the allowlist boundary", () => {
    expect(getTableEntry("service_role_secrets")).toBeNull();
    expect(getTableEntry("../../etc/passwd")).toBeNull();
    expect(getTableEntry("")).toBeNull();
  });

  it("returns the real entry for every registered key", () => {
    for (const key of TABLE_KEYS) {
      const entry = getTableEntry(key);
      expect(entry).not.toBeNull();
      expect(entry?.key).toBe(key);
    }
  });

  it("every table's primary key is included in its own column allowlist", () => {
    for (const entry of Object.values(TABLE_REGISTRY)) {
      expect(entry.columns).toContain(entry.primaryKey);
    }
  });

  it("every table's timestamp field, if present, is included in its column allowlist", () => {
    for (const entry of Object.values(TABLE_REGISTRY)) {
      if (entry.timestampField) {
        expect(entry.columns).toContain(entry.timestampField);
      }
    }
  });

  it("every filterable column is included in the column allowlist", () => {
    for (const entry of Object.values(TABLE_REGISTRY)) {
      for (const f of entry.filterable) {
        expect(entry.columns).toContain(f.column);
      }
    }
  });

  it("PII-bearing tables (contacts, notifications, profiles, audit_log) require admin", () => {
    expect(TABLE_REGISTRY.contacts.minRole).toBe("admin");
    expect(TABLE_REGISTRY.notifications.minRole).toBe("admin");
    expect(TABLE_REGISTRY.profiles.minRole).toBe("admin");
    expect(TABLE_REGISTRY.audit_log.minRole).toBe("admin");
  });

  it("operational tables (nodes, readings, alerts, predictions) are viewer-readable", () => {
    expect(TABLE_REGISTRY.nodes.minRole).toBe("viewer");
    expect(TABLE_REGISTRY.readings.minRole).toBe("viewer");
    expect(TABLE_REGISTRY.alerts.minRole).toBe("viewer");
    expect(TABLE_REGISTRY.predictions.minRole).toBe("viewer");
  });

  it("no table column list includes credential/secret-shaped names", () => {
    const suspicious = /password|secret|service_role|token|api_key/i;
    for (const entry of Object.values(TABLE_REGISTRY)) {
      for (const col of entry.columns) {
        expect(col).not.toMatch(suspicious);
      }
    }
  });

  describe("InSAR grid tables (Phase 9)", () => {
    it("registers insar_grid_cells with the real migration 0007 columns, unmodified", () => {
      const entry = TABLE_REGISTRY.insar_grid_cells;
      expect(entry).toBeDefined();
      expect(entry.columns).toEqual([
        "id", "site_id", "grid_id", "geometry_4326",
        "source_repository", "source_dataset", "imported_at", "created_at",
      ]);
      expect(entry.primaryKey).toBe("id");
    });

    it("registers insar_grid_observations with the real migration 0007 columns, unmodified", () => {
      const entry = TABLE_REGISTRY.insar_grid_observations;
      expect(entry).toBeDefined();
      expect(entry.columns).toEqual([
        "id", "site_id", "grid_id", "pair",
        "reference_date", "secondary_date", "temporal_baseline_days",
        "los_displacement_m", "coherence",
        "incidence_angle_rad", "look_vector_phi_rad", "look_vector_theta_rad",
        "source_repository", "source_dataset", "imported_at", "created_at",
      ]);
      expect(entry.primaryKey).toBe("id");
    });

    it("uses the existing viewer role, not a newly invented role", () => {
      expect(TABLE_REGISTRY.insar_grid_cells.minRole).toBe("viewer");
      expect(TABLE_REGISTRY.insar_grid_observations.minRole).toBe("viewer");
      const validRoles = ["viewer", "operator", "admin"];
      expect(validRoles).toContain(TABLE_REGISTRY.insar_grid_cells.minRole);
      expect(validRoles).toContain(TABLE_REGISTRY.insar_grid_observations.minRole);
    });

    it("does not expose a derived risk, velocity, or subsidence column", () => {
      const forbidden = /risk|velocity|subsidence/i;
      for (const key of ["insar_grid_cells", "insar_grid_observations"] as const) {
        for (const col of TABLE_REGISTRY[key].columns) {
          expect(col).not.toMatch(forbidden);
        }
      }
    });

    it("filters grid observations by pair, grid_id, site_id, dates, and a single coherence threshold", () => {
      const filterCols = TABLE_REGISTRY.insar_grid_observations.filterable.map((f) => f.column);
      expect(filterCols).toEqual(
        expect.arrayContaining(["site_id", "grid_id", "pair", "reference_date", "secondary_date", "coherence"]),
      );
      const coherenceFilter = TABLE_REGISTRY.insar_grid_observations.filterable.find((f) => f.column === "coherence");
      expect(coherenceFilter?.type).toBe("gte");
    });

    it("filters grid cells by site_id and grid_id", () => {
      const filterCols = TABLE_REGISTRY.insar_grid_cells.filterable.map((f) => f.column);
      expect(filterCols).toEqual(expect.arrayContaining(["site_id", "grid_id"]));
    });

    it("both tables are classified OPERATIONAL, matching insar_node_features", () => {
      expect(TABLE_REGISTRY.insar_grid_cells.classification).toBe("OPERATIONAL");
      expect(TABLE_REGISTRY.insar_grid_observations.classification).toBe("OPERATIONAL");
    });

    it("both tables expose grid_id, so observations can be traced back to their cell", () => {
      expect(TABLE_REGISTRY.insar_grid_cells.columns).toContain("grid_id");
      expect(TABLE_REGISTRY.insar_grid_observations.columns).toContain("grid_id");
    });
  });
});
