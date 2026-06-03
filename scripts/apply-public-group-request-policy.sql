-- Apply this in Supabase SQL Editor if group travel was already set up.
-- It keeps public group landing pages open, but only allows anonymous
-- interest-list submissions for public groups that are still accepting requests.

drop policy if exists "Public can request group registration"
on public.travel_group_participants;

create policy "Public can request group registration"
on public.travel_group_participants
for insert
with check (
  status = 'interested'
  and client_account_id is null
  and exists (
    select 1
    from public.travel_groups tg
    where tg.id = group_id
    and tg.visibility = 'public'
    and tg.status not in ('archived', 'closed')
  )
);
