# Hardware ingest contract — `POST /api/ingest`

Status: **implemented, live-tested**. This document describes the contract
as the code actually enforces it today (`src/lib/schemas/ingest.ts`,
`src/app/api/ingest/route.ts`) — it is not aspirational.

## Endpoint

```
POST /api/ingest
Content-Type: application/json
x-gateway-key: <GATEWAY_SHARED_SECRET>
```

Optional request header `x-trace-id` — if the gateway sets one, it is
echoed back and used for every `pipeline_trace` row this request produces;
otherwise the server generates one. The response always carries
`x-trace-id`.

## Authentication

A single shared secret, compared exactly against `process.env
.GATEWAY_SHARED_SECRET`. No per-device credential exists yet — every
gateway on a site shares one secret. Missing or mismatched header →
`401 UNAUTHORIZED` before the body is even parsed.

**This is not per-device authentication.** If the hardware team needs to
distinguish individual gateways/devices at the network layer (e.g. to
revoke one compromised device without rotating the secret for the whole
site), that is a real gap — see Open Questions.

## Payload: two message types, one endpoint

The body is validated with `zod` against a discriminated union on `type`.
Anything that doesn't match is rejected with `400 VALIDATION_FAILED` and a
field-by-field issue list — the gateway should treat that as a hard
schema-mismatch bug, not something to retry unchanged.

### `type: "reading"`

```jsonc
{
  "type": "reading",
  "schema_version": 1,              // int, positive
  "site_id": "SIH-DEMO-01",         // string, non-empty
  "node_id": 3,                     // int
  "hop_count": 0,                   // int, >= 0 (mesh hop count to gateway)
  "seq_num": 4821,                  // int, >= 0 — see Idempotency below
  "timestamp": "2026-09-22T13:00:00Z", // ISO 8601, timezone offset REQUIRED
  "logging_mode": "baseline",       // "baseline" | "event" — no third value
  "tilt": {
    "x_raw": 0.12, "y_raw": -0.04,
    "x_filt": 0.10, "y_filt": -0.03,
    "unit": "deg"                   // any non-empty string accepted — see units note
  },
  "vibration": {
    "raw": 0.03, "filt": 0.02,
    "unit": "TBD"                   // see Open Questions — literal string "TBD", not a guess
  },
  "displacement": {
    "raw": 1.02, "filt": 1.00,
    "unit": "mm"
  },
  "risk_score": 0.15,               // number, 0.0–1.0 inclusive — computed ON-DEVICE/gateway, not by this API
  "node_status": {
    "sensor_ok": true,
    "low_battery": false,
    "self_test_fail": false,
    "comm_quality_low": false,
    "calibration_stale": false
  }
}
```

Column mapping (payload field → `readings` table column) is 1:1 and exact
— see `src/app/api/ingest/route.ts`'s insert. `tilt.x_raw` → `tilt_x_raw`,
`node_status.sensor_ok` → `sensor_ok`, `timestamp` → `recorded_at`, etc.
`received_at` (server receive time) and `created_at` are stamped by the
database, not sent by the gateway.

### `type: "cluster_event"`

```jsonc
{
  "type": "cluster_event",
  "schema_version": 1,
  "site_id": "SIH-DEMO-01",
  "timestamp": "2026-09-22T13:00:05Z",
  "triggering_node_id": 3,
  "evidence_score": 0.72,           // number, 0.0–1.0
  "escalate": true,                 // boolean — see below
  "unknown": false,                 // true = sensor health prevented a confident read; never implies "safe"
  "reason": "strong_single_signal"  // one of exactly: strong_single_signal | combined_evidence | sensor_health_unknown
}
```

`escalate: true` on a `cluster_event` synchronously triggers the alert
engine (`evaluateClusterEvent`) as an in-process function call — not a
separate endpoint, not a queue. The response's `alert_id` field is the
result (`null` if no alert was created/matched).

`unknown: true` must never be treated as "no risk" by any downstream
consumer — the UI/alert engine treat it as a distinct state from both
normal and elevated risk.

### Units

`tilt.unit`, `vibration.unit`, `displacement.unit` are free-text strings
the schema does not validate beyond non-empty — **the application does not
know or assume real-world units for any of these fields.** `vibration.unit`
is currently sent as the literal string `"TBD"` everywhere in this codebase
(simulator and UI alike) — see `docs/decisions/ADR-003-vibration-unit.md`.
Do not tune any threshold against `vibration_raw`/`vibration_filt` until
the hardware team answers what that field actually measures.

