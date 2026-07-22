-- Harden user_profiles permissions and sensitive-field protection.
-- Applied to Supabase project phvnfulmmplbmfgtjfuj as migration:
-- harden_user_profiles_client_writes

revoke all on table public.user_profiles from anon;
revoke update, delete, truncate, references, trigger on table public.user_profiles from authenticated;

grant select, insert on table public.user_profiles to authenticated;

drop policy if exists "users can view their own user profile" on public.user_profiles;
drop policy if exists "Users can read own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  -- Database/service roles are used by admin tooling and server-side service-role routes.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  -- Defense in depth if UPDATE is ever re-granted: browser/API users cannot alter
  -- authorization or account-linking fields on their profile row.
  if new.role is distinct from old.role
     or new.auth_user_id is distinct from old.auth_user_id
     or new.status is distinct from old.status then
    raise exception 'You are not allowed to change protected user profile fields.';
  end if;

  return new;
end;
$$;
