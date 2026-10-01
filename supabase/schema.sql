-- ============================================================
-- WorkRedesign.sg — Admin/CMS Database Schema (for Supabase)
-- ============================================================
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Design notes:
-- - Built for Supabase, which provides `auth.users` and the
--   Postgres roles `anon` (logged-out) and `authenticated`
--   (logged-in) automatically. Row Level Security (RLS) below
--   relies on both.
-- - Talent profile visibility is split across FOUR tiers using
--   separate 1:1 tables rather than column-level permissions,
--   because Postgres RLS controls row visibility, not column
--   visibility — normalizing by tier is the reliable way to
--   guarantee a "public summary" hirer genuinely cannot pull
--   private or contact fields via a broader query.
--     1. talent_profiles      — status/workflow (staff + owner only)
--     2. talent_public_info   — anonymised card (anyone)
--     3. talent_private_info  — fuller detail (approved_full hirers)
--     4. talent_contacts      — name + contact (only after an
--                                approved introduction, per profile)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type account_type as enum ('staff', 'hirer', 'pmet');
create type staff_role as enum ('super_admin', 'content_editor', 'talent_manager', 'approver');
create type hirer_status as enum ('pending', 'approved_summary', 'approved_full', 'rejected', 'suspended');
create type talent_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'paused');
create type intro_status as enum ('requested', 'approved', 'declined', 'completed');

