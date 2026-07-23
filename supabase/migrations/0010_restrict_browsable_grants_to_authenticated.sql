-- Task 2 review found dogs_browsable, the dog-photos storage SELECT policy,
-- and browse_dogs/dog_is_baseline_verified were all reachable by the fully
-- unauthenticated `anon` role — Supabase grants table/EXECUTE privileges to
-- anon/authenticated by default at object-creation time, and the additive
-- `grant ... to authenticated` in migration 0009 never revoked that. Verified
-- live via `set role anon` before this fix: dogs_browsable returned real
-- rows, dog_is_baseline_verified returned real (non-RLS-masked) answers.

revoke select on public.dogs_browsable from anon, public;
grant select on public.dogs_browsable to authenticated;

revoke execute on function public.browse_dogs from anon, public;
grant execute on function public.browse_dogs to authenticated;

revoke execute on function public.dog_is_baseline_verified from anon, public;
grant execute on function public.dog_is_baseline_verified to authenticated;

drop policy "dog_photos_storage_browsable_select" on storage.objects;
create policy "dog_photos_storage_browsable_select" on storage.objects
  for select to authenticated using (bucket_id = 'dog-photos');
