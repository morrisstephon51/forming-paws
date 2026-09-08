-- supabase/migrations/0029_revoke_anon_execute_on_role_mutations.sql
--
-- SECURITY FIX. public.grant_role and public.revoke_role were executable by the
-- `anon` role, which is unauthenticated privilege escalation.
--
-- Two things combined to make it exploitable:
--
--   1. This project has a pg_default_acl entry granting EXECUTE on new functions
--      in `public` to anon/authenticated/service_role at creation time. That is a
--      DIRECT grant to `anon`, not a grant to PUBLIC. 0026 ended with
--      `revoke all on function ... from public`, which does not touch a direct
--      anon grant -- so anon kept EXECUTE. Migration 0010 already documented this
--      exact mechanism and used `from anon, public`; 0026 regressed on it.
--
--   2. Both functions guard with `if auth.uid() is not null and not has_role(...)`.
--      The `is not null` exists to keep the operational "grant the first admin via
--      SQL" path working, where auth.uid() is null. But auth.uid() is ALSO null for
--      a request made with the publishable anon key, so both guards were skipped
--      entirely for anon -- including the self-escalation guard.
--
-- Net effect before this migration: anyone holding the anon key (it ships in the
-- client bundle) could call grant_role with their own owners.id and role_name
-- 'admin' and become an admin. grant_role is security definer owned by postgres,
-- so RLS on user_roles did not apply either.
--
-- The revoke is the fix rather than a guard change: with no EXECUTE, the guard
-- logic is never reached by anon at all, and the null-auth.uid() SQL bootstrap
-- path that 0026 deliberately preserves keeps working for postgres/service_role.
--
-- Verified before writing: grant_role and revoke_role were the ONLY anon-executable
-- volatile security-definer functions in `public`. The remaining anon-executable
-- ones (has_role, has_any_role, is_admin, community_stats, owner_is_active) are all
-- STABLE and return false or already-public data when auth.uid() is null.

revoke all on function public.grant_role(uuid, text)  from anon, public;
revoke all on function public.revoke_role(uuid, text) from anon, public;

-- Restated so this migration is self-sufficient if replayed onto a database where
-- the additive grant never ran.
grant execute on function public.grant_role(uuid, text)  to authenticated;
grant execute on function public.revoke_role(uuid, text) to authenticated;
