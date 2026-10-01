-- Collect Valor — collection schema
-- Run this in the Supabase SQL editor (project utecxjkakbzywmypqlwu).
--
-- Security model: ALL app access goes through the Netlify functions using the
-- service_role key, which bypasses RLS. RLS is turned ON with NO public policies,
-- so anon/authenticated clients cannot read or write this table directly — the
-- same lockdown pattern already used for the users table. Per-user ownership and
-- the collection caps are enforced inside the save function, in code.

create extension if not exists pgcrypto;

-- Public scanner allowance: 35 successful scans per anonymized network address.
-- `identify.mjs` hashes the address with SESSION_SECRET before it reaches this table.
create table if not exists public.guest_scan_usage (
  id         text primary key,
  count      integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.guest_scan_usage enable row level security;

create or replace function public.consume_guest_scan(p_id text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if p_limit < 1 then raise exception 'p_limit must be positive'; end if;
  insert into public.guest_scan_usage (id, count)
  values (p_id, 1)
  on conflict (id) do update
    set count = guest_scan_usage.count + 1, updated_at = now()
    where guest_scan_usage.count < p_limit
  returning count into next_count;
  return coalesce(next_count, 0);
end;
$$;

create or replace function public.release_guest_scan(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.guest_scan_usage
  set count = greatest(count - 1, 0), updated_at = now()
  where id = p_id;
$$;

revoke all on function public.consume_guest_scan(text, integer) from public, anon, authenticated;
revoke all on function public.release_guest_scan(text) from public, anon, authenticated;
grant execute on function public.consume_guest_scan(text, integer) to service_role;
grant execute on function public.release_guest_scan(text) to service_role;

create table if not exists public.collection (
  id           uuid primary key default gen_random_uuid(),
  owner        text not null,                 -- username from the login token
  card_type    text not null default 'sports',
  category     text,                          -- Card Hedge category (specific sport, or "Pokemon")
  player       text,                          -- athlete, or Pokemon + card name
  team         text,
  sport        text,
  position     text,
  brand        text,
  card_set     text,
  card_number  text,
  variation    text,
  year         text,
  rookie       boolean default false,
  is_slab      boolean not null default false,
  cert_number  text,
  grade        text,
  card_id      text,                          -- Card Hedge card_id
  tcgplayer_id text,                          -- TCGplayer product ID returned by TCG API
  value        numeric(12,2),                 -- market value captured at save time
  previous_value numeric(12,2),               -- prior daily market value, for 24-hour movement
  price_updated_at timestamptz,               -- when the market value was last checked
  image_path   text,                          -- path inside the 'collection' storage bucket
  is_showcase  boolean not null default false,
  is_tradeable boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists collection_owner_idx on public.collection (owner);
create index if not exists collection_owner_slab_idx on public.collection (owner, is_slab);

alter table public.collection add column if not exists tcgplayer_id text;
alter table public.collection add column if not exists previous_value numeric(12,2);
alter table public.collection add column if not exists price_updated_at timestamptz;
alter table public.collection add column if not exists story_origin text;
alter table public.collection add column if not exists story_place text;
alter table public.collection add column if not exists story_year integer;
alter table public.collection add column if not exists story_age integer;
alter table public.collection add column if not exists story_price_paid numeric(12,2);
alter table public.collection add column if not exists story_note text;

-- Public-facing collector names. Account emails stay private; only a chosen
-- display name is returned by Community binders.
create table if not exists public.collector_profiles (
  owner        text primary key,
  display_name text not null unique,
  updated_at   timestamptz not null default now(),
  constraint collector_profiles_display_name_length check (char_length(display_name) between 3 and 24),
  constraint collector_profiles_display_name_format check (display_name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9]$')
);
alter table public.collector_profiles enable row level security;

-- Internal product feedback. It is private to Collect Valor staff; direct
-- browser access is denied and the Netlify function records the token owner.
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  owner      text not null,
  rating     smallint not null check (rating between 1 and 5),
  category   text not null check (category in ('bug', 'idea', 'pricing', 'general')),
  message    text not null check (char_length(message) between 1 and 750),
  contact_ok boolean not null default false,
  share_ok   boolean not null default false,
  public_display_ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
alter table public.feedback add column if not exists public_display_ok boolean not null default false;

alter table public.collection enable row level security;
-- Intentionally no policies for anon/authenticated: direct client access is denied.
-- The Netlify functions use the service_role key (which bypasses RLS) and enforce
-- ownership + the 50-singles / 20-slabs caps themselves.

-- Private storage bucket that holds the scanned/uploaded card images.
insert into storage.buckets (id, name, public)
values ('collection', 'collection', false)
on conflict (id) do nothing;
