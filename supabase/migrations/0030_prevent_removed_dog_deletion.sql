-- supabase/migrations/0030_prevent_removed_dog_deletion.sql
--
-- 0028 closed the statement-shape hole on the UPDATE path into dogs.removed_at.
-- The DELETE path has the same hole, and 0028 does not close it.
--
-- `authenticated` holds table-level DELETE on public.dogs (verified against
-- wyzcnkdonbdykidmcxvx on 2026-09-07 via information_schema.role_table_grants),
-- and dogs_delete_own is `using (owner_id = auth.uid())` with no further
-- restriction. A member's own moderated dog is still a row that member owns.
--
-- A FILTERED `DELETE /dogs?id=eq.X` against a removed dog is already refused,
-- but only incidentally, and by exactly the mechanism 0028 documents for UPDATE:
-- a DELETE whose WHERE reads a column has the SELECT policies applied to it as
-- well, and dogs_select_own no longer returns removed rows, so the statement
-- matches nothing. That protection disappears the moment the statement stops
-- reading a column. An UNFILTERED `delete from public.dogs` reads no column, so
-- no SELECT policy is ever consulted; dogs_delete_own alone then permits it on
-- every row the member owns, the moderated ones included.
--
-- What is at stake is not the dog row. Foreign keys cascade from public.dogs
-- into health_documents, dog_photos, dog_interests, matches and puppy_inquiries
-- — all ON DELETE CASCADE, read from pg_constraint on production 2026-09-07. So
-- a member removed for abusive content can destroy the verified vet records and
-- the message threads that are the EVIDENCE for why they were moderated, in one
-- statement with no WHERE clause. 0028's own header says a hard delete "would
-- destroy the verified vet records this platform's health-gating claim rests
-- on", and adds no dogs_delete_admin for that reason. This is the same hole seen
-- from the other side: the hard delete performed by the moderated party.
--
-- There is a SECOND route into public.dogs, and this trigger covers it too.
-- public.dogs.litter_id references public.litters(id) ON DELETE CASCADE
-- (dogs_litter_id_fkey, read from pg_constraint on wyzcnkdonbdykidmcxvx
-- 2026-09-07), and litters_delete_own is a permissive DELETE policy on
-- {authenticated} with `using (breeder_id = auth.uid())` (read from pg_policies,
-- same day). So a breeder deleting their own litter deletes every puppy in it
-- without the statement ever naming public.dogs, and a statement that never
-- names dogs is not reached by dogs_delete_own or by any policy on dogs at all:
-- referential actions run with the FK's own rights, not the caller's.
--
-- A CASCADE delete does fire the child table's row triggers, exactly as a direct
-- DELETE does. So this trigger IS consulted once per cascaded puppy, and one
-- removed puppy in the litter aborts the ENTIRE litter delete — the litter row
-- and every littermate with it — with this file's message rather than an RLS
-- silence. That is the correct outcome and it is written down here so it is not
-- read as a bug later: the moderation evidence outranks a breeder's ability to
-- tidy up a litter, and the alternative (letting the litter delete through)
-- would be precisely the hole this migration closes, reached one foreign key
-- away. A breeder in that position needs an admin to restore or delete the
-- moderated puppy first.
--
-- Dormant today: production holds 0 litters and 0 dogs with a non-null litter_id
-- (2026-09-07), which is why nobody has met it. It goes live with puppy
-- listings, and it is cheaper to state now than to diagnose then.
--
-- Like 0028's sibling, this is a trigger and not a policy, and for three
-- reasons rather than symmetry alone.
--
-- First, a policy's USING clause filters; it does not refuse. A restrictive
-- DELETE policy would let `delete from public.dogs` report success, take the
-- member's other dogs, and silently leave the moderated one behind. A member who
-- meant to wipe their account would be told it worked. An explicit refusal is
-- the honest contract, and it is what 0028 chose for the same reason.
--
-- Second, section 2 of 0028_admin_dog_management_assertions.sql asserts that the
-- DELETE-capable policies on public.dogs are EXACTLY {dogs_delete_own}, and it
-- deliberately includes restrictive ones and FOR ALL ones in that set — "any
-- change at all to the delete surface of public.dogs should stop here and be
-- argued for explicitly". A new policy would trip that tripwire; a trigger
-- leaves the delete surface exactly as 0028 pinned it.
--
-- Third, the hole is a statement shape rather than a row predicate, which is the
-- same argument 0028 makes for the UPDATE side.
--
-- Every statement in this file is written to be safely re-runnable, matching
-- 0028: a migration that aborts halfway through leaves the database in a state
-- no later statement can repair.

