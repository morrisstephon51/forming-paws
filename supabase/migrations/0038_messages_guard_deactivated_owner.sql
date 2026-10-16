-- supabase/migrations/0038_messages_guard_deactivated_owner.sql
--
-- messages_insert_participant (0020) allows any participant to send a message
-- into a match thread with no check that the RECIPIENT owner is still active.
-- After Owner B calls deactivate_own_account(), Owner A can still INSERT rows
-- into messages for that match — the existing guards (owner_in_match,
-- match_is_blocked) are about participation and blocking, not deactivation.
--
-- Same class as:
--   0035_browse_puppies_deactivated_owner_guard.sql   (#87 → #88)
--   0036_puppy_inquiries_deactivated_owner_guard.sql  (#89 → #90)
--   0037_dog_interests_guard_deactivated_owner.sql    (#91 → #92)
--
-- Fix: add an owner_is_active() check on the RECIPIENT — the other dog's
-- owner in the match.  Uses the same CASE expression pattern as the prior
-- fixes: identify which of dog_a/dog_b belongs to the sender, then check
-- the OTHER owner's deactivation status via the existing security-definer
-- helper so no new table grant is required.

drop policy if exists "messages_insert_participant" on public.messages;

create policy "messages_insert_participant" on public.messages
  for insert to authenticated with check (
    public.owner_in_match(match_id)
    and sender_owner_id = auth.uid()
    and not public.match_is_blocked(match_id)
    and exists (
      select 1
      from public.matches m
      join public.dogs da on da.id = m.dog_a_id
      join public.dogs db on db.id = m.dog_b_id
      where m.id = match_id
        and public.owner_is_active(
          case
            when da.owner_id = auth.uid() then db.owner_id
            else da.owner_id
          end
        )
    )
  );
