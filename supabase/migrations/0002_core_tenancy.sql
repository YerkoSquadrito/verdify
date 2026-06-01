-- ─────────────────────────────────────────────────────────────────────────────
-- Tenancy spine: organizations → memberships → profiles.
--
-- `org_id` is the single Row-Level-Security scoping key for every customer
-- table. A consultant is a member of EACH of its client organizations and can
-- physically never read another consultant's org rows. This is the mechanism
-- that supports the white-label consultant tier (CLAUDE.md, RLS-mandatory).
-- ─────────────────────────────────────────────────────────────────────────────

create type org_type as enum ('owner', 'property_mgmt', 'consultant');
create type member_role as enum (
  'building_owner',
  'property_manager',
  'energy_consultant'
);

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        org_type not null,
  -- White-label subdomain for the consultant tier (e.g. "pegasus").
  subdomain   text unique,
  created_at  timestamptz not null default now()
);

-- One row per auth user, 1:1 with auth.users.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- The isolation-defining join. A user has one role per organization.
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  org_id      uuid not null references organizations (id) on delete cascade,
  role        member_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, org_id)
);

create index on memberships (user_id);
create index on memberships (org_id);

-- ── RLS helper ───────────────────────────────────────────────────────────────
-- Returns the org ids the current user belongs to. SECURITY DEFINER so it can
-- read memberships regardless of RLS, and the `memberships` policies below are
-- keyed ONLY on auth.uid() (never on this helper) to avoid policy recursion.
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

revoke all on function public.user_org_ids() from public;
grant execute on function public.user_org_ids() to authenticated, service_role;

-- ── Auto-provision a profile when an auth user is created ─────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
