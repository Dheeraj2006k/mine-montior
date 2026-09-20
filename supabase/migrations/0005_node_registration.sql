-- Node registration fields (PRD-2 §2 Step 3 / Phase B) — additive to the
-- existing `nodes` table (0001). Does not rename or remove
-- mock_latitude/mock_longitude/is_mock, which stay exactly as they are and
-- remain what the map and every existing label component reads.
--
-- Why separate columns instead of reusing mock_latitude/longitude for real
-- nodes: mock_latitude/longitude is documented (0001, comment on
-- nodes.is_mock) as "mock/assigned coordinates in this prototype cycle,
-- never real GNSS" and every caller renders MockPositionLabel next to it
-- unconditionally today. Real GNSS-registered coordinates are a distinct
-- fact (captured once, at install, via a registration device) and need
-- their own home so a real node can carry both "the point rendered on the
-- map" (mock_latitude/longitude, unchanged) and "the actual surveyed
-- position" (registered_latitude/longitude) without conflating the two.
--
-- NOT YET APPLIED to the live project - same constraint as 0003/0004 (no
-- direct DDL access in this build pass). Apply via the Supabase SQL editor
-- or `supabase db push` before /api/nodes registration endpoints will work.

alter table nodes
  add column if not exists registered_latitude  double precision,
  add column if not exists registered_longitude double precision,
  add column if not exists registered_at        timestamptz,
  add column if not exists baseline_reading_id   bigint references readings(id);

comment on column nodes.registered_latitude is
  'Real GNSS-registered coordinate, captured once via a registration device/app at install time (PRD-2 §2 Step 3) - not continuous per-node GNSS tracking. Null for nodes that have never been through registration (including every mock node).';
comment on column nodes.registered_at is
  'Registration timestamp. Distinct from installed_at (0001), which predates this flow and may be null for nodes seeded before registration existed.';
comment on column nodes.baseline_reading_id is
  'FK to the first valid readings row at or after registered_at - the PRD-2 "baseline sensor reading at t=0", auto-captured rather than entered by hand. Null until a qualifying reading has actually arrived.';

create index if not exists nodes_baseline_pending_idx on nodes (registered_at)
  where registered_at is not null and baseline_reading_id is null;
