-- Fix column-shadowing bug in storage.objects RLS policies.
--
-- The original policies (0004_dog_photos.sql, 0005_health_documents.sql)
-- referenced a bare `name` inside `(storage.foldername(name))[1]` within an
-- `exists (select 1 from public.dogs d where ...)` subquery. Because
-- `public.dogs` has its own `name` column (the dog's name), Postgres's
-- subquery scoping resolves the unqualified `name` to `d.name`, not the
-- intended `storage.objects.name` (the file path) — confirmed live via
-- `pg_policies`, which showed `storage.foldername(d.name)`. Since a dog's
-- name never matches a `<uuid>/...` path, every owner-scoped check always
-- evaluated false: no owner could ever upload or read their own file.
--
-- Fix: explicitly qualify the storage.objects column as `objects.name`.

drop policy "dog_photos_storage_owner_access" on storage.objects;
create policy "dog_photos_storage_owner_access" on storage.objects
  for all using (
    bucket_id = 'dog-photos'
    and exists (
      select 1 from public.dogs d
      where d.owner_id = auth.uid()
        and (storage.foldername(objects.name))[1] = d.id::text
    )
  );

drop policy "health_docs_storage_owner_access" on storage.objects;
create policy "health_docs_storage_owner_access" on storage.objects
  for select using (
    bucket_id = 'health-docs'
    and (
      exists (
        select 1 from public.dogs d
        where d.owner_id = auth.uid() and (storage.foldername(objects.name))[1] = d.id::text
      )
      or exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
    )
  );

drop policy "health_docs_storage_owner_insert" on storage.objects;
create policy "health_docs_storage_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'health-docs'
    and exists (
      select 1 from public.dogs d
      where d.owner_id = auth.uid() and (storage.foldername(objects.name))[1] = d.id::text
    )
  );
