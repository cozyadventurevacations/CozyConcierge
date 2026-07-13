create table if not exists public.email_automation_settings (
  email_type text primary key,
  enabled boolean not null default true,
  subject_override text,
  custom_note text,
  updated_at timestamptz not null default now()
);

alter table public.email_automation_settings enable row level security;

drop policy if exists "Admin can manage email automation settings" on public.email_automation_settings;
create policy "Admin can manage email automation settings"
on public.email_automation_settings
for all
using (current_user_is_admin())
with check (current_user_is_admin());

insert into public.email_automation_settings (email_type, enabled)
values
  ('deposit_due_10_day', true),
  ('final_payment_10_day', true),
  ('pre_travel_30_day', true),
  ('pre_travel_7_day', true),
  ('post_travel_7_day', true),
  ('post_travel_60_day', true),
  ('birthday', true),
  ('anniversary', true),
  ('passport_expiry_6mo', true)
on conflict (email_type) do nothing;

create or replace function public.set_email_automation_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_email_automation_settings_updated_at on public.email_automation_settings;
create trigger set_email_automation_settings_updated_at
before update on public.email_automation_settings
for each row
execute function public.set_email_automation_settings_updated_at();
