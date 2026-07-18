alter table public.insurance_components
  add column if not exists quote_options jsonb not null default '[]'::jsonb;

update public.trip_components
set total_price = 0
where component_type = 'insurance'
  and coalesce(booking_status::text, 'quoted') not in (
    'reserved',
    'confirmed',
    'pending_final_payment',
    'paid_in_full',
    'travel_complete'
  );

notify pgrst, 'reload schema';
