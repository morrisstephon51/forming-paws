-- supabase/migrations/0025_lock_down_purge_helpers.sql
--
-- Fixes a privacy leak introduced by 0022.
--
-- 0022 revoked EXECUTE on purge_deactivated_accounts() but left its two helper
-- functions on the default grant, which on Supabase means PostgREST exposes
-- them at /rest/v1/rpc/... to `anon` — no login required.
--
-- Verified against production before writing this: an anonymous caller holding
-- only the public anon key got HTTP 200 and a JSON array from both. They
-- returned [] purely because there were no open reports and no deactivated
-- owners at that moment. With either present:
--
--   owners_locked_by_open_report()  discloses the owner ids of BOTH parties to
--                                   every conversation under moderation review
--   owners_due_for_purge()          discloses who deleted their account and is
--                                   inside the 30-day purge window
--
-- Neither is something a member — let alone an anonymous visitor — should be
-- able to enumerate. "Who has been reported" is exactly the list a harasser
-- would want.
--
-- Neither function needs to be reachable over the API at all: their only caller
-- is purge_deactivated_accounts(), which runs from pg_cron as the table owner
-- and is unaffected by these grants.

revoke execute on function public.owners_locked_by_open_report() from public, anon, authenticated;
revoke execute on function public.owners_due_for_purge(interval) from public, anon, authenticated;

-- Same treatment for the account-state functions, which have no reason to be
-- callable by a signed-out visitor. They are auth.uid()-scoped, so an anonymous
-- call was already a no-op rather than a leak — but a no-op that returns 200 is
-- an invitation to keep probing, and defence in depth costs nothing here.
revoke execute on function public.deactivate_own_account() from public, anon;
revoke execute on function public.reactivate_own_account() from public, anon;

-- Re-assert what SHOULD stay reachable, so this migration is a complete
-- statement of intent rather than a subtraction whose effect depends on
-- whatever the grants happened to be.
grant execute on function public.deactivate_own_account() to authenticated;
grant execute on function public.reactivate_own_account() to authenticated;
