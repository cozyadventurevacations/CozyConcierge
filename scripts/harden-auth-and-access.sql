-- Security phase 1: trusted identity, service-only maintenance, durable quotas.
-- Apply before deploying the accompanying application code.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_user_is_admin() returns boolean language sql stable security definer set search_path = '' as $function$
select exists(select 1 from public.user_profiles where auth_user_id=auth.uid() and lower(role::text) in ('admin','owner','administrator'))
$function$;
create or replace function private.current_client_account_id() returns uuid language sql stable security definer set search_path = '' as $function$
select ca.id from public.client_accounts ca join public.user_profiles up on up.id=ca.user_profile_id
where up.auth_user_id=auth.uid() limit 1
$function$;
create or replace function public.current_client_account_id() returns uuid language sql stable security invoker set search_path = '' as $function$ select private.current_client_account_id() $function$;
revoke all on function private.current_client_account_id() from public;
grant execute on function private.current_client_account_id() to anon, authenticated, service_role;
revoke all on function public.current_client_account_id() from public;
grant execute on function public.current_client_account_id() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_can_access_trip(check_trip_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    private.current_user_is_admin()
    or exists (
      select 1
      from public.trips t
      where t.id = check_trip_id
        and t.client_account_id = private.current_client_account_id()
    )
    or exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = check_trip_id
        and tm.client_account_id = private.current_client_account_id()
        and tm.invite_status = 'active'
        and tm.can_view_trip = true
    );
$function$
;
create or replace function public.current_user_can_access_trip(check_trip_id uuid) returns boolean language sql stable security invoker set search_path = '' as $function$ select private.current_user_can_access_trip(check_trip_id) $function$;
revoke all on function private.current_user_can_access_trip(uuid) from public;
grant execute on function private.current_user_can_access_trip(uuid) to anon, authenticated, service_role;
revoke all on function public.current_user_can_access_trip(uuid) from public;
grant execute on function public.current_user_can_access_trip(uuid) to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
    and lower(coalesce(role::text, '')) in ('admin', 'owner', 'administrator')
  );
