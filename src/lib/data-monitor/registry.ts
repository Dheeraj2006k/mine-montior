// Imported from src/lib/auth/permissions.ts, not src/lib/auth/roles.ts -
// this file must stay safely importable from client components
// (system/data/page.tsx), and roles.ts pulls in next/headers and the
// service-role client, which must never end up in a browser bundle.
// permissions.ts is the actual role/permission source of truth and has no
// server-only dependencies, so it's safe here without duplicating the type.
import type { AppRole } from "@/lib/auth/permissions";

// Single source of truth for the Data Monitor (Objective 2/Phase 2). Every
// table the explorer can show is listed here, explicitly - the API route
// refuses anything not in this allowlist, so there is no path from the
// browser to an arbitrary table or column name.
export type TableClassification = "OPERATIONAL" | "SAFE_INTERNAL" | "ADMIN_PII" | "SYSTEM";

export type FilterType = "eq" | "ilike" | "gte" | "lte";

export type FilterableColumn = {
  column: string;
  type: FilterType;
  label: string;
};

export type TableEntry = {
  key: string;
  displayName: string;
  classification: TableClassification;
  minRole: AppRole;
  columns: string[];
  primaryKey: string;
  timestampField: string | null;
  defaultOrderDesc: boolean;
  filterable: FilterableColumn[];
  description: string;
};

