alter table public.quote_requests
  add column if not exists client_address_line_1 text,
  add column if not exists client_address_line_2 text,
  add column if not exists client_city text,
  add column if not exists client_state text,
  add column if not exists client_postal_code text,
  add column if not exists client_date_of_birth date,
  add column if not exists client_preferred_airport text,
  add column if not exists air_preferred_airline text,
  add column if not exists air_departure_airport text,
  add column if not exists cruise_line_preference text,
  add column if not exists theme_park_preference text;
