-- RBAC hardening (Phase: production role/user-management architecture).
-- Additive on top of 0006_profiles.sql - does not drop or rename anything.
--
-- APPLIED to the live project via the Supabase SQL editor.
--
-- Changes:
--   1. profiles.role default flips from 'operator' to 'viewer' - every
--      NEWLY created profile (via the trigger below) starts least-privilege.
--      Existing profile rows are untouched (a DEFAULT only affects future
--      inserts that omit the column).
--   2. profiles gains `status` (active/inactive) - an inactive user is
--      denied application access regardless of role (src/middleware.ts +
--      src/lib/auth/roles.ts).
--   3. profiles gains `assigned_site_id` - which site this user is
--      associated with. Nullable: a user can exist with no site assignment
--      yet (matches "minimum possible access" for a fresh signup).
--   4. A trigger on auth.users auto-creates the profiles row at signup with
--      role='viewer', so "no profile row" stops being a state new users can
--      even be in - it only remains possible for accounts created before
--      this migration ran. Application code (src/lib/auth/roles.ts) treats
--      that legacy no-row case as 'viewer' too (changed from the previous
--      default-safe-as-admin behavior now that a real default role exists).
--   5. sites gains `owner_user_id` - the site's current owner, transferable
--      only by an admin via /api/admin/ownership (src/lib/domain audit
--      trail below).
--   6. audit_log gains `actor_user_id` and `target_user_id` (uuid, nullable)
--      alongside the existing free-text `actor` column, so admin actions
--      (role changes, activation, ownership transfer) can be queried
--      relationally without breaking any existing row (both columns are
--      nullable and NOT populated for pre-existing pipeline/alert audit
--      rows, which keep using the `actor` text column as before).

alter table profiles
  alter column role set default 'viewer';

do $$ begin
  create type profile_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

alter table profiles
  add column if not exists status profile_status not null default 'active',
  add column if not exists assigned_site_id text references sites(site_id);

comment on column profiles.status is
  'inactive = account exists in Supabase Auth but is denied all application access (middleware + API guards), regardless of role. Set only by an admin via /api/admin/users/:id/status.';
comment on column profiles.assigned_site_id is
  'Which site this user is associated with (single-tenant today, but modeled as a real FK rather than assumed global access) - set by an admin via /api/admin/ownership.';

alter table sites
  add column if not exists owner_user_id uuid references auth.users(id);

comment on column sites.owner_user_id is
  'Current site owner. Changed only via /api/admin/ownership (admin-only, atomic, audited) - never write this column directly.';

alter table audit_log
  add column if not exists actor_user_id uuid references auth.users(id),
  add column if not exists target_user_id uuid references auth.users(id);

comment on column audit_log.actor_user_id is
  'Set for admin/RBAC actions (role change, activation, ownership transfer) recorded after auth shipped. Older ingest/alert-pipeline audit rows leave this null and identify the actor via the existing text `actor` column instead.';
comment on column audit_log.target_user_id is
  'The user a role/status/ownership change was applied to, when applicable.';

-- Auto-provision a least-privilege profile row the moment a Supabase Auth
-- user is created, so every signup is viewer-by-default without relying on
-- application code to remember to insert one. SECURITY DEFINER is required
-- because this fires as part of the auth.users insert, before the new
-- session exists to satisfy the profiles RLS policy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, full_name)
  values (new.id, 'viewer', new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user is
  'PRD-2 RBAC: every new Supabase Auth user gets a viewer profile row automatically. The seed admin script (tools/seed-admin.mjs) upserts role=admin AFTER creating its auth user, which overrides this default for that one account only.';