-- ---------------------------------------------------------------------------
-- A removed dog may not be hard-deleted by the member it was taken from.
--
-- Modelled directly on 0028's dogs_prevent_non_admin_removal_change, which
-- solves the structurally identical problem one verb over, and it keeps the same
-- three-part condition for the same reasons.
--
-- `auth.uid() is not null`, carried from 0014 and 0028: auth.uid() is null when
-- a statement runs without a JWT context (direct SQL through the Supabase MCP
-- execute_sql tool or the dashboard SQL editor, both of which run as
-- postgres/service_role) and non-null for anything that arrived through
-- PostgREST with a user's token. That keeps the operational SQL path working
-- and it is not merely inherited convention here: public.dogs.owner_id
-- references public.owners ON DELETE CASCADE, owners.id references auth.users
-- ON DELETE CASCADE, and public.purge_deactivated_accounts() deletes straight
-- out of auth.users from pg_cron. That cascade reaches dogs and fires this
-- trigger for every row it takes. Without the null-uid allowance, one moderated
-- dog belonging to one member inside the 30-day purge window would abort the
-- nightly purge job outright — every night, for everybody.
--
-- `not public.is_admin()` mirrors the sibling, and it is LIVE — not unreachable,
-- and not dead. An admin is also a member: dogs_delete_own is `owner_id =
-- auth.uid()` with no exclusion for admins, so an admin whose OWN dog has been
-- removed satisfies it, reaches this trigger, and is let through by this clause.
-- The clause is load-bearing for exactly that person.
--
-- Which is a product decision, so state it plainly rather than leaving it to be
-- inferred: AN ADMIN MAY PERMANENTLY DESTROY THE MODERATION EVIDENCE AGAINST
-- THEIR OWN DOG. The verified vet records and the message threads cascade away
-- with the row, and neither this migration nor 0028 stops it. That is accepted
-- here because an admin can already restore the dog, revoke the removal, or
-- grant themselves anything else they want; a member whose dog was taken from
-- them cannot, and they are who this trigger is for.
--
-- The compensating control is partial and worth stating exactly. 0027's
-- audit_log carries the REMOVAL — written by lib/auth/audit.ts when an admin
-- calls admin_remove_dog — and audit_log.target_id is text with no foreign key
-- to public.dogs (checked on production 2026-09-07), so that row outlives the
-- dog and the fact that a moderation happened cannot be erased by deleting the
-- subject. What is not covered is the hard delete itself, which goes through
-- PostgREST as an ordinary DELETE and writes no audit row at all, and the
-- evidence, which cascades away for good. If that stops being enough, the fix is
-- to drop `not public.is_admin()` from the condition below — refusing admins
-- too — and to give admins an audited RPC for the deletions they genuinely need.
-- Not a narrowed dogs_delete_own: a policy filters rather than refuses, so it
-- would report success and quietly leave the row, which is the failure mode the
-- top of this file rejects.
--
-- What is genuinely unreachable is the OTHER case: an admin deleting SOMEONE
-- ELSE'S removed dog. dogs_delete_own pins owner_id = auth.uid() and 0028
-- deliberately adds no dogs_delete_admin, so that statement matches no row and
-- this trigger is never consulted for it. The clause is written to cover that
-- case anyway, so the refusal says what it means — "not entitled" — rather than
-- encoding the accident that admins have no route into another member's row.
--
-- `old.removed_at is not null`, not `is distinct from`: unlike the UPDATE case
-- there is no NEW row to compare against. This is a question about one row's
-- state, and the answer for the overwhelming majority of rows is "not removed",
-- which is why an ordinary owner deleting an ordinary dog never reaches the
-- raise at all.
--
-- NOT security definer, deliberately, exactly as 0028's sibling is not. The
-- check is about who the caller is, and a definer function would run the body as
-- postgres for no benefit — public.is_admin() and auth.uid() both resolve
-- through the request.jwt.claims GUC rather than through current_user, so
-- definer rights would change nothing here except the privileges any future
-- addition to this body would silently inherit.
--
-- RETURN OLD, not NULL and not NEW. NEW is null in a BEFORE DELETE trigger, and
-- a BEFORE DELETE trigger that returns NULL does not raise anything — it
-- CANCELS the row's deletion silently and leaves it out of the command's row
-- count. That failure mode looks like success from the client's side and is
-- precisely why the assertion script's control case checks both the reported row
-- count and the row's actual absence.
--
-- The refusal is a plain `raise exception` (SQLSTATE P0001), matching 0014 and
-- 0028 and deliberately NOT errcode 42501. Several assertions in
-- 0028_admin_dog_management_assertions.sql treat a 42501 on public.dogs as proof
-- that a policy's WITH CHECK vetoed the statement; raising 42501 here would make
-- those ambiguous, and they are load-bearing.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_removed_dog_deletion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.removed_at is not null
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'a removed dog may only be deleted by an admin';
  end if;
  return old;
end;
$$;

-- Dropped and recreated rather than a bare `create trigger`, which on a re-run
-- of this file would abort with "trigger already exists". Same shape as 0028's.
--
-- No revoke follows. A trigger function is not callable as an ordinary function
-- — plpgsql refuses one invoked outside a trigger context — so the
-- pg_default_acl EXECUTE grant that 0029 is about confers nothing here. 0014's
-- and 0028's trigger functions are ungranted-from in exactly the same way.
drop trigger if exists dogs_prevent_removed_dog_deletion on public.dogs;
create trigger dogs_prevent_removed_dog_deletion
  before delete on public.dogs
  for each row execute function public.prevent_removed_dog_deletion();
