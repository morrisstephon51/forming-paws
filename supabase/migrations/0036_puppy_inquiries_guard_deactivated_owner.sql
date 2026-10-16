-- supabase/migrations/0036_puppy_inquiries_guard_deactivated_owner.sql
--
-- Closes #89: puppy_inquiries_insert_own allowed buyers to submit an inquiry
-- against a deactivated owner's puppy.
--
-- Same class of bug as #87 (browse_puppies missing deactivated-owner guard,
-- fixed by PR #88 / migration 0035): migration 0026 authored
-- puppy_inquiries_insert_own at the same time as browse_puppies, copying the
-- same blind spot. browse_puppies (0026) never picked up the
-- o.deactivated_at is null guard that browse_dogs gained in 0022; the
-- insert policy on puppy_inquiries has the same gap on the write path.
--
-- After PR #88 lands, a deactivated owner's listings are invisible in
-- browse_puppies. A buyer who has a direct URL (bookmarked, shared link)
-- can still reach /marketplace/puppy/[id] and POST an inquiry. That inquiry:
--
--   * inserts successfully into puppy_inquiries
--   * is invisible to the deactivated owner (they cannot log in)
--   * creates an orphaned record the buyer cannot retract
--   * surfaces as a stale inquiry if the owner ever reactivates
--
-- Fix: drop and recreate puppy_inquiries_insert_own with an additional
-- owner_is_active() check. owner_is_active() is already SECURITY DEFINER
-- (0022), so the inner owners lookup succeeds even though owners RLS
-- (owners_select_own, 0001) blocks cross-owner reads by default.

drop policy if exists "puppy_inquiries_insert_own" on public.puppy_inquiries;

create policy "puppy_inquiries_insert_own" on public.puppy_inquiries
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and buyer_email = (select email from public.owners where id = auth.uid())
    and exists (
      select 1 from public.dogs
      where id = puppy_id
        and litter_id is not null
        and owner_id <> auth.uid()
    )
    and public.owner_is_active(
      (select owner_id from public.dogs where id = puppy_id)
    )
  );
