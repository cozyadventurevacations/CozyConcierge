create table if not exists public.trip_reminders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  reminder_type text not null default 'custom'
    check (reminder_type in ('custom', 'deposit', 'final_payment', 'document', 'task', 'other')),
  title text not null,
  notes text,
  reminder_date date not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_reminders_trip_id_idx
  on public.trip_reminders(trip_id);

create index if not exists trip_reminders_open_date_idx
  on public.trip_reminders(is_completed, reminder_date);

create or replace function public.set_trip_reminders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.is_completed = true and old.is_completed is distinct from true then
    new.completed_at = now();
  elsif new.is_completed = false then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_trip_reminders_updated_at on public.trip_reminders;
create trigger set_trip_reminders_updated_at
before update on public.trip_reminders
for each row
execute function public.set_trip_reminders_updated_at();

notify pgrst, 'reload schema';
