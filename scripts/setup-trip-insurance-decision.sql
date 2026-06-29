alter table public.trips
  add column if not exists insurance_decision text,
  add column if not exists insurance_decision_at timestamptz,
  add column if not exists insurance_decision_by_client_account_id uuid references public.client_accounts(id) on delete set null;

create index if not exists trips_insurance_decision_idx
  on public.trips(insurance_decision);
