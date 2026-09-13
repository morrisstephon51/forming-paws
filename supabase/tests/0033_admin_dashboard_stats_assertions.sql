-- supabase/tests/0033_admin_dashboard_stats_assertions.sql
--
-- Run against a database that has migration 0033 applied. Everything happens
-- inside a transaction that ends in `rollback`, so it asserts against the real
-- functions and real data without leaving anything behind.
--
-- Each assertion is a `do $$ ... raise exception 'FAIL ...' $$`, so the script
-- fails loudly on the first broken expectation.
--
-- Callers are simulated the way 0028_admin_dog_management_assertions.sql does:
-- `set local role authenticated` plus `request.jwt.claims`, then `reset role`.
-- Two traps from that file apply here and are guarded explicitly:
--   * Shape before refusal. A missing function and a missing grant both raise
--     insufficient_privilege, so section 2 would pass against a database where
--     admin_dashboard_stats was never created. Section 0 rules that out.
--   * A real verified dog. dog_is_baseline_verified needs a verified vet_exam
--     inside 12 months AND a verified vaccination; section 7 checks the fixture
--     actually passes before asserting on funnel.verified_dog.

begin;

-- Every id and every captured number lives in a temp table GRANTed to
-- authenticated. Without the grant, checks that run as authenticated die on
-- `permission denied for table`, which reads as a script error rather than a
-- failed assertion (the bug 0027 found and fixed).
create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['admin', 'member', 'dog', 'test_signup', 'real_signup']) k;
grant select on t_ids to authenticated;

create temporary table t_nums (k text primary key, n bigint);
grant select, insert on t_nums to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-0033@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('admin', 'member');

-- auth.uid() is null here, which is the SQL path grant_role allows.
select public.grant_role((select v from t_ids where k = 'admin'), 'admin');


-- ---------------------------------------------------------------------------
-- 0. Shape: both functions exist, with the grants the rest depends on.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_test_account(text)') is null then
    raise exception 'FAIL 0: public.is_test_account(text) does not exist';
  end if;
  if to_regprocedure('public.admin_dashboard_stats()') is null then
    raise exception 'FAIL 0: public.admin_dashboard_stats() does not exist';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_dashboard_stats()', 'EXECUTE') then
    raise exception 'FAIL 0: authenticated cannot execute admin_dashboard_stats';
  end if;
  if has_function_privilege('anon', 'public.admin_dashboard_stats()', 'EXECUTE') then
    raise exception 'FAIL 0: anon can execute admin_dashboard_stats';
  end if;
  if has_function_privilege('anon', 'public.is_test_account(text)', 'EXECUTE') then
    raise exception 'FAIL 0: anon can execute is_test_account';
  end if;
  raise notice 'PASS 0: functions exist with the expected grants';
end $$;


-- ---------------------------------------------------------------------------
-- 1. is_test_account truth table.
-- ---------------------------------------------------------------------------
do $$
begin
  if not public.is_test_account('e2e-fixture-owner@gmail.com') then
    raise exception 'FAIL 1: an e2e fixture owner is not treated as a test account';
  end if;
  if not public.is_test_account('e2e-test-123@gmail.com') then
    raise exception 'FAIL 1: a per-run e2e signup is not treated as a test account';
  end if;
  if not public.is_test_account('formingpaws.qa+1@x.test') then
    raise exception 'FAIL 1: a QA account is not treated as a test account';
  end if;
  if public.is_test_account('someone@example.test') then
    raise exception 'FAIL 1: a real address is treated as a test account';
  end if;
  if public.is_test_account(null) then
    raise exception 'FAIL 1: null is treated as a test account';
  end if;
  if public.is_test_account('') then
    raise exception 'FAIL 1: an empty string is treated as a test account';
  end if;
  raise notice 'PASS 1: is_test_account truth table';
end $$;


-- ---------------------------------------------------------------------------
-- 2. A signed-in member without the admin role is refused with 42501.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'member'), 'role', 'authenticated')::text, true);

do $$
begin
  begin
    perform public.admin_dashboard_stats();
    raise exception 'FAIL 2: a non-admin member received dashboard stats';
  exception
    when insufficient_privilege then
      raise notice 'PASS 2: a non-admin member is refused with 42501';
  end;
end $$;


-- ---------------------------------------------------------------------------
-- 3 and 4. An admin receives every top-level key, and exactly 8 weeks ending
-- this week. Baseline numbers are captured for sections 5 to 7.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'admin'), 'role', 'authenticated')::text, true);

do $$
declare
  s jsonb := public.admin_dashboard_stats()::jsonb;
  key text;
