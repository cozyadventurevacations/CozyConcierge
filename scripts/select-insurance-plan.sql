alter table public.insurance_components
  add column if not exists selected_option_number integer
  check (selected_option_number between 1 and 3);

-- Service-only transaction. The server supplies the authenticated client's ID.
create or replace function public.select_trip_insurance_plan(
  p_trip_id uuid, p_client_account_id uuid, p_option_number integer, p_expected_premium numeric
) returns void language plpgsql security invoker set search_path = '' as $function$
declare component public.trip_components; detail public.insurance_components; chosen jsonb; amount numeric;
begin
  if p_option_number is null or p_option_number not between 1 and 3 then raise exception 'Choose a valid insurance plan.'; end if;
  perform 1 from public.trips where id=p_trip_id and client_account_id=p_client_account_id and deleted_at is null for update;
  if not found then raise exception 'Only the primary client can select insurance for this trip.'; end if;
  select * into strict component from public.trip_components where trip_id=p_trip_id and component_type='insurance' for update;
  select * into strict detail from public.insurance_components where component_id=component.id for update;
  if component.booking_status::text in ('reserved','confirmed','pending_final_payment','paid_in_full','travel_complete','cancelled') then
    raise exception 'Contact your advisor to change a booked or cancelled insurance plan.';
  end if;
  select value into chosen from jsonb_array_elements(detail.quote_options) where value->>'option_number'=p_option_number::text;
  -- Older trips may have one plan stored directly, without a quote array.
  if chosen is null and detail.quote_options='[]'::jsonb and p_option_number = (case
    when detail.plan_name='Latitude Plan' then 2 when detail.plan_name='Classic Plan with Cancel Anytime' then 3 else 1 end) then
    chosen := to_jsonb(detail);
  end if;
  if chosen is null or coalesce(chosen->>'premium_amount','') !~ '^\d+(\.\d+)?$' then
    raise exception 'This insurance quote is not available. Contact your advisor.';
  end if;
  amount := round((chosen->>'premium_amount')::numeric,2);
  if p_expected_premium is null or p_expected_premium <> amount then raise exception 'This quote changed. Refresh the trip and review the current premium.'; end if;
  update public.insurance_components set selected_option_number=p_option_number,
    provider_name=chosen->>'provider_name', plan_name=chosen->>'plan_name', premium_amount=amount,
    coverage_description=chosen->>'coverage_description'
  where component_id=component.id;
  update public.trip_components set display_name=chosen->>'plan_name', supplier_name=chosen->>'provider_name', total_price=0
  where id=component.id;
end;
$function$;
revoke all on function public.select_trip_insurance_plan(uuid,uuid,integer,numeric) from public,anon,authenticated;
grant execute on function public.select_trip_insurance_plan(uuid,uuid,integer,numeric) to service_role;
notify pgrst, 'reload schema';
