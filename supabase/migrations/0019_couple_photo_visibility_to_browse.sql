-- Couple dog-photo visibility to the browse surface.
--
-- NOT a fix for a live leak. `dogs_browsable` is currently `dogs JOIN breeds`
-- with no filter, so every dog is browsable, and photos being readable by any
-- signed-in member matches how /browse already works. Verified before writing
-- this: 5 dogs, 5 browsable, 0 photo rows, 0 stored files.
--
-- The problem is that neither policy expresses any *relationship* to
-- browsability:
--   * public.dog_photos          -> USING (true)
--   * storage.objects            -> bucket_id = 'dog-photos'
-- The first exposes every row including storage_path; the second serves every
-- file to anyone who has a path. So the moment dogs_browsable grows a filter
-- (verified-only, or a hidden/paused flag -- both plausible in later slices),
-- these policies will silently fail to follow it, and photos of dogs that are
-- no longer discoverable will keep being served. Restating them in terms of
-- dogs_browsable makes that coupling automatic instead of a thing someone has
-- to remember.
--
-- The owner-scoped policies are deliberately untouched:
--   * public.dog_photos.dog_photos_select_own
--   * storage.objects.dog_photos_storage_owner_access
-- They are what lets an owner see their own dog's photos, and they must keep
-- working independently of whether that dog is browsable. Policies are OR'd,
-- so narrowing only the browsable pair is sufficient and safe.

drop policy if exists dog_photos_select_browsable on public.dog_photos;

create policy dog_photos_select_browsable
  on public.dog_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dogs_browsable b
      where b.id = dog_photos.dog_id
    )
  );

drop policy if exists "dog_photos_storage_browsable_select" on storage.objects;

-- Upload paths are written as `${dogId}/${uuid}.${ext}` by
-- app/api/upload/photo/route.ts, so folder segment 1 is the dog id. The
-- storage.foldername() idiom matches the existing owner policy.
create policy "dog_photos_storage_browsable_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'dog-photos'
    and exists (
      select 1
      from public.dogs_browsable b
      where b.id::text = (storage.foldername(objects.name))[1]
    )
  );
