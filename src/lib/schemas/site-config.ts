import { z } from "zod";

// PRD-2 §2 Step 2a — Longwall geometry.
export const longwallGeometrySchema = z.object({
  panel_boundary_note: z.string().min(1, "Describe the panel boundary or corner coordinates"),
  depth_m: z.number().positive(),
  extraction_thickness_m: z.number().positive(),
  extraction_method: z.string().min(1),
  status: z.enum(["completed", "active", "planned"]),
  // Only meaningful when status === "active" - the wizard enforces this,
  // the schema keeps them optional so "planned"/"completed" sites don't
  // need to fabricate values.
  face_direction: z.string().optional(),
  face_position_pct: z.number().min(0).max(100).optional(),
  expected_progression_rate: z.string().optional(),
});

// PRD-2 §2 Step 2b — Bord-and-pillar geometry.
export const bordAndPillarGeometrySchema = z.object({
  pillar_width_m: z.number().positive(),
  gallery_width_m: z.number().positive(),
  depth_m: z.number().positive(),
  seam_thickness_m: z.number().positive(),
});

export const geologySchema = z.object({
  rock_to_soil_ratio: z.number().nonnegative(),
  brittleness_index: z.number().min(0).max(1),
  rock_density: z.number().positive(),
});

export const miningStateSchema = z.object({
  extraction_pct: z.number().min(0).max(100),
  pillar_config_status: z.string().min(1),
  goaf_notes: z.string().optional().default(""),
});

export const dataSourcesSchema = z.object({
  insar_aoi_confirmed: z.boolean().default(false),
  earth_engine_connected: z.boolean().default(false),
  use_static_geology_fixture: z.boolean().default(true),
});

export const emergencyContactSchema = z.object({
  full_name: z.string().min(1),
  role: z.string().min(1),
  phone_e164: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  escalation_priority: z.number().int().positive(),
  channels: z.array(z.enum(["whatsapp", "sms", "email", "voice"])).min(1),
});

// One boolean per onboarding field the UI lets the user mark assumed/real.
// Keys are free-form (field names from geometry/geology/mining_state) so
// this does not need to change shape as new fields are added.
export const isAssumedMapSchema = z.record(z.string(), z.boolean());

export const siteConfigSchema = z.object({
  mine_type: z.enum(["longwall", "bord_and_pillar"]),
  site_name: z.string().min(1),
  aoi_latitude: z.number().min(-90).max(90),
  aoi_longitude: z.number().min(-180).max(180),
  geometry: z.union([longwallGeometrySchema, bordAndPillarGeometrySchema]),
  geology: geologySchema,
  mining_state: miningStateSchema,
  data_sources: dataSourcesSchema,
  is_assumed: isAssumedMapSchema,
  emergency_contacts: z.array(emergencyContactSchema).default([]),
});

export type SiteConfigPayload = z.infer<typeof siteConfigSchema>;
export type LongwallGeometry = z.infer<typeof longwallGeometrySchema>;
export type BordAndPillarGeometry = z.infer<typeof bordAndPillarGeometrySchema>;
