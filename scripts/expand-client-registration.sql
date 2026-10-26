-- Expand registration profile persistence after verified email ownership.
-- The function remains service-role only. Metadata supplies personal fields only.
create or replace function public.complete_client_registration(p_auth_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare
  u auth.users; profile_id uuid; profile_role text; account_id uuid; matches integer;
  incoming jsonb := '{}'::jsonb; field_name text; field_limit integer; field_value text;
  details public.client_accounts;
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
  -- Never reapply registration answers over later profile edits.
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
    insert into public.client_accounts(user_profile_id,first_name,last_name,email)
    values(profile_id,coalesce(nullif(left(u.raw_user_meta_data->>'first_name',100),''),'Traveler'),
      coalesce(nullif(left(u.raw_user_meta_data->>'last_name',100),''),''),lower(u.email))
    returning id into account_id;
  end if;

  -- User-editable metadata must never supply role, IDs, email, or passport data.
  for field_name, field_limit in select key, value::integer from jsonb_each_text('{"first_name":100,"middle_name":100,"last_name":100,"preferred_name":100,"phone_primary":50,"phone_secondary":50,"address_line_1":200,"address_line_2":200,"city":100,"state":100,"postal_code":20,"preferred_airport":200,"travel_style":500,"airline_seating_preference":100,"airline_class_preference":100,"cruise_cabin_preference":100,"travel_preference_notes":2000,"accessibility_notes":2000,"food_allergies":2100,"emergency_contact_name":200,"emergency_contact_relationship":100,"emergency_contact_phone":50,"notes":2000}'::jsonb)
  loop
    if jsonb_typeof(u.raw_user_meta_data->field_name) = 'string' then
      field_value := nullif(btrim(left(u.raw_user_meta_data->>field_name,field_limit)), '');
      incoming := incoming || jsonb_build_object(field_name,field_value);
    end if;
  end loop;
  foreach field_name in array array['date_of_birth','anniversary_date'] loop
    field_value := u.raw_user_meta_data->>field_name;
    if field_value ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(field_value,'date') then
      if field_name <> 'date_of_birth' or field_value::date <= current_date then
        incoming := incoming || jsonb_build_object(field_name,field_value);
      end if;
    end if;
  end loop;
  foreach field_name in array array['notify_new_messages','notify_payment_reminders','notify_trip_updates','notify_travel_circle_invites'] loop
    if jsonb_typeof(u.raw_user_meta_data->field_name) = 'boolean' then
      incoming := incoming || jsonb_build_object(field_name,u.raw_user_meta_data->field_name);
    end if;
  end loop;
  details := jsonb_populate_record(null::public.client_accounts,incoming);
  -- Fill blanks in advisor-created profiles; retain information already on file.
  update public.client_accounts c set
    first_name = coalesce(nullif(btrim(c.first_name),''), details.first_name, c.first_name),
    middle_name = coalesce(nullif(btrim(c.middle_name),''), details.middle_name, c.middle_name),
    last_name = coalesce(nullif(btrim(c.last_name),''), details.last_name, c.last_name),
    preferred_name = coalesce(nullif(btrim(c.preferred_name),''), details.preferred_name, c.preferred_name),
    phone_primary = coalesce(nullif(btrim(c.phone_primary),''), details.phone_primary, c.phone_primary),
    phone_secondary = coalesce(nullif(btrim(c.phone_secondary),''), details.phone_secondary, c.phone_secondary),
    address_line_1 = coalesce(nullif(btrim(c.address_line_1),''), details.address_line_1, c.address_line_1),
    address_line_2 = coalesce(nullif(btrim(c.address_line_2),''), details.address_line_2, c.address_line_2),
    city = coalesce(nullif(btrim(c.city),''), details.city, c.city),
    state = coalesce(nullif(btrim(c.state),''), details.state, c.state),
    postal_code = coalesce(nullif(btrim(c.postal_code),''), details.postal_code, c.postal_code),
    preferred_airport = coalesce(nullif(btrim(c.preferred_airport),''), details.preferred_airport, c.preferred_airport),
    travel_style = coalesce(nullif(btrim(c.travel_style),''), details.travel_style, c.travel_style),
    airline_seating_preference = coalesce(nullif(btrim(c.airline_seating_preference),''), details.airline_seating_preference, c.airline_seating_preference),
    airline_class_preference = coalesce(nullif(btrim(c.airline_class_preference),''), details.airline_class_preference, c.airline_class_preference),
    cruise_cabin_preference = coalesce(nullif(btrim(c.cruise_cabin_preference),''), details.cruise_cabin_preference, c.cruise_cabin_preference),
    travel_preference_notes = coalesce(nullif(btrim(c.travel_preference_notes),''), details.travel_preference_notes, c.travel_preference_notes),
    accessibility_notes = coalesce(nullif(btrim(c.accessibility_notes),''), details.accessibility_notes, c.accessibility_notes),
    food_allergies = coalesce(nullif(btrim(c.food_allergies),''), details.food_allergies, c.food_allergies),
    emergency_contact_name = coalesce(nullif(btrim(c.emergency_contact_name),''), details.emergency_contact_name, c.emergency_contact_name),
    emergency_contact_relationship = coalesce(nullif(btrim(c.emergency_contact_relationship),''), details.emergency_contact_relationship, c.emergency_contact_relationship),
    emergency_contact_phone = coalesce(nullif(btrim(c.emergency_contact_phone),''), details.emergency_contact_phone, c.emergency_contact_phone),
    notes = coalesce(nullif(btrim(c.notes),''), details.notes, c.notes),
    date_of_birth = coalesce(c.date_of_birth,details.date_of_birth),
    anniversary_date = coalesce(c.anniversary_date,details.anniversary_date),
    notify_new_messages = coalesce(details.notify_new_messages,c.notify_new_messages),
    notify_payment_reminders = coalesce(details.notify_payment_reminders,c.notify_payment_reminders),
    notify_trip_updates = coalesce(details.notify_trip_updates,c.notify_trip_updates),
    notify_travel_circle_invites = coalesce(details.notify_travel_circle_invites,c.notify_travel_circle_invites),
    notification_preferences_updated_at = case when incoming ? 'notify_new_messages' then now() else c.notification_preferences_updated_at end
  where c.id=account_id;
  return account_id;
end
$function$;
revoke all on function public.complete_client_registration(uuid) from public, anon, authenticated;
grant execute on function public.complete_client_registration(uuid) to service_role;