export const TABLE_REGISTRY: Record<string, TableEntry> = {
  nodes: {
    key: "nodes",
    displayName: "Nodes",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: [
      "node_id", "site_id", "label", "mock_latitude", "mock_longitude", "is_mock",
      "elevation_m", "installed_at", "is_active", "registered_latitude",
      "registered_longitude", "registered_at", "baseline_reading_id", "created_at", "updated_at",
    ],
    primaryKey: "node_id",
    timestampField: "updated_at",
    defaultOrderDesc: false,
    filterable: [
      { column: "node_id", type: "eq", label: "Node ID" },
      { column: "is_mock", type: "eq", label: "Mock only" },
      { column: "is_active", type: "eq", label: "Active only" },
    ],
    description: "Physical sensor nodes registered to this site.",
  },
  readings: {
    key: "readings",
    displayName: "Readings",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: [
      "id", "site_id", "node_id", "seq_num", "logging_mode",
      "tilt_x_filt", "tilt_y_filt", "vibration_filt", "displacement_filt", "risk_score",
      "sensor_ok", "low_battery", "comm_quality_low", "calibration_stale",
      "recorded_at", "received_at",
    ],
    primaryKey: "id",
    timestampField: "recorded_at",
    defaultOrderDesc: true,
    filterable: [{ column: "node_id", type: "eq", label: "Node ID" }],
    description: "Every sensor packet ingested via POST /api/ingest.",
  },
  cluster_events: {
    key: "cluster_events",
    displayName: "Cluster Events",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: ["id", "site_id", "triggering_node_id", "evidence_score", "escalate", "unknown", "reason", "recorded_at", "received_at"],
    primaryKey: "id",
    timestampField: "recorded_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "triggering_node_id", type: "eq", label: "Node ID" },
      { column: "escalate", type: "eq", label: "Escalated only" },
    ],
    description: "Escalation-candidate events from the gateway's evidence fusion.",
  },
  alerts: {
    key: "alerts",
    displayName: "Alerts",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: [
      "id", "site_id", "node_id", "severity", "source", "state", "evidence_score",
      "risk_score_snapshot", "reason", "summary", "correlation_key", "event_count",
      "first_event_at", "last_event_at", "blast_suspected", "created_at", "notified_at",
      "acknowledged_at", "acknowledged_channel", "resolved_at", "resolution_note",
    ],
    primaryKey: "id",
    timestampField: "created_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "severity", type: "eq", label: "Severity" },
      { column: "state", type: "eq", label: "State" },
      { column: "node_id", type: "eq", label: "Node ID" },
    ],
    description: "The managed alert incident lifecycle - severity, state, dedup, blast overlap.",
  },
  predictions: {
    key: "predictions",
    displayName: "Predictions",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: ["id", "site_id", "model_version", "predicted_zone", "trend", "time_to_threshold_low_days", "time_to_threshold_high_days", "confidence", "generated_at"],
    primaryKey: "id",
    timestampField: "generated_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "model_version", type: "eq", label: "Model version" },
      { column: "trend", type: "eq", label: "Trend" },
    ],
    description: "ML model output - written by the ML team's process or a live /predict call.",
  },
  insar_node_features: {
    key: "insar_node_features",
    displayName: "InSAR Node Features",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: ["id", "node_id", "mock_latitude", "mock_longitude", "insar_los_velocity_mm", "insar_coherence", "raster_date", "created_at"],
    primaryKey: "id",
    timestampField: "created_at",
    defaultOrderDesc: true,
    filterable: [{ column: "node_id", type: "eq", label: "Node ID" }],
    description: "Node-level InSAR features. Below-threshold coherence rows still show their real coherence value - the UI layer nulls the velocity, not this table.",
  },
  insar_grid_cells: {
    key: "insar_grid_cells",
    displayName: "InSAR Grid Cells",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: [
      "id", "site_id", "grid_id", "geometry_4326",
      "source_repository", "source_dataset", "imported_at", "created_at",
    ],
    primaryKey: "id",
    // Static geometry, written once at import (see migration 0007) - not a
    // live event stream, so "imported_at" (not "updated_at") is the
    // honest label for this table's one timestamp.
    timestampField: "imported_at",
    defaultOrderDesc: false,
    filterable: [
      { column: "site_id", type: "eq", label: "Site ID" },
      { column: "grid_id", type: "eq", label: "Grid ID" },
    ],
    description:
      "Static 80m x 80m production InSAR grid cell geometry (GeoJSON, EPSG:4326) - one row per grid_id, shared across all pairs. Not physical sensor nodes.",
  },
  insar_grid_observations: {
    key: "insar_grid_observations",
    displayName: "InSAR Grid Observations",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: [
      "id", "site_id", "grid_id", "pair",
      "reference_date", "secondary_date", "temporal_baseline_days",
      "los_displacement_m", "coherence",
      "incidence_angle_rad", "look_vector_phi_rad", "look_vector_theta_rad",
      "source_repository", "source_dataset", "imported_at", "created_at",
    ],
    primaryKey: "id",
    timestampField: "imported_at",
    defaultOrderDesc: false,
    filterable: [
      { column: "site_id", type: "eq", label: "Site ID" },
      { column: "grid_id", type: "eq", label: "Grid ID" },
      { column: "pair", type: "eq", label: "Pair" },
      { column: "reference_date", type: "eq", label: "Reference date" },
      { column: "secondary_date", type: "eq", label: "Secondary date" },
      // Single gte filter (existing filter types are one-column-to-one-
      // query-param, so a min/max pair on the same column isn't
      // representable without a second architecture) - "at least this
      // coherent" is the more common inspection question.
      { column: "coherence", type: "gte", label: "Min coherence" },
    ],
    description:
      "Pair-wise LOS displacement (metres) and coherence per grid cell per temporal pair. LOS is line-of-sight only, not vertical subsidence, and a single pair is not a validated velocity. NULL los_displacement_m is a genuinely missing measurement (39 of 9,546 rows) - never 0.",
  },
  blast_schedule: {
    key: "blast_schedule",
    displayName: "Blast Schedule",
    classification: "OPERATIONAL",
    minRole: "viewer",
    columns: ["id", "site_id", "panel_label", "planned_start", "planned_end", "entered_by", "note", "created_at"],
    primaryKey: "id",
    timestampField: "planned_start",
    defaultOrderDesc: true,
    filterable: [],
    description: "Planned blast windows, used to enrich (never suppress) alerts that overlap them.",
  },
  pipeline_trace: {
    key: "pipeline_trace",
    displayName: "Pipeline Trace",
    classification: "SYSTEM",
    minRole: "viewer",
    columns: ["id", "trace_id", "alert_id", "node_id", "stage", "status", "occurred_at", "latency_ms", "detail"],
    primaryKey: "id",
    timestampField: "occurred_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "stage", type: "eq", label: "Stage" },
      { column: "status", type: "eq", label: "Status" },
      { column: "trace_id", type: "eq", label: "Trace ID" },
      { column: "alert_id", type: "eq", label: "Alert ID" },
    ],
    description: "Every stage of every ingest/alert request, keyed by trace_id.",
  },
  alert_feedback: {
    key: "alert_feedback",
    displayName: "Alert Feedback",
    classification: "OPERATIONAL",
    minRole: "operator",
    columns: ["id", "alert_id", "responder_contact_id", "verdict", "source_channel", "notes", "created_at"],
    primaryKey: "id",
    timestampField: "created_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "alert_id", type: "eq", label: "Alert ID" },
      { column: "verdict", type: "eq", label: "Verdict" },
    ],
    description: "IVR/dashboard confirmations - the labelled-data mechanism for the ML team.",
  },
  site_config: {
    key: "site_config",
    displayName: "Site Config",
    classification: "SAFE_INTERNAL",
    minRole: "viewer",
    columns: ["site_id", "mine_type", "aoi_latitude", "aoi_longitude", "geometry", "geology", "mining_state", "data_sources", "is_assumed", "setup_completed", "setup_completed_at", "updated_at"],
    primaryKey: "site_id",
    timestampField: "updated_at",
    defaultOrderDesc: true,
    filterable: [],
    description: "Onboarding wizard output - mine type, geometry, geology, assumed/real flags.",
  },
  notifications: {
    key: "notifications",
    displayName: "Notifications",
    classification: "ADMIN_PII",
    minRole: "admin",
    columns: ["id", "alert_id", "contact_id", "channel", "provider", "provider_message_id", "status", "attempt", "error", "sent_at", "delivered_at", "created_at"],
    primaryKey: "id",
    timestampField: "created_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "channel", type: "eq", label: "Channel" },
      { column: "status", type: "eq", label: "Status" },
      { column: "alert_id", type: "eq", label: "Alert ID" },
    ],
    description: "Channel-level delivery log - separate from the managed alert object.",
  },
  contacts: {
    key: "contacts",
    displayName: "Contacts",
    classification: "ADMIN_PII",
    minRole: "admin",
    columns: ["id", "site_id", "full_name", "role", "phone_e164", "email", "escalation_priority", "channels", "is_active", "created_at"],
    primaryKey: "id",
    timestampField: "created_at",
    defaultOrderDesc: false,
    filterable: [{ column: "is_active", type: "eq", label: "Active only" }],
    description: "Escalation-chain contacts. Holds PII (phone/email) - admin only, matching /admin/contacts.",
  },
  profiles: {
    key: "profiles",
    displayName: "Users / Profiles",
    classification: "ADMIN_PII",
    minRole: "admin",
    columns: ["user_id", "role", "status", "assigned_site_id", "full_name", "created_at", "updated_at"],
    primaryKey: "user_id",
    timestampField: "updated_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "role", type: "eq", label: "Role" },
      { column: "status", type: "eq", label: "Status" },
    ],
    description: "Application role assignments (viewer/operator/admin), account status, and site assignment. No auth credentials of any kind live here or are ever returned.",
  },
  audit_log: {
    key: "audit_log",
    displayName: "Audit Log",
    classification: "SYSTEM",
    minRole: "admin",
    columns: [
      "id", "actor", "actor_user_id", "action", "entity_table", "entity_id",
      "target_user_id", "from_state", "to_state", "channel", "detail", "occurred_at",
    ],
    primaryKey: "id",
    timestampField: "occurred_at",
    defaultOrderDesc: true,
    filterable: [
      { column: "entity_table", type: "eq", label: "Table" },
      { column: "action", type: "eq", label: "Action" },
    ],
    description: "Who changed what alert/entity/admin-RBAC state, when - actor_user_id/target_user_id (migration 0009) let RBAC actions be traced to real users.",
  },
};

export const TABLE_KEYS = Object.keys(TABLE_REGISTRY);

export function getTableEntry(key: string): TableEntry | null {
  return Object.prototype.hasOwnProperty.call(TABLE_REGISTRY, key) ? TABLE_REGISTRY[key] : null;
}
