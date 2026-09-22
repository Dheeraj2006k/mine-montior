-- Application roles (PRD-2 §21 / Phase O). Additive - references auth.users
-- (Supabase Auth's own table), does not touch any of the 14 tables from
-- 0001 or site_config/nodes from 0004/0005.
--
-- APPLIED. Superseded in part by 0009_rbac_hardening.sql, which is also
-- applied: role's DEFAULT is now 'viewer' (not 'operator' as created here -
-- ALTER COLUMN ... SET DEFAULT in 0009 changed it), status/assigned_site_id
-- columns were added, and the on_auth_user_created trigger now
-- auto-provisions this row at signup. Application code (src/lib/auth/roles.ts)
-- no longer treats a missing row as admin - see 0009 for the current,
-- accurate description of default-safe behavior. Left here as history: do
-- not re-run this file's CREATE TABLE against the live project.

create type app_role as enum ('viewer', 'operator', 'admin');

create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        app_role not null default 'operator',
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table profiles is
  'PRD-2 §21 roles: viewer (read-only), operator (acknowledge/resolve/feedback/blast scheduling), admin (contacts/settings/system config). Every new signup gets a viewer row automatically (0009 trigger) - see src/lib/auth/roles.ts for the current default-safe fallback.';

alter table profiles enable row level security;

-- Users may read their own role (needed for the role badge in the app
-- shell); only service_role (the API layer) can write.
create policy self_select_profile on profiles
  for select to authenticated using (user_id = auth.uid());
