# Alert / notification contract

Status: **implemented, live-tested** (RBAC-gated mutations verified live
against the production Supabase project). Describes the actual alert
lifecycle, escalation, and audit behavior as implemented in
`src/lib/domain/alert-orchestrator.ts`, `src/lib/domain/notification-engine.ts`,
`src/lib/domain/suppression.ts`, and the `/api/alerts/*` routes.

## Alert states

`alerts.state` (Postgres enum `alert_state`, migration 0001):

```
new → notified → acknowledged → resolved
                              ↘ dismissed
```

| State | Set by | Meaning |
|---|---|---|
| `new` | alert engine, on creation | not yet notified to any contact |
| `notified` | `notification-engine.ts` `markNotified()`, once dispatch begins | contacts have been (or are being) notified; escalation ladder is running |
| `acknowledged` | `POST /api/alerts/:id/acknowledge` (operator+), or IVR digit 1/2 | a human confirmed the alert — halts the escalation ladder |
| `resolved` | `POST /api/alerts/:id/resolve` (operator+) | incident closed with a resolution note |
| `dismissed` | `POST /api/alerts/:id/dismiss` (operator+) | closes **this alert instance only** — has no effect on ingestion or the alert engine's ability to open a new alert for the same node/severity on the next escalation. No human action in this system has permanent veto power over future detection. |

Alerts also carry `severity` (`info | warning | high | critical`) and
`source` (`cluster_event | prediction | manual | system_health`) —
opaque labels this document doesn't redefine; see migration 0001 for the
enum values.

## Acknowledgement — server-side authorization

All three state-changing endpoints require the `operator` role floor
(`requireRole("operator")` / `requirePermission("alerts.acknowledge")`),
enforced server-side and live-verified against the production RBAC
matrix (401 anonymous, 403 viewer, 200 operator/admin):

- `POST /api/alerts/:id/acknowledge` — body: `{ channel?: string, note?: string }`. Sets `state=acknowledged`, `acknowledged_at`, `acknowledged_channel` (defaults `"dashboard"` if omitted).
- `POST /api/alerts/:id/resolve` — body: `{ resolution_note?: string }`. Sets `state=resolved`, `resolved_at`, `resolution_note`.
- `POST /api/alerts/:id/dismiss` — body: `{ reason?: string }`. Sets `state=dismissed`.

Every one of these writes an `audit_log` row: `actor` (role + actor
email, e.g. `"operator:mine@gmail.com"`), `actor_user_id`,
`entity_table: "alerts"`, `entity_id`, `from_state`/`to_state`, and a
`detail` object carrying the request body's free-text fields (note/
reason/resolution_note). This is a hard requirement of the current
implementation, not optional — every mutation route writes this row
before returning.

## Escalation ladder

Runs once per alert, started by `dispatchNotifications()` (invoked from
the alert-orchestrator when a `cluster_event` with `escalate: true`
creates or matches an alert):

| Step | Delay | Channel | Recipient |
|---|---|---|---|
| 1 | t+0s | email | **every** active contact with `channels` including `"email"` |
| 2 | t+30s | SMS | the contact with `escalation_priority = 1` (or the first active contact if none has priority 1) |
| 3 | t+60s | voice call | same priority-1 contact |
| 4 | t+150s | voice call | the contact with `escalation_priority = 2`, if any |
| 5 | t+240s | voice call | the contact with `escalation_priority = 3`, if any |

Every step checks `alertIsOpen()` (state is still `new` or `notified`)
immediately before firing — an acknowledgement (digit 1/2, or the
dashboard button) at any point stops all later steps. **Known limitation,
documented in the code itself**: these delays are plain `setTimeout` in
the same Node process handling the originating HTTP request — correct for
a long-lived `next start`/`next dev` process, but this does **not**
survive a serverless redeploy or cold start, and Vercel's serverless
function model does not guarantee the process stays alive long enough for
the later steps (up to 240s) to fire. A production deployment needs a
durable scheduler (Vercel Cron + a queue table, or a service like QStash)
driving these steps instead of in-process timers.

## Channels

| Channel | Adapter | Demo-mode trigger |
|---|---|---|
| email | `src/lib/adapters/email-adapter.ts` (Resend) | `DEMO_MODE=true` OR `RESEND_API_KEY` unset |
| SMS | `src/lib/adapters/sms-adapter.ts` (Twilio) | `DEMO_MODE=true` OR any of `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` unset |
| voice | `src/lib/adapters/voice-adapter.ts` (Twilio) | `DEMO_MODE=true` OR any of the three Twilio vars OR `PUBLIC_BASE_URL` unset |

