-- Cruise price watch setup
-- Run this in Supabase SQL Editor before enabling cruise price checks.

alter table public.trip_components
  add column if not exists price_watch_enabled boolean not null default false,
  add column if not exists price_watch_public_url text null,
  add column if not exists price_watch_match_code text null,
  add column if not exists price_watch_last_checked_at timestamptz null,
  add column if not exists price_watch_last_status text null,
  add column if not exists price_watch_last_found_price numeric(12, 2) null,
  add column if not exists price_watch_last_promo_codes text null,
  add column if not exists price_watch_last_error text null,
  add column if not exists price_watch_alerted_at timestamptz null;

create table if not exists public.cruise_price_watch_results (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  component_id uuid not null references public.trip_components(id) on delete cascade,
  cruise_line text null,
  ship_name text null,
  sailing_date date null,
  cabin_match_code text null,
  booked_total numeric(12, 2) null,
  found_total numeric(12, 2) null,
  savings_amount numeric(12, 2) null,
  promo_codes text null,
  status text not null default 'manual_review',
  public_url text null,
  checked_at timestamptz not null default now(),
  message text null
);

create index if not exists cruise_price_watch_results_trip_id_idx
  on public.cruise_price_watch_results(trip_id);

create index if not exists cruise_price_watch_results_component_id_checked_at_idx
  on public.cruise_price_watch_results(component_id, checked_at desc);

create index if not exists cruise_price_watch_results_status_checked_at_idx
  on public.cruise_price_watch_results(status, checked_at desc);

alter table public.cruise_price_watch_results enable row level security;

drop policy if exists "Admins can manage cruise price watch results"
  on public.cruise_price_watch_results;

create policy "Admins can manage cruise price watch results"
  on public.cruise_price_watch_results
  for all
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.auth_user_id = auth.uid()
        and up.role = 'admin'::app_role
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.auth_user_id = auth.uid()
        and up.role = 'admin'::app_role
    )
  );

grant select, insert, update, delete on public.cruise_price_watch_results to authenticated;

notify pgrst, 'reload schema';
