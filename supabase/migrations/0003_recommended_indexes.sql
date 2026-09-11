-- RECOMMENDED, NOT YET APPLIED TO THE LIVE PROJECT.
--
-- I (Claude) cannot execute DDL against the live Supabase project from this
-- environment — there is no Supabase CLI installed and no direct Postgres
-- connection string in .env.local, only the REST URL + anon/service-role keys.
-- This file is safe to run yourself in the Supabase SQL editor if you want
-- these applied; it changes nothing until you do.
--
-- Status of each item below:

-- 1. CONFIRMED ALREADY LIVE — do not re-run, listed here only for documentation
--    completeness in 0001. Verified by live-testing POST /api/ingest twice with
--    the same (node_id, seq_num): the second call hit Postgres error 23505 and
--    the route's duplicate-handling path fired correctly.
--    constraint readings_node_seq_unique unique (node_id, seq_num)  -- already in 0001

-- 2. NOT VERIFIED LIVE — the `alerts` table currently has 0 rows, so this could
--    not be tested non-destructively without inserting synthetic alert data.
--    This is the plan's core anti-duplicate-notification guarantee (§5.6) —
--    recommend applying it before Phase 5 (alert engine) is built.
create unique index if not exists alerts_open_correlation_idx
  on alerts (correlation_key) where state in ('new', 'notified');

-- 3. Minor safety constraints present in the plan doc but not confirmed via
--    OpenAPI introspection (introspection shows column types/nullability, not
--    check constraints). Safe to add regardless since they only reject values
--    that should never legitimately occur.
alter table predictions
  add constraint predictions_confidence_range
  check (confidence is null or (confidence >= 0 and confidence <= 1));

alter table alerts
  add constraint alerts_evidence_score_range
  check (evidence_score is null or (evidence_score >= 0 and evidence_score <= 1));