In demo mode, each adapter logs the intended send and returns
`{ ok: true, demo: true, providerMessageId: "demo-<timestamp>" }` — the
exact same `notifications` table row gets written either way
(`provider: "demo"` vs. the real provider name), so the notification log
(`/admin/notifications`, admin-only) looks identical in shape regardless
of whether a real message was sent.

## IVR digit semantics

`DIGIT_TO_VERDICT` (`src/lib/domain/notification-engine.ts`) is the
**only** definition of what a DTMF digit means — shared identically by
the real Twilio webhook (`/api/voice/dtmf/[alertId]/[contactId]`) and the
demo-mode "Simulate IVR response" dashboard button
(`/api/alerts/:id/simulate-feedback`, which refuses to run at all once
real Twilio credentials are configured — see below):

| Digit | Verdict | Effect |
|---|---|---|
| 1 | `real_event` | records `alert_feedback`; **moves `alert.state` to `acknowledged`**, halting the escalation ladder |
| 2 | `blast_or_disturbance` | records `alert_feedback`; **moves `alert.state` to `acknowledged`**; also feeds `suppression.ts` — future notifications (not ingestion/alerting) for the same `node_id` + `severity` are suppressed for 30 minutes from this response |
| 3 | `uncertain` | records `alert_feedback`; **does NOT halt the ladder** — deliberately leaves `state` at `notified` so later escalation steps still fire, since an uncertain response isn't a confirmation |
| 9 | *(none)* | accepted by the simulate-feedback endpoint's input validation (`["1","2","3","9"]`) but has **no defined verdict or effect** — `DIGIT_TO_VERDICT["9"]` is undefined, so the response is silently a no-op. Likely reserved/placeholder; needs a product decision (see Open Questions) rather than an invented meaning. |
| any other digit | *(none)* | same no-op behavior as digit 9 |

`call_sessions.dtmf_digit`/`outcome` are always updated regardless of
which digit (or lack of a mapped verdict) was received, so the raw
response is preserved even when no verdict was recorded.

**`simulate-feedback` is demo-only by construction**: it checks
`isVoiceDemoMode()` first and returns `403 DEMO_MODE_DISABLED` for
**every** role, including admin, the moment real Twilio credentials
(`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER`/
`PUBLIC_BASE_URL`) are all set — confirmed live against this project's
actual `.env.local` (real Twilio credentials are configured, so this
endpoint currently returns 403 for all four roles in the live RBAC
matrix). This is intentional: it can never be used to fake a response
once the system is handling real calls.

## Suppression — notifications only, never ingestion/analysis

`computeSuppression()` (`src/lib/domain/suppression.ts`) is consulted
**only** by `dispatchNotifications()`, at query time, immediately before
sending. It has no effect on:
- whether a `cluster_event`/reading is stored,
- whether the alert engine creates or escalates an alert,
- whether the alert is visible on the dashboard.

A suppressed alert still reaches `state: notified` internally
(`markNotified()` still runs) — the dashboard-visibility notification
always happens; only the human-interrupting channels (email/SMS/voice)
are skipped, and skipping is itself recorded as a `pipeline_trace` row
(`stage: "NOTIFY_EMAIL", status: "skipped", detail: { reason:
"suppressed", until: ... }`), never silent.

Suppression window: 30 minutes from the most recent `blast_or_disturbance`
verdict for the same `(node_id, severity)` pair. There is no dedicated
suppression table — state is reconstructed from `alert_feedback` history
on every check.

## Audit requirements — summary

Every mutating alert action (acknowledge/resolve/dismiss) and every
admin RBAC action (role change, activation, ownership transfer) writes an
`audit_log` row with `actor`/`actor_user_id`, `entity_table`/`entity_id`,
`from_state`/`to_state`, and a `detail` payload. This is enforced by code
at every call site, not by a database trigger — a new mutation route that
skips writing this row is a defect, not a variant.

## Open questions for the notifications/hardware-adjacent teams

1. **Digit 9** — confirm intended meaning (or confirm it's unused/
   reserved and should be removed from the accepted-input list rather than
   silently accepted and ignored).
2. **Escalation ladder durability** — who owns building the durable
   scheduler replacement for the current in-process `setTimeout` chain
   before this goes to a real serverless production deployment? (See
   `notification-engine.ts`'s own header comment — this is a known,
   flagged gap, not new information.)
3. **Suppression window (30 min)** — the code comments this as "admin-
   configurable per plan," but no admin UI or config field currently
   exists to change it; it's a hardcoded constant
   (`SUPPRESSION_WINDOW_MS`). Confirm whether that configurability is
   still wanted, and if so, where it should live (per-site setting?
   global env var?).
4. **`escalation_priority` beyond 1/2/3** — the ladder only ever reads
   priorities 1, 2, and 3. Confirm whether a 4th+ priority tier is needed,
   or whether 3 tiers is the permanent design.
