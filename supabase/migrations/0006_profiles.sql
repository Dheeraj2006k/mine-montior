-- Application roles (PRD-2 §21 / Phase O). Additive - references auth.users
-- (Supabase Auth's own table), does not touch any of the 14 tables from
-- 0001 or site_config/nodes from 0004/0005.
--
-- NOT YET APPLIED to the live project - same constraint as 0003/0004/0005
-- (no direct DDL access in this build pass). Apply via the Supabase SQL
-- editor or `supabase db push`.
--
-- Deliberate default-safe behavior: application code (src/lib/auth/roles.ts)
-- treats a signed-in user with NO row here, or this table not existing yet,
-- as 'admin' - preserving today's actual behavior (every signed-in user can
-- do everything, since there was no role gating before this migration) so
-- applying this migration alone changes nothing. Role restriction only
-- takes effect once an admin explicitly assigns 'viewer' or 'operator' to
-- specific users via /admin/users.

create type app_role as enum ('viewer', 'operator', 'admin');

create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        app_role not null default 'operator',
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table profiles is
  'PRD-2 §21 roles: viewer (read-only), operator (acknowledge/resolve/feedback/blast scheduling), admin (contacts/settings/system config). A user with no row here is treated as admin by application code until explicitly assigned a role - see src/lib/auth/roles.ts.';

alter table profiles enable row level security;

-- Users may read their own role (needed for the role badge in the app
-- shell); only service_role (the API layer) can write.
create policy self_select_profile on profiles
  for select to authenticated using (user_id = auth.uid());
