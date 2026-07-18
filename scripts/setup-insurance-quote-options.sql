alter table public.insurance_components
  add column if not exists quote_options jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
