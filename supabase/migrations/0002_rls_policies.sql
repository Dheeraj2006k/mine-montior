-- RLS policies — documents the live security posture, verified read-only against
-- the running project: anon key returns 0 rows on SELECT for every one of the 14
-- tables (default-deny — RLS enabled, no anon SELECT policy exists), and anon CAN
-- INSERT into `readings` (matching the PRD's direct-to-Supabase fallback design;
-- verified live and the probe row was deleted afterward). anon INSERT on
-- `cluster_events` was NOT independently tested this pass — verify before relying
-- on it if the direct-ingest fallback path is ever used for cluster_events.
--
-- `authenticated`-role policies below are asserted from the implementation plan
-- (§5.10) and are NOT yet exercised live, since this build pass ships no auth.
-- Confirm/adjust once Supabase Auth + roles are added.

alter table sites                enable row level security;
alter table nodes                enable row level security;
alter table readings             enable row level security;
alter table cluster_events       enable row level security;
alter table insar_node_features  enable row level security;
alter table predictions          enable row level security;
alter table alerts               enable row level security;
alter table contacts             enable row level security;
alter table notifications        enable row level security;
alter table call_sessions        enable row level security;
alter table alert_feedback       enable row level security;
alter table blast_schedule       enable row level security;
alter table pipeline_trace       enable row level security;
alter table audit_log            enable row level security;

-- Gateway direct-ingest fallback (ADR-001 fallback path): anon may INSERT
-- into readings/cluster_events, never SELECT/UPDATE/DELETE.
create policy anon_insert_readings on readings
  for insert to anon with check (true);
create policy anon_insert_cluster_events on cluster_events
  for insert to anon with check (true);

-- authenticated (operator/viewer) read access — asserted from plan §5.10,
-- not yet exercised since this pass ships no Supabase Auth integration.
create policy authenticated_select_sites on sites
  for select to authenticated using (true);
create policy authenticated_select_nodes on nodes
  for select to authenticated using (true);
create policy authenticated_select_readings on readings
  for select to authenticated using (true);
create policy authenticated_select_cluster_events on cluster_events
  for select to authenticated using (true);
create policy authenticated_select_insar on insar_node_features
  for select to authenticated using (true);
create policy authenticated_select_predictions on predictions
  for select to authenticated using (true);
create policy authenticated_select_alerts on alerts
  for select to authenticated using (true);
create policy authenticated_select_pipeline_trace on pipeline_trace
  for select to authenticated using (true);
create policy authenticated_select_blast_schedule on blast_schedule
  for select to authenticated using (true);
-- contacts/notifications/call_sessions hold PII — restrict to admin role once
-- a `profiles` table + role claim exists (plan §13.2). No policy added here yet,
-- which means these three stay fully inaccessible to anon AND authenticated
-- until that role system is built — matches "treat it like a password table."

-- service_role bypasses RLS entirely by default in Supabase; no explicit
-- policy needed for the server-side supabaseAdmin client used by API routes.
