-- supabase/tests/0032_owners_email_sync_assertions.sql
--
-- Run against a database that has migration 0032 applied. Everything happens
-- inside a transaction that ends in `rollback`, so it asserts against the real
-- trigger and real data without leaving anything behind.
--
--   psql "$DATABASE_URL" -f supabase/tests/0032_owners_email_sync_assertions.sql
--
-- Each assertion is a `do $$ ... raise exception ... $$`, so the script fails
-- loudly on the first broken expectation.

begin;

-- One owner, created the way production creates them: insert auth.users and let
-- handle_new_user() populate the owners row, so the test exercises the real
-- trigger chain rather than side-stepping it.
create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values ('owner', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'before-change@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', 'Email Sync')
from t_ids;


-- ---------------------------------------------------------------------------
-- 1. Baseline: owners.email starts equal to auth.users.email (the INSERT half,
--    from handle_new_user). If this is already wrong the rest proves nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  u uuid := (select v from t_ids where k = 'owner');
begin
  if (select email from public.owners where id = u) is distinct from 'before-change@example.test' then
    raise exception 'FAIL: owners.email was not seeded from auth.users at signup';
  end if;
  raise notice 'PASS 1: owners.email seeded to the signup address';
end $$;


-- ---------------------------------------------------------------------------
-- 2. The fix: an email change on auth.users propagates to owners.email.
--
-- This is the value puppy_inquiries_insert_own (0026) compares the submitted
-- buyer_email against, so a stale value here is precisely what refused every
-- inquiry from a member who had changed their address.
-- ---------------------------------------------------------------------------
do $$
declare
  u uuid := (select v from t_ids where k = 'owner');
  synced text;
begin
  update auth.users set email = 'after-change@example.test' where id = u;

  select email into synced from public.owners where id = u;
  if synced is distinct from 'after-change@example.test' then
    raise exception
      'FAIL: owners.email did not follow the auth email change (got %)', synced;
  end if;
  raise notice 'PASS 2: owners.email followed the auth change -> %', synced;
end $$;


-- ---------------------------------------------------------------------------
-- 3. owners.email now equals auth.users.email exactly -- the invariant the
--    puppy inquiry policy depends on.
-- ---------------------------------------------------------------------------
do $$
declare
  u uuid := (select v from t_ids where k = 'owner');
begin
  if (select email from public.owners where id = u)
     is distinct from (select email from auth.users where id = u) then
    raise exception 'FAIL: owners.email and auth.users.email are out of sync';
  end if;
  raise notice 'PASS 3: owners.email matches auth.users.email';
end $$;


-- ---------------------------------------------------------------------------
-- 4. The WHEN guard: a non-email write to auth.users must not disturb
--    owners.email (and must not error). Proves the trigger is inert for the
--    frequent auth bookkeeping writes it is not meant to react to.
-- ---------------------------------------------------------------------------
do $$
declare
  u uuid := (select v from t_ids where k = 'owner');
begin
  update auth.users set updated_at = now() where id = u;

  if (select email from public.owners where id = u) is distinct from 'after-change@example.test' then
    raise exception 'FAIL: a non-email auth write changed owners.email';
  end if;
  raise notice 'PASS 4: owners.email untouched by a non-email auth write';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Trigger-only: the function exists and no API role can call it directly.
--    The existence check comes first so a missing function reads as a FAIL,
--    not as a has_function_privilege error.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.sync_owner_email()') is null then
    raise exception 'FAIL: public.sync_owner_email() does not exist';
  end if;
  if has_function_privilege('anon', 'public.sync_owner_email()', 'EXECUTE') then
    raise exception 'FAIL: anon can execute sync_owner_email';
  end if;
  if has_function_privilege('authenticated', 'public.sync_owner_email()', 'EXECUTE') then
    raise exception 'FAIL: authenticated can execute sync_owner_email';
  end if;
  raise notice 'PASS 5: sync_owner_email is not callable by anon or authenticated';
end $$;

rollback;
