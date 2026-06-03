-- Group travel feature setup
-- Run this in Supabase SQL Editor before using /admin/groups.

create table if not exists public.travel_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  slug text not null unique,
  destination text,
  group_type text,
  status text not null default 'planning',
  visibility text not null default 'public',
  start_date date,
  end_date date,
  registration_deadline date,
  deposit_deadline date,
  starting_price numeric(12, 2),
  deposit_amount numeric(12, 2),
  max_participants integer,
  hero_image_url text,
  overview text,
  included text,
  not_included text,
  notes text,
  linked_trip_id uuid references public.trips(id) on delete set null,
  primary_supplier_id uuid references public.suppliers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_group_participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(id) on delete cascade,
  client_account_id uuid references public.client_accounts(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  party_size integer not null default 1,
  status text not null default 'interested',
  deposit_paid boolean not null default false,
  paid_in_full boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_groups_slug_idx
on public.travel_groups(slug);

create index if not exists travel_group_participants_group_id_idx
on public.travel_group_participants(group_id);

create index if not exists travel_group_participants_email_idx
on public.travel_group_participants(lower(email));

alter table public.travel_groups enable row level security;
alter table public.travel_group_participants enable row level security;

drop policy if exists "Admins can manage travel groups" on public.travel_groups;
drop policy if exists "Public can view public travel groups" on public.travel_groups;
drop policy if exists "Admins can manage group participants" on public.travel_group_participants;
drop policy if exists "Public can request group registration" on public.travel_group_participants;

create policy "Admins can manage travel groups"
on public.travel_groups
for all
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
    and up.role::text in ('admin', 'owner', 'administrator')
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
    and up.role::text in ('admin', 'owner', 'administrator')
  )
);

create policy "Public can view public travel groups"
on public.travel_groups
for select
using (
  visibility = 'public'
  and status <> 'archived'
);

create policy "Admins can manage group participants"
on public.travel_group_participants
for all
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
    and up.role::text in ('admin', 'owner', 'administrator')
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
    and up.role::text in ('admin', 'owner', 'administrator')
  )
);

create policy "Public can request group registration"
on public.travel_group_participants
for insert
with check (
  status = 'interested'
  and client_account_id is null
);

grant select on table public.travel_groups to anon, authenticated;
grant insert on table public.travel_group_participants to anon;
grant select, insert, update, delete on table public.travel_groups to authenticated;
grant select, insert, update, delete on table public.travel_group_participants to authenticated;
grant all on table public.travel_groups to service_role;
grant all on table public.travel_group_participants to service_role;
