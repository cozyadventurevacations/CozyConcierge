-- Payment request document setup
-- Run this in Supabase SQL Editor before uploading receipts or authorization forms.

alter table public.trip_documents
  add column if not exists payment_request_id uuid null references public.payment_requests(id) on delete set null,
  add column if not exists payment_document_type text null,
  add column if not exists is_encrypted boolean not null default false,
  add column if not exists encryption_algorithm text null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trip_documents'::regclass
      and conname = 'trip_documents_payment_document_type_check'
  ) then
    alter table public.trip_documents
      drop constraint trip_documents_payment_document_type_check;
  end if;
end $$;

alter table public.trip_documents
  add constraint trip_documents_payment_document_type_check
  check (
    payment_document_type is null
    or payment_document_type in ('receipt', 'authorization_form', 'other')
  );

create index if not exists trip_documents_payment_request_id_idx
  on public.trip_documents(payment_request_id);

create index if not exists trip_documents_payment_document_type_idx
  on public.trip_documents(payment_document_type);

create index if not exists trip_documents_is_encrypted_idx
  on public.trip_documents(is_encrypted);

notify pgrst, 'reload schema';
