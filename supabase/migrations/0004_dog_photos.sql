create table public.dog_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.dog_photos enable row level security;

create policy "dog_photos_select_own" on public.dog_photos
  for select using (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "dog_photos_insert_own" on public.dog_photos
  for insert with check (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "dog_photos_delete_own" on public.dog_photos
  for delete using (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

insert into storage.buckets (id, name, public) values ('dog-photos', 'dog-photos', false)
on conflict (id) do nothing;

create policy "dog_photos_storage_owner_access" on storage.objects
  for all using (
    bucket_id = 'dog-photos'
    and exists (
      select 1 from public.dogs d
      where d.owner_id = auth.uid()
        and (storage.foldername(name))[1] = d.id::text
    )
  );
