-- supabase/migrations/0017_prevent_dog_interests_self_match.sql

-- Prevents an owner from expressing interest toward their own other dog
-- (both dogs owned by the same caller). Found during a whole-codebase
-- review: without this, an owner could create a self-match by expressing
-- reciprocal interest between two of their own dogs.
drop policy "dog_interests_insert_own_verified" on public.dog_interests;
create policy "dog_interests_insert_own_verified" on public.dog_interests
  for insert with check (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    and public.dog_is_baseline_verified(expressing_dog_id)
    and not exists (select 1 from public.dogs d2 where d2.id = target_dog_id and d2.owner_id = auth.uid())
  );
