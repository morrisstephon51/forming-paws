-- supabase/migrations/0032_sync_owners_email_on_auth_change.sql
--
-- Keep public.owners.email in step with auth.users.email after an email change.
--
-- 0022 established the invariant this migration finishes: owners.email must
-- always mirror auth.users.email, and is written only by a security-definer
-- trigger, never by the client (the column is deliberately absent from the
-- owners UPDATE grant so a member cannot PATCH it and show an admin an address
-- they do not actually control).
--
-- But 0022 only wired the INSERT half. handle_new_user() (on_auth_user_created,
-- AFTER INSERT) copies the address once at signup, and nothing has copied it
-- since. app/settings/actions.ts -> requestEmailChange() lets a member change
-- their address through Supabase's secure email-change flow, which updates
-- auth.users.email once both the old and new addresses confirm. That update
-- lands with no trigger behind it, so owners.email keeps the OLD address
-- forever. The invariant 0022 spelled out silently breaks the first time
-- anyone changes their email.
--
-- Two things break with it:
--
--   1. Puppy inquiries stop working. puppy_inquiries_insert_own (0026) requires
--      the submitted buyer_email to equal `(select email from public.owners
--      where id = auth.uid())`. app/dogs/[id]/PuppyInquiryForm.tsx submits
--      auth.users.email (the NEW address). New != stale owners.email, so the
--      insert is refused by RLS and the buyer sees a raw policy denial. A member
--      who ever changed their email can no longer inquire about ANY puppy.
--
--   2. The exact leak 0022 was guarding against happens anyway, just through a
--      different door: a breeder or admin reading owners.email sees an address
--      the member no longer controls.
--
-- The fix has to live in the database. The app cannot do it: the column grant
-- forbids a client write, and at requestEmailChange() time the change has not
-- taken effect yet (it completes asynchronously, only once both inboxes
-- confirm), so there is no moment in that request where the app both knows the
-- final address and is allowed to store it. A trigger on the actual
-- auth.users.email change is the only place the sync can be both correct and
-- timely -- which is why it mirrors on_auth_user_created rather than adding
-- app code.

-- One-time reconciliation: any owner whose email already drifted (changed their
-- address before this trigger existed) is corrected on apply. IS DISTINCT FROM
-- so it touches only rows that are actually wrong, and handles nulls cleanly.
update public.owners o
   set email = u.email
  from auth.users u
 where u.id = o.id
   and o.email is distinct from u.email;

create or replace function public.sync_owner_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.owners
     set email = new.email
   where id = new.id;
  return new;
end;
$$;

-- AFTER UPDATE OF email so the trigger is inert for every other auth.users
-- write (last-sign-in bookkeeping, token refreshes, metadata edits), and the
-- WHEN guard skips even an email UPDATE that does not change the value. Writes
-- public.owners only -- never auth.users -- so there is no recursion.
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_owner_email();

-- Trigger-only: nothing should call this through the API. Match handle_new_user,
-- whose EXECUTE is held only by postgres and service_role. Without this revoke
-- the default grants hand EXECUTE to PUBLIC, anon and authenticated, and the
-- security advisor flags it. The trigger still fires, as handle_new_user shows.
revoke execute on function public.sync_owner_email() from anon, authenticated, public;
