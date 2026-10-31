-- Host-provided URLs only. No card data is collected or stored by this feature.
-- Align the database with the existing payment-request close buttons.
alter type public.payment_request_status add value if not exists 'cancelled';
alter type public.payment_request_status add value if not exists 'declined';

alter table public.payment_requests
  add column if not exists payment_link_url text,
  add column if not exists payment_link_shared_at timestamptz;

alter table public.payment_requests add constraint payment_requests_https_paylink
  check (payment_link_url is null or (length(payment_link_url) between 9 and 8192 and payment_link_url ~* '^https://[^[:space:]]+$'));
alter table public.payment_requests add constraint payment_requests_paylink_shared_at
  check ((payment_link_url is null) = (payment_link_shared_at is null));

create or replace function public.guard_host_payment_link()
returns trigger language plpgsql security invoker set search_path='' as $function$
declare changed boolean;
begin
  if tg_op='INSERT' then
    changed := new.payment_link_url is not null or new.payment_link_shared_at is not null;
  else
    changed := new.payment_link_url is distinct from old.payment_link_url or new.payment_link_shared_at is distinct from old.payment_link_shared_at;
  end if;
  if changed then
    if current_user not in ('service_role','postgres','supabase_admin') and not exists (
      select 1 from public.user_profiles where auth_user_id=auth.uid() and role::text='admin' and auth.jwt()->>'aal'='aal2'
    ) then
      raise exception 'Only verified administrators can share or change host paylinks.';
    end if;
    new.payment_link_shared_at := case when new.payment_link_url is null then null else now() end;
  end if;
  return new;
end;
$function$;
revoke all on function public.guard_host_payment_link() from public,anon,authenticated;
create trigger guard_host_payment_link before insert or update of payment_link_url,payment_link_shared_at
  on public.payment_requests for each row execute function public.guard_host_payment_link();
notify pgrst, 'reload schema';
