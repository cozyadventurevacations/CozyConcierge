-- Phase 2: deploy /auth/mfa and verify it is reachable before applying.
create or replace function private.is_admin_identity() returns boolean language sql stable security definer set search_path = '' as $function$
select exists(select 1 from public.user_profiles where auth_user_id=auth.uid() and lower(role::text) in ('admin','owner','administrator'))
$function$;
revoke all on function private.is_admin_identity() from public;
grant execute on function private.is_admin_identity() to anon, authenticated, service_role;

create or replace function private.current_user_is_admin() returns boolean language sql stable security definer set search_path = '' as $function$
select private.is_admin_identity() and coalesce(auth.jwt()->>'aal','aal1')='aal2'
$function$;

-- Restrictive policies also cover older policies with inline admin role checks.
-- Own profile remains readable at AAL1 so enrollment can determine the role.
do $block$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'user_profiles'
 loop
   execute format('drop policy if exists require_admin_mfa on public.%I',t.tablename);
   execute format('create policy require_admin_mfa on public.%I as restrictive for all to authenticated using (not private.is_admin_identity() or (auth.jwt()->>''aal'')=''aal2'') with check (not private.is_admin_identity() or (auth.jwt()->>''aal'')=''aal2'')',t.tablename);
 end loop;
end $block$;
drop policy if exists require_admin_mfa on storage.objects;
create policy require_admin_mfa on storage.objects as restrictive for all to authenticated
 using (not private.is_admin_identity() or (auth.jwt()->>'aal')='aal2')
 with check (not private.is_admin_identity() or (auth.jwt()->>'aal')='aal2');
