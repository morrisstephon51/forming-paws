-- supabase/migrations/0037_dog_interests_guard_deactivated_owner.sql
--
-- Closes #91: dog_interests_insert_own_verified allows breeding interests
-- against dogs whose owner has deactivated their account.
--
-- Same class of bug as #87 (browse_puppies missing deactivated-owner guard,
-- fixed by PR #88 / migration 0035) and #89 (puppy_inquiries_insert_own,
-- fixed by PR #90 / migration 0036).
--
-- browse_dogs (0022/0024) filters on o.deactivated_at is null, so a
-- deactivated owner's dogs do not appear in discovery. A caller who bypasses
-- browse_dogs — direct REST API call or a bookmarked /dogs/[id] URL — can
-- still INSERT into dog_interests because the policy (0017) only confirms:
--
--   1. the expressing dog belongs to the caller
--   2. the expressing dog is baseline-verified
--   3. the target dog does NOT belong to the caller (self-match guard)
--
-- It does not confirm the target dog's owner is still active, so the row
-- inserts successfully into a dead-end slot:
--
--   * the deactivated owner cannot see or respond to the interest
--   * create_match_on_mutual_interest (0011) can never fire from the
--     deactivated side, so no match ever forms
--   * the unique constraint on (expressing_dog_id, target_dog_id) consumes
--     the slot permanently
--   * if the owner reactivates, they surface a backlog of stale interests
--
-- Fix: add public.owner_is_active() on the target dog's owner.
-- owner_is_active is SECURITY DEFINER (0022), so it resolves against
-- owners.deactivated_at even though owners_select_own (0001) would otherwise
-- block a cross-owner read.

drop policy if exists "dog_interests_insert_own_verified" on public.dog_interests;

create policy "dog_interests_insert_own_verified" on public.dog_interests
  for insert with check (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    and public.dog_is_baseline_verified(expressing_dog_id)
    and not exists (select 1 from public.dogs d2 where d2.id = target_dog_id and d2.owner_id = auth.uid())
    and public.owner_is_active(
      (select owner_id from public.dogs where id = target_dog_id)
    )
  );
