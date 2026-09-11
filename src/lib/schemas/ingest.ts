import { z } from "zod";

const tiltSchema = z.object({
  x_raw: z.number(),
  y_raw: z.number(),
  x_filt: z.number(),
  y_filt: z.number(),
  unit: z.string().min(1),
});

const vibrationSchema = z.object({
  raw: z.number(),
  filt: z.number(),
  unit: z.string().min(1),
});

const displacementSchema = z.object({
  raw: z.number(),
  filt: z.number(),
  unit: z.string().min(1),
});

const nodeStatusSchema = z.object({
  sensor_ok: z.boolean(),
  low_battery: z.boolean(),
  self_test_fail: z.boolean(),
  comm_quality_low: z.boolean(),
  calibration_stale: z.boolean(),
});

export const readingSchema = z.object({
  type: z.literal("reading"),

  schema_version: z.number().int().positive(),

  site_id: z.string().min(1),

  node_id: z.number().int(),

  hop_count: z.number().int().nonnegative(),

  seq_num: z.number().int().nonnegative(),

  timestamp: z.string().datetime({ offset: true }),

  logging_mode: z.enum(["baseline", "event"]),

  tilt: tiltSchema,

  vibration: vibrationSchema,

  displacement: displacementSchema,

  risk_score: z.number().min(0).max(1),

  node_status: nodeStatusSchema,
});

export const clusterEventSchema = z.object({
  type: z.literal("cluster_event"),

  schema_version: z.number().int().positive(),

  site_id: z.string().min(1),

  timestamp: z.string().datetime({ offset: true }),

  triggering_node_id: z.number().int(),

  evidence_score: z.number().min(0).max(1),

  escalate: z.boolean(),

  unknown: z.boolean(),

  reason: z.enum([
    "strong_single_signal",
    "combined_evidence",
    "sensor_health_unknown",
  ]),
});

export const ingestSchema = z.discriminatedUnion("type", [
  readingSchema,
  clusterEventSchema,
]);

export type IngestPayload = z.infer<typeof ingestSchema>;