begin
  foreach key in array array['meta', 'attention', 'funnel', 'signups_by_week', 'engagement'] loop
    if not s ? key then
      raise exception 'FAIL 3: top-level key % is missing', key;
    end if;
  end loop;

  if jsonb_array_length(s->'signups_by_week') <> 8 then
    raise exception 'FAIL 4: expected 8 weeks, got %', jsonb_array_length(s->'signups_by_week');
  end if;
  if (s->'signups_by_week'->7->>'week_start')::date <> date_trunc('week', now())::date then
    raise exception 'FAIL 4: the last week starts %, expected %',
      s->'signups_by_week'->7->>'week_start', date_trunc('week', now())::date;
  end if;

  insert into t_nums (k, n) values
    ('signed_up',    (s->'funnel'->>'signed_up')::bigint),
    ('excluded',     (s->'meta'->>'test_accounts_excluded')::bigint),
    ('docs_pending', (s->'attention'->>'docs_pending')::bigint),
    ('verified_dog', (s->'funnel'->>'verified_dog')::bigint);

  raise notice 'PASS 3-4: every key present, 8 weeks ending this week';
end $$;

reset role;


-- ---------------------------------------------------------------------------
-- Fixture changes, as the SQL superuser: one test signup, one real signup, and
-- a dog owned by the member with a verified vet exam, a verified vaccination
-- and one document still pending review.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       case k when 'test_signup' then 'e2e-test-0033@gmail.com'
              else 'real-signup-0033@example.test' end,
       'x', null, now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('test_signup', 'real_signup');

do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'dog'),
       (select v from t_ids where k = 'member'),
       'Assertion 0033',
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '2 years')::date;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
values
  ((select v from t_ids where k = 'dog'), 'assertions/0033/vet-exam.pdf',
   'vet_exam'::public.health_doc_type, current_date - 30, 'verified'::public.health_doc_status),
  ((select v from t_ids where k = 'dog'), 'assertions/0033/vax.pdf',
   'vaccination'::public.health_doc_type, current_date - 30, 'verified'::public.health_doc_status),
  ((select v from t_ids where k = 'dog'), 'assertions/0033/ofa.pdf',
   'ofa'::public.health_doc_type, current_date - 10, 'pending_review'::public.health_doc_status);

-- Control for 7b: if the fixture dog is not baseline-verified, the verified_dog
-- delta below could only ever pass vacuously.
do $$
begin
  if not public.dog_is_baseline_verified((select v from t_ids where k = 'dog')) then
    raise exception 'FAIL 7b control: the fixture dog is not baseline-verified';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5, 6 and 7. Deltas against the baseline, read as the admin.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'admin'), 'role', 'authenticated')::text, true);

do $$
declare
  s jsonb := public.admin_dashboard_stats()::jsonb;
  signed_up_delta bigint;
begin
  signed_up_delta := (s->'funnel'->>'signed_up')::bigint - (select n from t_nums where k = 'signed_up');
  if signed_up_delta <> 1 then
    raise exception 'FAIL 5-6: funnel.signed_up changed by %; expected +1 (one real and one test signup were added)',
      signed_up_delta;
  end if;

  if (s->'meta'->>'test_accounts_excluded')::bigint <> (select n from t_nums where k = 'excluded') + 1 then
    raise exception 'FAIL 5: meta.test_accounts_excluded did not increase by exactly 1';
  end if;

  if (s->'attention'->>'docs_pending')::bigint <> (select n from t_nums where k = 'docs_pending') + 1 then
    raise exception 'FAIL 7: attention.docs_pending did not increase by exactly 1';
  end if;

  if (s->'funnel'->>'verified_dog')::bigint <> (select n from t_nums where k = 'verified_dog') + 1 then
    raise exception 'FAIL 7b: funnel.verified_dog did not increase by exactly 1';
  end if;

  raise notice 'PASS 5-7: test signup excluded, real signup counted, pending doc and verified dog counted';
end $$;

reset role;


-- ---------------------------------------------------------------------------
-- 8. community_stats() still matches the rule it used before 0033.
--
-- Inside one transaction the old body is already gone, so "before and after"
-- is checked against the pre-0033 inline rule itself.
-- ---------------------------------------------------------------------------
do $$
declare
  cs jsonb := public.community_stats()::jsonb;
begin
  if (cs->>'members')::bigint <> (
    select count(*) from public.owners
    where coalesce(email, '') not like 'e2e-%' and coalesce(email, '') not like 'formingpaws.qa%'
  ) then
    raise exception 'FAIL 8: community_stats members differs from the pre-0033 rule';
  end if;

  if (cs->>'dogs')::bigint <> (
    select count(*) from public.dogs d join public.owners o on o.id = d.owner_id
    where coalesce(o.email, '') not like 'e2e-%' and coalesce(o.email, '') not like 'formingpaws.qa%'
      and d.removed_at is null
  ) then
    raise exception 'FAIL 8: community_stats dogs differs from the pre-0033 rule';
  end if;

  raise notice 'PASS 8: community_stats matches the pre-0033 rule';
end $$;

rollback;
