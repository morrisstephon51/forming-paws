-- supabase/migrations/0039_dog_interests_insert_own_verified_union.sql
--
-- Reconciles the two open-PR recreates of dog_interests_insert_own_verified so
-- that no migration apply-order can silently drop a guard (issue #95).
--
-- Two open PRs each `drop`+`create` this one policy in separate files:
--
--   * PR #77 -> 0036_require_opposite_sex_breeding_interest.sql
--       base guards + opposite-sex + both-are-breeding-dogs (litter_id IS NULL)
--       -- closes #76, #80
--   * PR #92 -> 0037_dog_interests_guard_deactivated_owner.sql
--       base guards + target owner still active (owner_is_active)
--       -- closes #91
--
-- `create policy` is a full definition, not additive, so whichever file applies
-- last wins completely. 0037 > 0036 in Supabase's lexicographic apply order, so
-- as authored PR #92 wins and the opposite-sex / not-a-listing guards from
-- PR #77 vanish -- silently re-opening #76 and #80 even though both PRs show
-- green and their issues read closed. (See #95 for the full analysis.)
--
-- This migration recreates the policy as the UNION of all three guard families.
-- It is numbered after every policy recreate in the open queue (the max is
-- #92's 0037; #94 is the highest new migration anywhere at 0038), so it is the
-- last `create policy` for this name in every merge combination -- #77 only,
-- #92 only, both, or neither -- and the resulting policy always carries every
-- guard. Each object it references already exists on main, so it also stands
-- alone (merging only this migration fixes #76, #80 and #91 together):
--
--   * public.dog_is_baseline_verified  (0009)
--   * public.owner_is_active           (0022, security definer)
--   * public.dogs.sex                  (not null, 0003)
--   * public.dogs.litter_id            (nullable, 0026)

drop policy if exists "dog_interests_insert_own_verified" on public.dog_interests;

create policy "dog_interests_insert_own_verified" on public.dog_interests
  for insert with check (
    -- 0011 + 0017: expressing dog is the caller's, baseline-verified, and the
    -- target is not also the caller's (self-match guard).
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    and public.dog_is_baseline_verified(expressing_dog_id)
    and not exists (select 1 from public.dogs d2 where d2.id = target_dog_id and d2.owner_id = auth.uid())
    -- #76 / #80 (PR #77): the pair must be opposite-sex and both must be
    -- breeding dogs, not marketplace listings (litter_id IS NULL).
    and exists (
      select 1
      from public.dogs de, public.dogs dt
      where de.id = expressing_dog_id
        and dt.id = target_dog_id
        and de.sex <> dt.sex
        and de.litter_id is null
        and dt.litter_id is null
    )
    -- #91 (PR #92): the target dog's owner must still be active.
    and public.owner_is_active(
      (select owner_id from public.dogs where id = target_dog_id)
    )
  );
