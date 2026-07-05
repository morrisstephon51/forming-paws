create type public.health_doc_type as enum ('vet_exam', 'vaccination', 'ofa', 'dna_panel');
create type public.health_doc_status as enum ('unverified', 'pending_review', 'verified', 'rejected');

create table public.health_documents (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  storage_path text not null,
  doc_type public.health_doc_type not null,
  document_date date not null,
  status public.health_doc_status not null default 'pending_review',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_notes text
);

alter table public.health_documents enable row level security;

create policy "health_documents_select_own" on public.health_documents
  for select using (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "health_documents_insert_own" on public.health_documents
  for insert with check (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "health_documents_admin_select_all" on public.health_documents
  for select using (
    exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
  );

create policy "health_documents_admin_update" on public.health_documents
  for update using (
    exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
  );

insert into storage.buckets (id, name, public) values ('health-docs', 'health-docs', false)
on conflict (id) do nothing;

create policy "health_docs_storage_owner_access" on storage.objects
  for select using (
    bucket_id = 'health-docs'
    and (
      exists (
        select 1 from public.dogs d
        where d.owner_id = auth.uid() and (storage.foldername(name))[1] = d.id::text
      )
      or exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
    )
  );

create policy "health_docs_storage_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'health-docs'
    and exists (
      select 1 from public.dogs d
      where d.owner_id = auth.uid() and (storage.foldername(name))[1] = d.id::text
    )
  );
