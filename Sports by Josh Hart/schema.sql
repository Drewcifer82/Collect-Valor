-- Collect Valor — collection schema
-- Run this in the Supabase SQL editor (project utecxjkakbzywmypqlwu).
--
-- Security model: ALL app access goes through the Netlify functions using the
-- service_role key, which bypasses RLS. RLS is turned ON with NO public policies,
-- so anon/authenticated clients cannot read or write this table directly — the
-- same lockdown pattern already used for the users table. Per-user ownership and
-- the collection caps are enforced inside the save function, in code.

create extension if not exists pgcrypto;

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

-- Temporary opening-day notification list. This table stores only the email a
-- visitor voluntarily submits. After the launch notice is sent, remove every
-- row; subscription-account emails remain in their separate account tables.
create table if not exists public.launch_waitlist (
  email      text primary key,
  created_at timestamptz not null default now(),
  constraint launch_waitlist_email_length check (char_length(email) between 3 and 254)
);
alter table public.launch_waitlist enable row level security;

alter table public.collection enable row level security;
-- Intentionally no policies for anon/authenticated: direct client access is denied.
-- The Netlify functions use the service_role key (which bypasses RLS) and enforce
-- ownership + the 50-singles / 20-slabs caps themselves.

-- Private storage bucket that holds the scanned/uploaded card images.
insert into storage.buckets (id, name, public)
values ('collection', 'collection', false)
on conflict (id) do nothing;
