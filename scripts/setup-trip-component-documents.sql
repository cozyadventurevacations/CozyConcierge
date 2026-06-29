alter table public.trip_documents
  add column if not exists component_id uuid references public.trip_components(id) on delete set null,
  add column if not exists component_type text,
  add column if not exists attach_to_commission boolean default false;

alter table public.commissions
  add column if not exists component_id uuid references public.trip_components(id) on delete set null,
  add column if not exists component_type text;

create index if not exists trip_documents_component_id_idx
  on public.trip_documents(component_id);

create index if not exists trip_documents_component_type_idx
  on public.trip_documents(component_type);

create index if not exists trip_documents_attach_to_commission_idx
  on public.trip_documents(attach_to_commission);

create index if not exists commissions_component_id_idx
  on public.commissions(component_id);

create index if not exists commissions_component_type_idx
  on public.commissions(component_type);
