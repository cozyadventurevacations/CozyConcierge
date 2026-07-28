-- Booking Window Watch setup
-- Tracks whether supplier booking windows are open for target dates.

create table if not exists public.booking_window_watches (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid null references public.client_accounts(id) on delete set null,
  trip_id uuid null references public.trips(id) on delete set null,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  supplier_name_snapshot text null,
  product_type text not null default 'package',
  destination text null,
  start_date date null,
  end_date date null,
  flexible_window text null,
  traveler_count integer null,
  target_year integer null,
  check_url text null,
  notes text null,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  last_checked_at timestamptz null,
  last_status text null check (last_status is null or last_status in ('open', 'not_open', 'manual_review', 'error')),
  last_message text null,
  last_open_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_window_watch_results (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.booking_window_watches(id) on delete cascade,
  status text not null check (status in ('open', 'not_open', 'manual_review', 'error')),
  checked_url text null,
  found_start_date date null,
  found_end_date date null,
  message text null,
  raw_excerpt text null,
  checked_at timestamptz not null default now()
);

create index if not exists booking_window_watches_status_checked_idx
  on public.booking_window_watches(status, last_checked_at desc nulls last);

create index if not exists booking_window_watches_supplier_idx
  on public.booking_window_watches(supplier_id);

create index if not exists booking_window_watch_results_watch_checked_idx
  on public.booking_window_watch_results(watch_id, checked_at desc);

alter table public.booking_window_watches enable row level security;
alter table public.booking_window_watch_results enable row level security;

drop policy if exists "Admins can manage booking window watches" on public.booking_window_watches;
create policy "Admins can manage booking window watches"
  on public.booking_window_watches
  for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can manage booking window watch results" on public.booking_window_watch_results;
create policy "Admins can manage booking window watch results"
  on public.booking_window_watch_results
  for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

grant select, insert, update, delete on public.booking_window_watches to authenticated;
grant select, insert, update, delete on public.booking_window_watch_results to authenticated;

notify pgrst, 'reload schema';
