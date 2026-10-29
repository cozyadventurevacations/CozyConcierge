-- First run and commit add-package-component-type.sql.
alter table public.trip_components add column if not exists package_id uuid;
alter table public.trip_components add column if not exists deposit_amount numeric(12,2);
alter table public.trip_components add constraint trip_components_id_trip_unique unique(id,trip_id);
alter table public.trip_components add constraint trip_components_package_same_trip_fk foreign key(package_id,trip_id) references public.trip_components(id,trip_id) deferrable initially immediate;
create index if not exists trip_components_package_id_idx on public.trip_components(package_id) where package_id is not null;
create policy "Admins can remove package components" on public.trip_components for delete to authenticated using (
  component_type::text='package' and exists(select 1 from public.user_profiles where auth_user_id=auth.uid() and role::text='admin') and auth.jwt()->>'aal'='aal2'
);

create or replace function public.validate_trip_package_membership()
returns trigger language plpgsql security invoker set search_path='' as $function$
begin
  if new.package_id is not null then
    if new.component_type::text='package' or new.package_id=new.id then raise exception 'A package cannot be included in another package.'; end if;
    perform 1 from public.trip_components p where p.id=new.package_id and p.trip_id=new.trip_id and p.component_type::text='package' for key share;
    if not found then raise exception 'Choose a package saved on this trip.'; end if;
  end if;
  if tg_op='UPDATE' and (new.trip_id<>old.trip_id or new.component_type<>old.component_type) and exists(select 1 from public.trip_components c where c.package_id=old.id) then
    raise exception 'Detach package components before changing the package trip or type.';
  end if;
  return new;
end;
$function$;
revoke all on function public.validate_trip_package_membership() from public,anon,authenticated;
create trigger validate_trip_package_membership before insert or update of package_id,trip_id,component_type on public.trip_components for each row execute function public.validate_trip_package_membership();

create or replace function public.save_trip_packages(p_trip_id uuid,p_packages jsonb)
returns void language plpgsql security invoker set search_path='' as $function$
declare item jsonb; package_uuid uuid; ids uuid[] := '{}'; supplier_uuid uuid; supplier_title text; amount numeric; deposit numeric; commission numeric; title text;
begin
  if current_user<>'service_role' and not exists(select 1 from public.user_profiles where auth_user_id=auth.uid() and role::text='admin' and auth.jwt()->>'aal'='aal2') then
    raise exception 'Verified administrator access required.';
  end if;
  perform 1 from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Trip not found.'; end if;
  if p_packages is null or jsonb_typeof(p_packages)<>'array' or jsonb_array_length(p_packages)>20 then raise exception 'Submit a valid list of up to 20 packages.'; end if;
  for item in select value from jsonb_array_elements(p_packages) loop
    if jsonb_typeof(item)<>'object' then raise exception 'Invalid package.'; end if;
    package_uuid := (item->>'id')::uuid;
    if package_uuid is null or package_uuid=any(ids) then raise exception 'Package IDs must be unique.'; end if;
    ids := array_append(ids,package_uuid);
    title := btrim(item->>'display_name');
    if title is null or title='' or length(title)>200 then raise exception 'Enter a package name of 1 to 200 characters.'; end if;
    if coalesce(item->>'total_price','') !~ '^\d+(\.\d{1,2})?$' then raise exception 'Enter a valid nonnegative package price with at most two decimals.'; end if;
    amount := (item->>'total_price')::numeric;
    if amount>9999999999.99 then raise exception 'Package price is too large.'; end if;
    if coalesce(item->>'deposit_amount','')<>'' and item->>'deposit_amount' !~ '^\d+(\.\d{1,2})?$' then raise exception 'Enter a valid package deposit.'; end if;
    if coalesce(item->>'commission_admin_only','')<>'' and item->>'commission_admin_only' !~ '^\d+(\.\d{1,2})?$' then raise exception 'Enter a valid package commission.'; end if;
    deposit := nullif(item->>'deposit_amount','')::numeric;
    commission := coalesce(nullif(item->>'commission_admin_only','')::numeric,0);
    if deposit>amount then raise exception 'A package deposit cannot exceed its total price.'; end if;
    if coalesce(item->>'booking_status','') not in ('quoted','on_hold','reserved') then raise exception 'Choose a valid package booking status.'; end if;
    if exists(select 1 from public.trip_components where id=package_uuid and (trip_id<>p_trip_id or component_type::text<>'package')) then raise exception 'The package does not belong to this trip.'; end if;
    supplier_uuid := nullif(item->>'supplier_id','')::uuid;
    supplier_title := null;
    if supplier_uuid is not null then
      select supplier_name into supplier_title from public.suppliers where id=supplier_uuid;
      if not found then raise exception 'Package supplier not found.'; end if;
    end if;
    insert into public.trip_components(id,trip_id,component_type,display_name,supplier_id,supplier_name,confirmation_number,booking_status,total_price,deposit_amount,deposit_due_date,final_payment_due_date,commission_admin_only)
    values(package_uuid,p_trip_id,'package',title,supplier_uuid,supplier_title,nullif(left(btrim(item->>'confirmation_number'),100),''),(item->>'booking_status')::public.booking_status,amount,deposit,nullif(item->>'deposit_due_date','')::date,nullif(item->>'final_payment_due_date','')::date,commission)
    on conflict(id) do update set display_name=excluded.display_name,supplier_id=excluded.supplier_id,supplier_name=excluded.supplier_name,confirmation_number=excluded.confirmation_number,booking_status=excluded.booking_status,total_price=excluded.total_price,deposit_amount=excluded.deposit_amount,deposit_due_date=excluded.deposit_due_date,final_payment_due_date=excluded.final_payment_due_date,commission_admin_only=excluded.commission_admin_only;
  end loop;
  if exists(select 1 from public.trip_components c join public.trip_components p on p.id=c.package_id where p.trip_id=p_trip_id and p.component_type::text='package' and not(p.id=any(ids))) then
    raise exception 'Uncheck and save included components before removing their package.';
  end if;
  if exists(select 1 from public.commissions c join public.trip_components p on p.id=c.component_id where p.trip_id=p_trip_id and p.component_type::text='package' and not(p.id=any(ids))) then
    raise exception 'This package has commission records. Keep it or update those records before removing it.';
  end if;
  delete from public.trip_components where trip_id=p_trip_id and component_type::text='package' and not(id=any(ids));
end;
$function$;
revoke all on function public.save_trip_packages(uuid,jsonb) from public,anon;
grant execute on function public.save_trip_packages(uuid,jsonb) to authenticated,service_role;
notify pgrst, 'reload schema';
