create table if not exists public.rental_car_components (
  component_id uuid primary key references public.trip_components(id) on delete cascade,
  rental_company text,
  pickup_datetime timestamp with time zone,
  return_datetime timestamp with time zone,
  pickup_location text,
  return_location text,
  vehicle_class text,
  driver_count integer,
  rental_notes text,
  commission_amount numeric(12, 2),
  commission_status text,
  commission_notes text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists rental_car_components_pickup_datetime_idx
  on public.rental_car_components(pickup_datetime);

alter table public.rental_car_components enable row level security;

drop policy if exists "Admins can manage rental car components" on public.rental_car_components;
create policy "Admins can manage rental car components"
  on public.rental_car_components
  for all
  using (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.auth_user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.auth_user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
  );

drop policy if exists "Clients can view shared rental car components" on public.rental_car_components;
create policy "Clients can view shared rental car components"
  on public.rental_car_components
  for select
  using (
    exists (
      select 1
      from public.trip_components
      join public.trips on trips.id = trip_components.trip_id
      where trip_components.id = rental_car_components.component_id
        and trips.client_account_id in (
          select client_accounts.id
          from public.client_accounts
          left join public.user_profiles on user_profiles.id = client_accounts.user_profile_id
          where user_profiles.auth_user_id = auth.uid()
             or lower(client_accounts.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    or exists (
      select 1
      from public.trip_components
      join public.trip_members on trip_members.trip_id = trip_components.trip_id
      join public.client_accounts on client_accounts.id = trip_members.client_account_id
      left join public.user_profiles on user_profiles.id = client_accounts.user_profile_id
      where trip_components.id = rental_car_components.component_id
        and trip_members.invite_status = 'active'
        and trip_members.can_view_trip = true
        and (
          user_profiles.auth_user_id = auth.uid()
          or lower(client_accounts.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );
