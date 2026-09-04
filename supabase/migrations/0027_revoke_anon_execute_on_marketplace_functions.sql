-- supabase/migrations/0027_revoke_anon_execute_on_marketplace_functions.sql
--
-- browse_puppies and litter_cap_ok were created in 0026 with an explicit
-- `grant execute ... to authenticated`, but Postgres also grants EXECUTE on
-- every new function to PUBLIC by default -- an addition, not a replacement.
-- Migration 0010 exists for exactly this reason on an earlier function; this
-- is the same bug recurring again. browse_puppies is SECURITY DEFINER, so an
-- anon caller bypassing RLS entirely and reading real puppy listings
-- (owner_id, name, price, location_label) was live in production until this
-- ran -- confirmed via the Supabase security advisor
-- (anon_security_definer_function_executable) immediately after 0026 landed.
-- litter_cap_ok is not security definer -- an anon call would just see an
-- empty `litters` table under RLS and always return true, a negligible leak
-- -- but revoked anyway for consistency and because it costs nothing.

revoke execute on function public.browse_puppies(bigint, numeric) from anon, public;
revoke execute on function public.litter_cap_ok(uuid) from anon, public;
