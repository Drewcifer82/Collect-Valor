-- Collect Valor — PAYWALL schema
-- Run this in the Supabase SQL editor (project utecxjkakbzywmypqlwu).
--
-- Adds subscription/entitlement columns to `users`, plus two tables:
--   subscribers — one row per paying Stripe email (written by the Stripe webhook)
--   email_codes — short-lived 6-digit codes that prove the user owns the inbox
--
-- Security: RLS ON, no public policies. All access is through the Netlify
-- functions using the service_role key (bypasses RLS) — same lockdown as the
-- users and collection tables. Nothing here is reachable by anon clients.

create extension if not exists pgcrypto;

-- 1) Entitlement columns on the existing users table --------------------------
alter table public.users add column if not exists plan                   text not null default 'free';
alter table public.users add column if not exists plan_status            text;          -- active | past_due | canceled
alter table public.users add column if not exists paid_email             text;          -- the email THIS account verified
alter table public.users add column if not exists stripe_customer_id     text;
alter table public.users add column if not exists stripe_subscription_id text;
alter table public.users add column if not exists plan_renews_at         timestamptz;

-- One paid email can unlock only ONE account (this is the anti-sharing lock).
create unique index if not exists users_paid_email_uidx
  on public.users (lower(paid_email)) where paid_email is not null;

-- 2) subscribers: what Stripe tells us, keyed by the payer's email ------------
create table if not exists public.subscribers (
  email                  text primary key,               -- lowercased Stripe email
  status                 text not null default 'active', -- active | past_due | canceled
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan_renews_at         timestamptz,
  updated_at             timestamptz not null default now()
);
alter table public.subscribers enable row level security;

-- 3) email_codes: 6-digit inbox-ownership codes ------------------------------
create table if not exists public.email_codes (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,          -- the logged-in account asking to verify
  email      text not null,          -- the paid email being claimed
  code_hash  text not null,          -- sha256 of the code (raw code never stored)
  expires_at timestamptz not null,   -- codes live ~10 minutes
  attempts   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists email_codes_username_idx on public.email_codes (username);
alter table public.email_codes enable row level security;

-- 4) Keep yourself (and any friends) FREE for life -- edit the list, then run:
-- update public.users set plan = 'comp' where username in ('andrew');
