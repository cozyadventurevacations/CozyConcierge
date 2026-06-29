alter table public.trip_documents
  add column if not exists booking_extraction_status text,
  add column if not exists booking_extraction_json jsonb,
  add column if not exists booking_extraction_summary text,
  add column if not exists booking_extracted_at timestamptz;

create index if not exists trip_documents_booking_extraction_status_idx
  on public.trip_documents(booking_extraction_status);
