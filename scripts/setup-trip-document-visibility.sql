-- Trip document visibility setup
-- Run this in Supabase SQL Editor before using the Client, Agent & Travel Circle visibility option.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trip_documents'::regclass
      and conname = 'trip_documents_visibility_check'
  ) then
    alter table public.trip_documents
      drop constraint trip_documents_visibility_check;
  end if;
end $$;

alter table public.trip_documents
  add constraint trip_documents_visibility_check
  check (visibility in ('internal', 'client', 'travel_circle', 'client_travel_circle'));

notify pgrst, 'reload schema';