$function$
;
create or replace function public.current_user_is_admin() returns boolean language sql stable security invoker set search_path = '' as $function$ select private.current_user_is_admin() $function$;
revoke all on function private.current_user_is_admin() from public;
grant execute on function private.current_user_is_admin() to anon, authenticated, service_role;
revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_profile_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select id
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1
$function$
;
create or replace function public.current_user_profile_id() returns uuid language sql stable security invoker set search_path = '' as $function$ select private.current_user_profile_id() $function$;
revoke all on function private.current_user_profile_id() from public;
grant execute on function private.current_user_profile_id() to anon, authenticated, service_role;
revoke all on function public.current_user_profile_id() from public;
grant execute on function public.current_user_profile_id() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_current_client_account(target_client_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select target_client_account_id = private.current_client_account_id()
$function$
;
create or replace function public.is_current_client_account(target_client_account_id uuid) returns boolean language sql stable security invoker set search_path = '' as $function$ select private.is_current_client_account(target_client_account_id) $function$;
revoke all on function private.is_current_client_account(uuid) from public;
grant execute on function private.is_current_client_account(uuid) to anon, authenticated, service_role;
revoke all on function public.is_current_client_account(uuid) from public;
grant execute on function public.is_current_client_account(uuid) to anon, authenticated, service_role;

alter policy "Clients can read their own Ask Cozy threads" on public.ask_cozy_threads using (private.is_current_client_account(client_account_id));
alter policy "Clients can insert their own Ask Cozy threads" on public.ask_cozy_threads with check (private.is_current_client_account(client_account_id));
alter policy "Clients can update their own Ask Cozy threads" on public.ask_cozy_threads using (private.is_current_client_account(client_account_id)) with check (private.is_current_client_account(client_account_id));
alter policy "Clients can delete their own Ask Cozy threads" on public.ask_cozy_threads using (private.is_current_client_account(client_account_id));
alter policy "Clients can read their own Ask Cozy messages" on public.ask_cozy_messages using (private.is_current_client_account(client_account_id));
alter policy "Clients can insert their own Ask Cozy messages" on public.ask_cozy_messages with check (private.is_current_client_account(client_account_id));
alter policy "Clients can delete their own Ask Cozy messages" on public.ask_cozy_messages using (private.is_current_client_account(client_account_id));
alter policy "Clients can search client accounts for invite autofill" on public.client_accounts using ((private.is_current_client_account(id) OR private.current_user_is_admin()));

alter function public.prevent_self_role_escalation() security invoker;
alter function public.set_trip_reminders_updated_at() set search_path = '';
alter function public.set_ask_cozy_thread_updated_at() security invoker;
revoke all on function public.cleanup_expired_ask_cozy_threads() from public, anon, authenticated;
grant execute on function public.cleanup_expired_ask_cozy_threads() to service_role;
revoke all on function public.prevent_self_role_escalation(), public.rls_auto_enable(), public.set_ask_cozy_thread_updated_at(), public.set_trip_reminders_updated_at() from public, anon, authenticated;

create table if not exists private.security_rate_limits (
  scope text not null, actor_hash text not null,
  attempts integer not null, expires_at timestamptz not null,
  primary key(scope, actor_hash)
);
alter table private.security_rate_limits enable row level security;
create index if not exists security_rate_limits_expiry_idx on private.security_rate_limits(expires_at);
revoke all on table private.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_security_rate_limit(p_scope text, p_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare entry private.security_rate_limits; now_at timestamptz := clock_timestamp();
begin
  if p_scope is null or length(p_scope)>100 or p_key is null or p_key !~ '^[a-f0-9]{64}$'
     or p_limit is null or p_limit<1 or p_limit>100000 or p_window_seconds is null or p_window_seconds<1 or p_window_seconds>86400 then
    raise exception 'Invalid request limit.';
  end if;
  -- Bounded cleanup prevents expired IP/account keys accumulating indefinitely.
  delete from private.security_rate_limits where ctid in
    (select ctid from private.security_rate_limits where expires_at < now_at limit 100);
  insert into private.security_rate_limits as r(scope,actor_hash,attempts,expires_at)
  values(p_scope,p_key,1,now_at+make_interval(secs=>p_window_seconds))
  on conflict(scope,actor_hash) do update set
    attempts=case when r.expires_at<=now_at then 1 else least(r.attempts+1,p_limit+1) end,
    expires_at=case when r.expires_at<=now_at then now_at+make_interval(secs=>p_window_seconds) else r.expires_at end
  returning * into entry;
  return jsonb_build_object('allowed',entry.attempts<=p_limit,'retry_after',greatest(1,ceil(extract(epoch from entry.expires_at-now_at))::integer));
end
$function$;
revoke all on function public.consume_security_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text,text,integer,integer) to service_role;

-- Called only by the server after a successful email OTP/PKCE exchange.
-- Existing confirmed sessions alone never trigger email-based account linking.
create or replace function public.complete_client_registration(p_auth_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare u auth.users; profile_id uuid; profile_role text; account_id uuid; matches integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text,0));
  select * into u from auth.users where id=p_auth_user_id and email_confirmed_at is not null;
  if not found then raise exception 'Email verification required.'; end if;
  select id,role::text into profile_id,profile_role from public.user_profiles where auth_user_id=u.id;
  if profile_id is null then
    insert into public.user_profiles(auth_user_id,email,role) values(u.id,lower(u.email),'client') returning id into profile_id;
    profile_role := 'client';
  end if;
  if profile_role<>'client' then return null; end if;
  select id into account_id from public.client_accounts where user_profile_id=profile_id;
  if account_id is not null then return account_id; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(u.email),1));
  select count(*) into matches from public.client_accounts where lower(email)=lower(u.email);
  if matches>1 then raise exception 'Advisor assistance required to link this account.'; end if;
  select id into account_id from public.client_accounts where lower(email)=lower(u.email) and user_profile_id is null for update;
  if account_id is not null then
    update public.client_accounts set user_profile_id=profile_id where id=account_id;
  elsif matches>0 then
    raise exception 'Account is already linked. Contact your advisor.';
  else
    insert into public.client_accounts(user_profile_id,first_name,last_name,email,phone_primary)
    values(profile_id,coalesce(nullif(left(u.raw_user_meta_data->>'first_name',100),''),'Traveler'),
      coalesce(nullif(left(u.raw_user_meta_data->>'last_name',100),''),''),lower(u.email),left(u.raw_user_meta_data->>'phone_primary',50))
    returning id into account_id;
  end if;
  return account_id;
end
$function$;
revoke all on function public.complete_client_registration(uuid) from public, anon, authenticated;
grant execute on function public.complete_client_registration(uuid) to service_role;

update storage.buckets set public=false, file_size_limit=15728640,
 allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id in ('client-documents','private-documents');
update storage.buckets set public=false, file_size_limit=26214400,
 allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream','text/html']
where id='trip-documents';

-- Custom reminders are an admin-only feature; the old setup script enabled RLS without a policy.
drop policy if exists "Admins can manage custom trip reminders" on public.trip_reminders;
create policy "Admins can manage custom trip reminders" on public.trip_reminders for all to authenticated
 using (private.current_user_is_admin()) with check (private.current_user_is_admin());
grant select, insert, update, delete on public.trip_reminders to authenticated;
