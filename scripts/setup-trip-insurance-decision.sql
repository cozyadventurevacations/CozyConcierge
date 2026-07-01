alter table public.trips
  add column if not exists insurance_decision text,
  add column if not exists insurance_decision_at timestamptz,
  add column if not exists insurance_decision_by_client_account_id uuid references public.client_accounts(id) on delete set null;

create index if not exists trips_insurance_decision_idx
  on public.trips(insurance_decision);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trip_notes'::regclass
      and conname = 'trip_notes_note_type_check'
  ) then
    alter table public.trip_notes
      drop constraint trip_notes_note_type_check;
  end if;
end $$;

alter table public.trip_notes
  add constraint trip_notes_note_type_check
  check (note_type in ('internal', 'client', 'client_reminder', 'insurance_waiver'));
