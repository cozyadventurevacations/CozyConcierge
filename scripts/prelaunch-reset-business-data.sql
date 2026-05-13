-- Pre-launch data reset for Cozy Concierge.
--
-- Purpose:
--   Clears test business data before going live while keeping the database schema,
--   auth configuration, RLS policies, and app settings intact.
--
-- What this clears:
--   Clients, trips, travel requests, suppliers, commissions, messages, Ask Cozy
--   conversations, uploaded document records, traveler profiles, Travel Circle
--   records, payment requests, payment ledger entries, trip components, and notes.
--
-- What this does NOT clear:
--   Supabase Auth users, user_profiles, storage files, environment variables,
--   RLS policies, or application code.
--
-- Run this in Supabase SQL Editor only when you are ready to wipe test data.

DO $$
DECLARE
  table_names text[] := ARRAY[
    'ask_cozy_messages',
    'ask_cozy_threads',
    'messages',
    'message_threads',
    'trip_member_invites',
    'trip_members',
    'payment_requests',
    'email_automation_log',
    'trip_payment_ledger',
    'trip_milestones',
    'trip_notes',
    'flight_segments',
    'air_components',
    'hotel_components',
    'cruise_components',
    'transfer_components',
    'activity_components',
    'insurance_components',
    'trip_components',
    'trip_client_documents',
    'trip_documents',
    'client_documents',
    'traveler_loyalty_numbers',
    'traveler_profiles',
    'commissions',
    'quote_requests',
    'trips',
    'client_notes',
    'supplier_phone_numbers',
    'suppliers',
    'client_accounts'
  ];
  existing_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', table_schema, table_name), ', ')
  INTO existing_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name = ANY(table_names);

  IF existing_tables IS NULL THEN
    RAISE NOTICE 'No matching Cozy Concierge business tables found.';
    RETURN;
  END IF;

  EXECUTE 'TRUNCATE TABLE ' || existing_tables || ' RESTART IDENTITY CASCADE';
  RAISE NOTICE 'Pre-launch business data reset complete.';
END $$;
