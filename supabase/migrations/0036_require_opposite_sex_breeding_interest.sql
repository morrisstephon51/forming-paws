-- supabase/migrations/0036_require_opposite_sex_breeding_interest.sql

-- Forming Paws is a dog *breeding* matchmaking platform: a match is the
-- introduction that leads to a litter, and a litter requires one male sire and
-- one female dam (enforced by 0026's litters_insert_own_verified). But the
-- interest -> match path that *produces* those pairings never checked sex:
--
--   * dog_interests has only no-self and unique constraints (0011).
--   * dog_interests_insert_own_verified checks ownership, baseline
--     verification and (since 0017) target-not-own -- but not sex.
--   * create_match_on_mutual_interest (0011) fires on mutual interest alone.
--   * browse_dogs' p_sex is an optional filter and /browse defaults to
--     "Any sex", so same-sex candidates are shown, and the express-interest
--     form offers every verified dog the caller owns.
--
-- So two same-sex dogs could express mutual interest and auto-match into a
-- pairing that can never become a litter. The browser inserts dog_interests
-- directly through PostgREST, so this insert policy is the only real
-- enforcement point -- the same security boundary where 0017 added owner-
-- distinctness for the structurally identical "could create a self-match"
-- reason.
--
-- dogs.sex is NOT NULL (0003), so a strict `<>` needs no null-permissive
-- branch, and both dogs always exist here (both columns are FK to dogs), so
-- the added EXISTS can never reject a legitimate opposite-sex interest for a
-- missing row.
drop policy "dog_interests_insert_own_verified" on public.dog_interests;
create policy "dog_interests_insert_own_verified" on public.dog_interests
  for insert with check (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    and public.dog_is_baseline_verified(expressing_dog_id)
    and not exists (select 1 from public.dogs d2 where d2.id = target_dog_id and d2.owner_id = auth.uid())
    and exists (
      select 1
      from public.dogs de, public.dogs dt
      where de.id = expressing_dog_id
        and dt.id = target_dog_id
        and de.sex <> dt.sex
    )
  );
