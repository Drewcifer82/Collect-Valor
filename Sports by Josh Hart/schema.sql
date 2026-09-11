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
  value        numeric(12,2),                 -- market value captured at save time
  image_path   text,                          -- path inside the 'collection' storage bucket
  is_showcase  boolean not null default false,
  is_tradeable boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists collection_owner_idx on public.collection (owner);
create index if not exists collection_owner_slab_idx on public.collection (owner, is_slab);

alter table public.collection enable row level security;
-- Intentionally no policies for anon/authenticated: direct client access is denied.
-- The Netlify functions use the service_role key (which bypasses RLS) and enforce
-- ownership + the 50-singles / 20-slabs caps themselves.

-- Private storage bucket that holds the scanned/uploaded card images.
insert into storage.buckets (id, name, public)
values ('collection', 'collection', false)
on conflict (id) do nothing;