-- ------------------------------------------------------------
-- PROFILES  (extends auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type account_type not null,
  display_name text,
  email text,
  company_name text,                    -- hirer only
  staff_role staff_role,                -- staff only
  hirer_status hirer_status,            -- hirer only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. account_type determines which of staff_role / hirer_status is meaningful.';

-- Auto-create a profile row when someone signs up via Supabase Auth.
-- The client passes account_type (and company_name, for hirers) in
-- the signUp() call's options.data — see account.html / js/account.js.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  requested_acct text := meta->>'account_type';
  acct account_type;
begin
  -- Security: public sign-up can only ever create 'hirer' or 'pmet'
  -- accounts. Staff accounts are never self-assigned from signup
  -- metadata — they're granted by an existing super_admin directly
  -- in the database (see the bootstrap note at the end of this file).
  if requested_acct = 'pmet' then
    acct := 'pmet';
  else
    acct := 'hirer';
  end if;

  insert into public.profiles (id, account_type, display_name, email, company_name, hirer_status)
  values (
    new.id,
    acct,
    meta->>'display_name',
    new.email,
    meta->>'company_name',
    case when acct = 'hirer' then 'pending'::hirer_status else null end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent a non-super-admin from escalating their own account_type,
-- staff_role, or hirer_status by editing their own profile row via
-- the app. Does NOT block the Supabase SQL editor / service role,
-- which operate with no end-user JWT at all (auth.uid() is null in
-- that context) and are trusted by design — that's how you bootstrap
-- the first super_admin and how staff accounts get provisioned.
--
-- An 'approver' staff member is allowed to change hirer_status only
-- (that's their entire job) but not account_type or staff_role — any
-- attempt to change those two is silently reverted for them too.
create or replace function public.protect_role_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  acting_uid uuid := auth.uid();
  acting_role staff_role;
begin
  if acting_uid is null then
    -- No end-user JWT context (service role / SQL editor) — trusted.
    new.updated_at := now();
    return new;
  end if;

  select staff_role into acting_role from public.profiles where id = acting_uid;

  if acting_role = 'super_admin' then
    null; -- full trust, no reverts
  elsif acting_role = 'approver' then
    new.account_type := old.account_type;
    new.staff_role := old.staff_role;
    -- hirer_status is left as NEW — this is exactly what an approver may change
  else
    new.account_type := old.account_type;
    new.staff_role := old.staff_role;
    new.hirer_status := old.hirer_status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_role_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_role_fields();

-- ------------------------------------------------------------
-- Helper functions used throughout RLS policies below
-- ------------------------------------------------------------
-- SECURITY DEFINER is required here, not optional: these functions are
-- called from inside RLS policies ON public.profiles itself (via is_staff(),
-- etc.). Without SECURITY DEFINER they run as the invoking (RLS-restricted)
-- user, so their own "select ... from public.profiles" re-triggers the very
-- policy that's calling them — infinite recursion, surfaced by Postgres as
-- "stack depth limit exceeded". SECURITY DEFINER runs them as the function
-- owner (the superuser that ran this schema), which bypasses RLS and breaks
-- the loop, exactly like handle_new_user() and protect_role_fields() above.
create or replace function public.current_account_type()
returns account_type language sql stable security definer set search_path = public
as $$ select account_type from public.profiles where id = auth.uid() $$;

create or replace function public.current_staff_role()
returns staff_role language sql stable security definer set search_path = public
as $$ select staff_role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean language sql stable
as $$ select public.current_account_type() = 'staff' $$;

create or replace function public.is_super_admin()
returns boolean language sql stable
as $$ select public.current_staff_role() = 'super_admin' $$;

create or replace function public.is_content_editor()
returns boolean language sql stable
as $$ select public.current_staff_role() in ('super_admin', 'content_editor') $$;

create or replace function public.is_talent_manager()
returns boolean language sql stable
as $$ select public.current_staff_role() in ('super_admin', 'talent_manager') $$;

create or replace function public.is_approver()
returns boolean language sql stable
as $$ select public.current_staff_role() in ('super_admin', 'approver') $$;

create or replace function public.current_hirer_status()
returns hirer_status language sql stable security definer set search_path = public
as $$ select hirer_status from public.profiles where id = auth.uid() $$;

-- Note: has_approved_intro() is defined further below, immediately
-- after the intro_requests table it depends on, since Postgres
-- requires the referenced table to exist first.

-- ------------------------------------------------------------
-- TALENT PROFILES (tier 0: workflow/status — staff + owner only)
-- ------------------------------------------------------------
create table public.talent_profiles (
  id uuid primary key default gen_random_uuid(),
  pmet_user_id uuid references public.profiles(id) on delete set null,
  status talent_status not null default 'pending_review',
  is_published boolean not null default false,
  card_code text unique not null default ('PMET-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  consent_public_card boolean not null default false,
  consent_private_detail boolean not null default false,
  consent_date timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TALENT PUBLIC INFO (tier 1: anonymised card — visible to anyone)
-- ------------------------------------------------------------
create table public.talent_public_info (
  talent_profile_id uuid primary key references public.talent_profiles(id) on delete cascade,
  headline text,
  function_area text,
  skills_tags text[] not null default '{}',
  arrangement_types text[] not null default '{}',   -- e.g. {fractional, job-share, project-based}
  years_experience_band text,
  availability_hours_per_week int,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TALENT PRIVATE INFO (tier 2: fuller detail — approved_full hirers)
-- ------------------------------------------------------------
create table public.talent_private_info (
  talent_profile_id uuid primary key references public.talent_profiles(id) on delete cascade,
  bio_private text,
  tools_software text[] not null default '{}',
  indicative_rate_band text,
  case_study_summary text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TALENT CONTACTS (tier 3: name + contact — only via approved intro)
-- ------------------------------------------------------------
create table public.talent_contacts (
  talent_profile_id uuid primary key references public.talent_profiles(id) on delete cascade,
  full_name text,
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INTRO REQUESTS  (a hirer asking to be introduced to one PMET)
-- ------------------------------------------------------------
create table public.intro_requests (
  id uuid primary key default gen_random_uuid(),
  hirer_id uuid not null references public.profiles(id) on delete cascade,
  talent_profile_id uuid not null references public.talent_profiles(id) on delete cascade,
  status intro_status not null default 'requested',
  message text,
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  unique (hirer_id, talent_profile_id)
);

-- Now that intro_requests exists, define the helper that checks it.
create or replace function public.has_approved_intro(p_talent_profile_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.intro_requests
    where talent_profile_id = p_talent_profile_id
      and hirer_id = auth.uid()
      and status = 'approved'
  )
$$;

-- ------------------------------------------------------------
-- CONTENT BLOCKS  (site copy the admin can edit without code)
-- ------------------------------------------------------------
create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  block_key text unique not null,     -- e.g. 'hero.index.title'
  page text not null,                 -- e.g. 'index', 'about', 'global'
  label text not null,                -- human-readable label shown in admin UI
  content_type text not null default 'text',  -- 'text' | 'richtext' | 'json'
  content_value text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MENU ITEMS  (site nav, admin-managed)
-- ------------------------------------------------------------
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- GRANTS  (replaces the hardcoded GRANTS array in js/data.js)
-- ------------------------------------------------------------
create table public.grants (
  id uuid primary key default gen_random_uuid(),
  grant_key text unique not null,
  name text not null,
  short_desc text,
  url text,
  funding_summary text,
  best_for text,
  checklist_items jsonb not null default '[]',
  is_published boolean not null default true,
  sort_order int not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- FEATURE FLAGS  (room to scale — toggle new functionality safely)
-- ------------------------------------------------------------
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text unique not null,
  label text not null,
  description text,
  is_enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AUDIT LOG  (who changed / approved what, and when)
-- ------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger, applied to the tables that need it
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_talent_profiles before update on public.talent_profiles
  for each row execute function public.touch_updated_at();
create trigger touch_talent_public_info before update on public.talent_public_info
  for each row execute function public.touch_updated_at();
create trigger touch_talent_private_info before update on public.talent_private_info
  for each row execute function public.touch_updated_at();
create trigger touch_talent_contacts before update on public.talent_contacts
  for each row execute function public.touch_updated_at();
create trigger touch_content_blocks before update on public.content_blocks
  for each row execute function public.touch_updated_at();
create trigger touch_menu_items before update on public.menu_items
  for each row execute function public.touch_updated_at();
create trigger touch_grants before update on public.grants
  for each row execute function public.touch_updated_at();
create trigger touch_feature_flags before update on public.feature_flags
  for each row execute function public.touch_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.talent_profiles enable row level security;
alter table public.talent_public_info enable row level security;
alter table public.talent_private_info enable row level security;
alter table public.talent_contacts enable row level security;
alter table public.intro_requests enable row level security;
alter table public.content_blocks enable row level security;
alter table public.menu_items enable row level security;
alter table public.grants enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_log enable row level security;

-- ---- profiles ----
create policy "profiles: self or staff can select"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

create policy "profiles: self or staff can update"
  on public.profiles for update
  using (id = auth.uid() or public.is_staff());
  -- role-escalation is blocked separately by protect_role_fields_trigger

-- ---- talent_profiles (tier 0) ----
-- Scoped to is_talent_manager() (which itself includes super_admin) —
-- deliberately NOT is_staff(), so a content_editor or approver cannot
-- touch talent data outside their own role.
create policy "talent_profiles: staff full access"
  on public.talent_profiles for all
  using (public.is_talent_manager())
  with check (public.is_talent_manager());

create policy "talent_profiles: owner can select own"
  on public.talent_profiles for select
  using (pmet_user_id = auth.uid());

create policy "talent_profiles: pmet can insert own submission"
  on public.talent_profiles for insert
  with check (pmet_user_id = auth.uid() and public.current_account_type() = 'pmet');

create policy "talent_profiles: owner can update own while draft/pending"
  on public.talent_profiles for update
  using (pmet_user_id = auth.uid() and status in ('draft', 'pending_review'))
  with check (pmet_user_id = auth.uid());

create policy "talent_profiles: anyone can see approved+published rows exist"
  on public.talent_profiles for select
  using (status = 'approved' and is_published = true);

-- ---- talent_public_info (tier 1: anyone) ----
create policy "talent_public_info: visible if profile is approved+published"
  on public.talent_public_info for select
  using (
    exists (
      select 1 from public.talent_profiles tp
      where tp.id = talent_profile_id
        and tp.status = 'approved'
        and tp.is_published = true
        and tp.consent_public_card = true
    )
    or public.is_talent_manager()
    or exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid())
  );

create policy "talent_public_info: staff can manage"
  on public.talent_public_info for all
  using (public.is_talent_manager())
  with check (public.is_talent_manager());

create policy "talent_public_info: owner can upsert own"
  on public.talent_public_info for insert
  with check (exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid()));

create policy "talent_public_info: owner can update own"
  on public.talent_public_info for update
  using (exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid()));

-- ---- talent_private_info (tier 2: approved_full hirers, staff, owner) ----
create policy "talent_private_info: visible to approved_full hirers"
  on public.talent_private_info for select
  using (
    public.is_talent_manager()
    or exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid())
    or (
      public.current_hirer_status() = 'approved_full'
      and exists (
        select 1 from public.talent_profiles tp
        where tp.id = talent_profile_id
          and tp.status = 'approved'
          and tp.is_published = true
          and tp.consent_private_detail = true
      )
    )
  );

create policy "talent_private_info: staff can manage"
  on public.talent_private_info for all
  using (public.is_talent_manager())
  with check (public.is_talent_manager());

create policy "talent_private_info: owner can upsert own"
  on public.talent_private_info for insert
  with check (exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid()));

create policy "talent_private_info: owner can update own"
  on public.talent_private_info for update
  using (exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid()));

-- ---- talent_contacts (tier 3: only via an approved intro, staff, or owner) ----
create policy "talent_contacts: visible via approved intro"
  on public.talent_contacts for select
  using (
    public.is_talent_manager()
    or exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid())
    or public.has_approved_intro(talent_profile_id)
  );

create policy "talent_contacts: staff can manage"
  on public.talent_contacts for all
  using (public.is_talent_manager())
  with check (public.is_talent_manager());

create policy "talent_contacts: owner can upsert own"
  on public.talent_contacts for insert
  with check (exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid()));

create policy "talent_contacts: owner can update own"
  on public.talent_contacts for update
  using (exists (select 1 from public.talent_profiles tp where tp.id = talent_profile_id and tp.pmet_user_id = auth.uid()));

-- ---- intro_requests ----
-- Scoped to is_talent_manager() rather than is_staff(), so a
-- content_editor or approver cannot see or decide match requests.
create policy "intro_requests: hirer can see own requests"
  on public.intro_requests for select
  using (hirer_id = auth.uid() or public.is_talent_manager());

create policy "intro_requests: approved_full hirer can create requests"
  on public.intro_requests for insert
  with check (
    hirer_id = auth.uid()
    and public.current_hirer_status() in ('approved_summary', 'approved_full')
  );

create policy "intro_requests: staff can update (approve/decline)"
  on public.intro_requests for update
  using (public.is_talent_manager())
  with check (public.is_talent_manager());

-- ---- content_blocks (public read, content_editor write) ----
create policy "content_blocks: public can read"
  on public.content_blocks for select
  using (true);

create policy "content_blocks: content editors can manage"
  on public.content_blocks for insert with check (public.is_content_editor());
create policy "content_blocks: content editors can update"
  on public.content_blocks for update using (public.is_content_editor());
create policy "content_blocks: content editors can delete"
  on public.content_blocks for delete using (public.is_content_editor());

-- ---- menu_items (public read, content_editor write) ----
create policy "menu_items: public can read visible items"
  on public.menu_items for select
  using (is_visible = true or public.is_content_editor());

create policy "menu_items: content editors can manage"
  on public.menu_items for insert with check (public.is_content_editor());
create policy "menu_items: content editors can update"
  on public.menu_items for update using (public.is_content_editor());
create policy "menu_items: content editors can delete"
  on public.menu_items for delete using (public.is_content_editor());

-- ---- grants (public read published, content_editor write) ----
create policy "grants: public can read published"
  on public.grants for select
  using (is_published = true or public.is_content_editor());

create policy "grants: content editors can manage"
  on public.grants for insert with check (public.is_content_editor());
create policy "grants: content editors can update"
  on public.grants for update using (public.is_content_editor());
create policy "grants: content editors can delete"
  on public.grants for delete using (public.is_content_editor());

-- ---- feature_flags (public read enabled, super_admin write) ----
create policy "feature_flags: public can read"
  on public.feature_flags for select
  using (true);

create policy "feature_flags: super admin can manage"
  on public.feature_flags for insert with check (public.is_super_admin());
create policy "feature_flags: super admin can update"
  on public.feature_flags for update using (public.is_super_admin());
create policy "feature_flags: super admin can delete"
  on public.feature_flags for delete using (public.is_super_admin());

-- ---- audit_log (staff can read, anyone authenticated can be logged via service calls) ----
create policy "audit_log: staff can read"
  on public.audit_log for select
  using (public.is_staff());

create policy "audit_log: staff can insert"
  on public.audit_log for insert
  with check (public.is_staff());

-- ============================================================
-- TABLE-LEVEL GRANTS
-- ============================================================
-- RLS policies above are the real security boundary (they decide
-- which ROWS a query can see), but Postgres also requires a base
-- table-level privilege before RLS is even evaluated. Supabase
-- typically grants these by default, but they're made explicit
-- here so this schema is correct standalone and doesn't silently
-- depend on that default (e.g. has_approved_intro() would error
-- with "permission denied" for anon without the SELECT grant on
-- intro_requests below, even though RLS would correctly return
-- zero rows for anon on that table).

grant usage on schema public to anon, authenticated;

grant select on
  public.talent_profiles, public.talent_public_info, public.talent_private_info,
  public.talent_contacts, public.intro_requests, public.content_blocks,
  public.menu_items, public.grants, public.feature_flags, public.profiles
  to anon, authenticated;

grant insert, update on
  public.talent_profiles, public.talent_public_info, public.talent_private_info,
  public.talent_contacts, public.intro_requests, public.profiles
  to authenticated;

grant insert, update, delete on
  public.content_blocks, public.menu_items, public.grants, public.feature_flags
  to authenticated;

grant insert on public.audit_log to authenticated;

-- ============================================================
-- Helpful indexes
-- ============================================================
create index idx_talent_profiles_status on public.talent_profiles (status, is_published);
create index idx_talent_public_info_function on public.talent_public_info (function_area);
create index idx_talent_public_info_tags on public.talent_public_info using gin (skills_tags);
create index idx_intro_requests_hirer on public.intro_requests (hirer_id);
create index idx_intro_requests_talent on public.intro_requests (talent_profile_id);
create index idx_content_blocks_page on public.content_blocks (page);
create index idx_audit_log_target on public.audit_log (target_table, target_id);

-- ============================================================
-- Bootstrap: promote the FIRST person who signs up to super_admin.
-- After running this schema, sign up once through account.html
-- with account_type staff (or sign up as any type, then run this
-- against your own user id from the Supabase Auth dashboard):
--
--   update public.profiles
--   set account_type = 'staff', staff_role = 'super_admin'
--   where email = 'you@yourorg.sg';
--
-- Do this directly in the Supabase SQL editor — it runs as the
-- service role, so it bypasses the protect_role_fields_trigger
-- restriction that blocks self-escalation from the app.
-- ============================================================

-- restriction that blocks self-escalation from the app.
-- ============================================================
