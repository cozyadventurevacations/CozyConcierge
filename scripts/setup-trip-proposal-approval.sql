alter table public.trip_proposals
  add column if not exists proposal_status text not null default 'draft',
  add column if not exists client_visible boolean not null default false,
  add column if not exists client_decision text,
  add column if not exists client_decision_at timestamptz,
  add column if not exists client_decision_by_client_account_id uuid references public.client_accounts(id) on delete set null,
  add column if not exists client_response_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_proposals_proposal_status_check'
      and conrelid = 'public.trip_proposals'::regclass
  ) then
    alter table public.trip_proposals
      add constraint trip_proposals_proposal_status_check
      check (proposal_status in ('draft', 'sent', 'approved', 'declined'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_proposals_client_decision_check'
      and conrelid = 'public.trip_proposals'::regclass
  ) then
    alter table public.trip_proposals
      add constraint trip_proposals_client_decision_check
      check (client_decision is null or client_decision in ('approved', 'declined'));
  end if;
end $$;

create index if not exists trip_proposals_client_visible_idx
  on public.trip_proposals(client_visible);

create index if not exists trip_proposals_client_decision_idx
  on public.trip_proposals(client_decision);
