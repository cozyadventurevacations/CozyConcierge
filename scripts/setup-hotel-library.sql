create table if not exists public.hotel_library (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null,
  brand_name text,
  google_place_id text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  formatted_address text,
  phone text,
  website_url text,
  google_maps_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  preferred_room_notes text,
  terms_notes text,
  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists hotel_library_hotel_name_idx
  on public.hotel_library(hotel_name);

create index if not exists hotel_library_google_place_id_idx
  on public.hotel_library(google_place_id);

alter table public.hotel_library enable row level security;

grant select, insert, update, delete on public.hotel_library to authenticated;

drop policy if exists "Admins can manage hotel library" on public.hotel_library;
create policy "Admins can manage hotel library"
on public.hotel_library
for all
using (current_user_is_admin())
with check (current_user_is_admin());

drop trigger if exists set_hotel_library_updated_at on public.hotel_library;
create trigger set_hotel_library_updated_at
before update on public.hotel_library
for each row
execute function public.set_updated_at();
