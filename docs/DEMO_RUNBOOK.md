# Demo runbook

Adapted from the implementation plan §20. The scenario library and dashboard exist and are live-verified; the rehearsal itself (running this end-to-end 10×, including with the network deliberately killed) is something you need to actually do — it can't be done from here.

## T-24h
- Manual DB snapshot (Supabase dashboard → Database → Backups, or `pg_dump` if you have the connection string).
- If using real Twilio/Resend: verify all phone numbers with the provider now (Twilio trial accounts only call pre-verified numbers), confirm `PUBLIC_BASE_URL` is a real reachable HTTPS URL (ngrok or your deployed URL) so the TwiML/DTMF webhooks work.
- Charge everything. Test on the actual demo laptop, on the hotspot you'll actually use.

## T-1h
- Mobile hotspot up — **not venue WiFi** (PRD §7: captive-portal WiFi silently breaks the gateway).
- Reset state if you want a clean run: `npm run simulate:reset` (clears readings/alerts/notifications/etc., keeps seeded sites/nodes/contacts). **This is destructive — only run it deliberately.**
- Open the dashboard (`/`), confirm the node map renders and node health is accurate.

## T-0 — the actual flow
1. Command Center (`/`): all normal, 2 nodes online, 0 active alerts.
2. Trigger a scenario (or live hardware if it's behaving):
   - `npm run simulate -- --scenario high-risk` — accelerating readings then an escalating `cluster_event`.
3. Watch Node_02 escalate on the dashboard — the alert appears in the active-alerts panel without a manual refresh (polling, ≤5s).
4. Open the alert (`/alerts/:id`) → pipeline timeline shows `CLOUD_INGEST → VALIDATION → PERSIST → ALERT_EVAL → ALERT_CREATED → NOTIFY_DASHBOARD → NOTIFY_EMAIL`, each with real latencies.
5. Switch to the Digital Twin (`/twin`) → drag the time scrubber; if a real prediction exists the terrain visibly deforms near the escalated node. (With no ML service connected, this is honestly flat — say so.)
6. Toggle back, open `/nodes/:id` for Node_02 → real tilt/vibration/displacement/risk charts.
7. On the alert page, use "Simulate IVR response" → press 1 → dashboard shows CONFIRMED REAL, alert moves to acknowledged. (With real Twilio configured, a phone actually rings instead.)
8. Show total detection time: the pipeline timeline's stage timestamps, sensor → human confirmation.
9. Blast scenario: `npm run simulate -- --scenario blast` — spike, blast window overlap, `blast_suspected: true` shown on the alert, severity unchanged.
10. Sensor-failure scenario: `npm run simulate -- --scenario sensor-failure` — node goes grey/UNKNOWN on `/nodes`, not green; the alert still fires (`unknown` is never suppressed).

## Fallback
Network dies → nothing here needs the internet except Supabase itself and (if configured) real Resend/Twilio calls. With `DEMO_MODE` (auto-on when no provider credentials are set), notifications/voice keep working locally with simulated sends — say so out loud if it comes up. A dead Supabase connection is not currently covered by a local fallback; if that's a real risk for your venue, that's the next thing to build, not something already handled.

## What's genuinely NOT rehearsal-ready yet
- No auth/role gating — every admin page is reachable by anyone with the URL. Fine for a controlled demo, not for anything public.
- Real voice/SMS/email requires you to add provider credentials and test them yourself (this pass verified the demo-mode code path, not a real phone ringing).
- No accessibility/colour-blind/projector-legibility pass has been done — do this visually yourself before the actual day.
