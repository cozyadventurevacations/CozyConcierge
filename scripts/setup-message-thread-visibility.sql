-- Message thread visibility setup
-- This lets admins and individual clients hide a conversation from their own inbox
-- without deleting the thread or hiding it from the other side.

create table if not exists public.message_thread_hidden_states (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  actor_key text not null,
  hidden_by_role text not null check (hidden_by_role in ('admin', 'client')),
  client_account_id uuid null references public.client_accounts(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists message_thread_hidden_states_actor_thread_idx
  on public.message_thread_hidden_states(thread_id, actor_key);

create index if not exists message_thread_hidden_states_actor_key_idx
  on public.message_thread_hidden_states(actor_key);

alter table public.message_thread_hidden_states enable row level security;

drop policy if exists "Admins can manage message thread hidden states"
  on public.message_thread_hidden_states;

create policy "Admins can manage message thread hidden states"
  on public.message_thread_hidden_states
  for all
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.auth_user_id = auth.uid()
        and up.role = 'admin'::app_role
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.auth_user_id = auth.uid()
        and up.role = 'admin'::app_role
    )
  );

drop policy if exists "Clients can manage their own message thread hidden states"
  on public.message_thread_hidden_states;

create policy "Clients can manage their own message thread hidden states"
  on public.message_thread_hidden_states
  for all
  using (
    hidden_by_role = 'client'
    and client_account_id in (
      select ca.id
      from public.client_accounts ca
      join public.user_profiles up on up.id = ca.user_profile_id
      where up.auth_user_id = auth.uid()
    )
    and actor_key = 'client:' || client_account_id::text
  )
  with check (
    hidden_by_role = 'client'
    and client_account_id in (
      select ca.id
      from public.client_accounts ca
      join public.user_profiles up on up.id = ca.user_profile_id
      where up.auth_user_id = auth.uid()
    )
    and actor_key = 'client:' || client_account_id::text
  );

grant select, insert, update, delete on public.message_thread_hidden_states to authenticated;
