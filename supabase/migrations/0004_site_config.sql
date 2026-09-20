-- Setup/Onboarding schema (PRD-2 §2) — additive, does not touch the 14
-- tables documented in 0001. One row per site, written by the /setup wizard
-- and read by the dashboard for mine-type-aware rendering (twin mode,
-- geometry overlays, etc).
--
-- NOT YET APPLIED to the live project as of this migration file being
-- written — this build pass had no direct DDL access to the Supabase
-- Postgres instance (same constraint noted in 0003). Apply via the Supabase
-- SQL editor or `supabase db push` before the /setup wizard or
-- /api/site-config route will work against real data.

create type mine_type as enum ('longwall', 'bord_and_pillar');

create table if not exists site_config (
  site_id             text primary key references sites(site_id),
  mine_type           mine_type not null,

  aoi_latitude        double precision,
  aoi_longitude        double precision,

  -- Mode-specific geometry (PRD-2 §2 Step 2a/2b). Shape depends on
  -- mine_type; validated at the application layer (Zod), not by a DB
  -- constraint, since the two modes have disjoint required fields.
  geometry            jsonb not null default '{}'::jsonb,

  -- Rock-to-soil ratio, brittleness index, rock density (Step 2, geology).
  geology             jsonb not null default '{}'::jsonb,

  -- Extraction %, pillar configuration/removal status, goaf notes (Step 2,
  -- "current mining/structural state" — manually updated, dashboard shows
  -- last_updated persistently per the PRD).
  mining_state        jsonb not null default '{}'::jsonb,

  -- InSAR AOI confirmation + Earth Engine connection/fallback status
  -- (Step 4).
  data_sources        jsonb not null default '{}'::jsonb,

  -- One boolean per field name across geometry/geology/mining_state,
  -- e.g. {"rock_density": true} = assumed/illustrative, not measured.
  -- Every dashboard display reading one of those fields must consult this
  -- map and render the assumed/real distinction — PRD-2 §2 is explicit
  -- this is non-negotiable, so it is its own column rather than embedded
  -- per-field, making it trivial to query "what on this site is assumed."
  is_assumed          jsonb not null default '{}'::jsonb,

  setup_completed      boolean not null default false,
  setup_completed_at   timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column site_config.mine_type is
  'Master switch (PRD-2 §2 Step 1) - determines which geometry form, which twin visualization (Monitoring/Planning vs. PHSR/CPHSR susceptibility), and which physics/ML submodules apply.';
comment on column site_config.is_assumed is
  'PRD-2 §2: every onboarding field must be explicitly tagged assumed/real. Keyed by field name (matches keys used in geometry/geology/mining_state), read by the dashboard to render the assumed/real caveat wherever that value is shown.';

alter table site_config enable row level security;

-- Same posture as the rest of the schema (0002): default-deny for anon,
-- authenticated may read, service_role (used by /api/site-config) bypasses
-- RLS entirely and does the actual writes.
create policy authenticated_select_site_config on site_config
  for select to authenticated using (true);

create index if not exists site_config_mine_type_idx on site_config (mine_type);