### `risk_score`

Computed **upstream** (device or gateway), not by this API — `/api/ingest`
only validates it's in `[0, 1]` and stores it verbatim in
`readings.risk_score`. This app does not recompute it from tilt/vibration/
displacement.

## Idempotency / duplicate behavior

`readings` has a unique constraint on `(node_id, seq_num)`. On a duplicate
insert (Postgres error `23505`), the server does **not** fail the request —
it looks up the existing row and returns it with `duplicate: true` and
HTTP `200` (a fresh insert returns `202` with `duplicate: false`). This
means the gateway can safely retry a reading it isn't sure was received;
retries are idempotent **as long as `seq_num` is stable per retry of the
same physical reading.**

`cluster_event` has no unique/idempotency constraint — a retried
`cluster_event` POST will insert a second row and, if `escalate: true`,
can trigger the alert engine a second time. **The gateway must not retry a
`cluster_event` it isn't certain failed to persist.**

## `sensor_ok` and the other `node_status` flags

Five independent booleans, each stored verbatim as its own `readings`
column (`sensor_ok`, `low_battery`, `self_test_fail`, `comm_quality_low`,
`calibration_stale`). None of them are derived or cross-validated against
each other or against `tilt`/`vibration`/`displacement` by this API — the
device/gateway is the sole source of truth for what each one means. Node
health state shown in the UI (`src/lib/domain/node-health.ts`) is computed
from recency + these flags across a recent reading window — see that file
if the hardware team needs the exact derivation.

## Mock vs. real node semantics

`nodes.is_mock` (set at node registration, `POST /api/nodes`, operator+
only — see `docs/ARCHITECTURE.md`) marks whether a node's position is a
real GNSS-registered coordinate or an illustrative placeholder. **This flag
is about the node's *position*, not about whether its readings are real.**
A node registered as `source: "real"` still has its readings validated and
stored exactly like a mock node's — there is no separate schema or ingest
path for "real" hardware. The UI is responsible for rendering the
mock/real distinction (`MockPositionLabel`); `/api/ingest` itself does not
care.

## Errors

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHORIZED` | missing/wrong `x-gateway-key` |
| 400 | `VALIDATION_FAILED` | payload doesn't match either schema variant — `details` lists every field issue |
| 400 | `UNSUPPORTED_TYPE` | valid JSON, but `type` isn't `"reading"` or `"cluster_event"` |
| 500 | `DATABASE_ERROR` | insert failed for a reason other than the handled duplicate case |
| 500 | `INTERNAL_ERROR` | anything else unhandled |

Every response carries `x-trace-id`; every stage of processing
(`CLOUD_INGEST` → `VALIDATION` → `PERSIST`) writes a `pipeline_trace` row
under that trace id, visible via `/system/data` (Data Monitor) or
`GET /api/pipeline/[alertId]` for alert-linked traces.

## Direct-to-Supabase fallback (documented, currently non-functional)

`docs/decisions/ADR-001-ingest-path.md` documents a fallback: the anon key
was intended to be able to `INSERT` directly into `readings`/
`cluster_events`, bypassing this API, if a gateway can't adopt HTTP. As of
the most recent live audit, **row-level security on `readings` denies
anon inserts** (confirmed live: `42501` RLS violation) — this fallback is
currently not usable as documented. No code in this repository depends on
it (the simulator and every other caller use `/api/ingest`), so this is
flagged as a known gap, not something silently broken for a real user.

## Open questions for the hardware team

1. **`vibration.unit`** — RMS over what window? Peak amplitude? Raw ADC
   counts? (ADR-003, unresolved.)
2. **Per-device authentication** — is a single site-wide shared secret
   acceptable, or does the fleet need per-gateway credentials/rotation?
3. **`hop_count`** — confirm this is mesh-network hop count to the
   gateway, not something else; not currently used by any threshold logic,
   only stored.
4. **`seq_num` scope and reset behavior** — confirmed per-node monotonic?
   What happens on device reboot — does it reset to 0 (which would collide
   with old rows for that node) or persist/resume?
5. **`risk_score` computation** — confirm this is computed on-device or on
   the gateway, and get the formula/model documented somewhere durable (it
   is currently opaque to this codebase — stored, never derived).
6. **Direct-to-Supabase fallback** — is it still needed? If yes, the RLS
   policy gap above needs a deliberate fix (not a silent one); if no,
   ADR-001 should be updated to retire it explicitly.
