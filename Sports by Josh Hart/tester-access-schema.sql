-- Run once in the Collect Valor Supabase SQL editor before enabling tester passes.
create table if not exists public.tester_scan_usage (
  pass_id text not null,
  scan_day date not null default (now() at time zone 'utc')::date,
  scans integer not null default 0 check (scans >= 0),
  primary key (pass_id, scan_day)
);

alter table public.tester_scan_usage enable row level security;

create or replace function public.consume_tester_scan(p_pass_id text, p_limit integer default 40)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_count integer;
begin
  insert into public.tester_scan_usage(pass_id, scan_day, scans)
  values (p_pass_id, (now() at time zone 'utc')::date, 1)
  on conflict (pass_id, scan_day) do update
    set scans = public.tester_scan_usage.scans + 1
    where public.tester_scan_usage.scans < p_limit
  returning scans into new_count;
  return new_count;
end;
$$;

revoke all on function public.consume_tester_scan(text, integer) from public, anon, authenticated;
grant execute on function public.consume_tester_scan(text, integer) to service_role;
