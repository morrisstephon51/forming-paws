-- supabase/tests/0036_require_opposite_sex_breeding_interest_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Transactional; ends in
-- rollback, so it asserts against real policies and real data without leaving
-- anything behind. Matches 0022, 0026, 0027, 0028 and 0030.
--
-- Design rule carried from 0030: no assertion may pass vacuously. The refusal
-- (section 3) is isolated so that sex is the ONLY failing WITH CHECK condition
-- -- the expressing dog is owned and verified and the target is owned by a
-- different member, so if the insert is rejected it can only be the sex clause
-- that 0036 adds. The control (section 2) proves the same policy still ACCEPTS
-- a legitimate opposite-sex interest, so a policy that simply refused every
-- insert could not satisfy this file.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures. All ids in one granted temp table (the 0027/0028 grant bug).
--
--   owner_a    acts; owns a_male.
--   owner_b    owns b_female (opposite-sex target) and b_male (same-sex target).
--   a_male     owner_a's verified MALE dog -- the expressing dog in both tests.
--   b_female   owner_b's FEMALE dog -- opposite sex, the section 2 control.
--   b_male     owner_b's MALE dog -- same sex, the section 3 refusal. Owned by
--              owner_b (not owner_a) so the target-not-own clause passes and
--              sex is the only condition left to fail.
-- ---------------------------------------------------------------------------

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['owner_a', 'owner_b', 'a_male', 'b_female', 'b_male', 'litter', 'b_puppy_f', 'a_puppy_m']) k;

grant select on t_ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-0036@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('owner_a', 'owner_b');

do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'a_male'),
       (select v from t_ids where k = 'owner_a'),
       'Assertion 0036 a_male',
       (select id from public.breeds order by id limit 1),
       'male'::public.dog_sex,
       (current_date - interval '2 years')::date;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'b_female'),
       (select v from t_ids where k = 'owner_b'),
       'Assertion 0036 b_female',
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '2 years')::date;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'b_male'),
       (select v from t_ids where k = 'owner_b'),
       'Assertion 0036 b_male',
       (select id from public.breeds order by id limit 1),
       'male'::public.dog_sex,
       (current_date - interval '2 years')::date;

-- a_male must satisfy dog_is_baseline_verified (0007): a verified vet_exam
-- dated within 12 months AND a verified vaccination. Without this, BOTH the
-- control and the refusal would fail on the verification clause instead of on
-- sex, and section 3 would pass for the wrong reason. Inserted here as the
-- bootstrap (postgres) role, which bypasses RLS, mirroring 0030's fixtures.
insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'a_male'), 'assertions/0036/vax.pdf',
       'vaccination'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'a_male'), 'assertions/0036/vet-exam.pdf',
       'vet_exam'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;


-- Marketplace-listing fixtures for sections 4 and 5 (added with the litter_id
-- guard). A listing is a dogs row with litter_id set (0026). Inserted as the
-- bootstrap (postgres) role, which bypasses RLS, like the fixtures above.
--
--   litter      owner_b's litter, parents b_male + b_female (0026 requires a
--               distinct sire and dam; both exist and are owner_b's).
--   b_puppy_f   a FEMALE puppy in that litter, owned by owner_b -- the section
--               4 target. Opposite sex to a_male and owned by someone else, so
--               litter_id is the only WITH CHECK condition left to fail.
--   a_puppy_m   a MALE puppy in that litter, owned by owner_a and baseline-
--               verified -- the section 5 expressing dog. Owned+verified with
--               an opposite-sex, non-listing target (b_female), so again
--               litter_id is the only condition left to fail. (A puppy's
--               owner_id need not equal its litter's breeder_id; the policy
--               reads only dogs.litter_id, so owner_a holding a listing is a
--               faithful stand-in for the direct-PostgREST path under test.)

insert into public.litters (id, breeder_id, sire_id, dam_id)
select (select v from t_ids where k = 'litter'),
       (select v from t_ids where k = 'owner_b'),
       (select v from t_ids where k = 'b_male'),
       (select v from t_ids where k = 'b_female');

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date, litter_id)
select (select v from t_ids where k = 'b_puppy_f'),
       (select v from t_ids where k = 'owner_b'),
       'Assertion 0036 b_puppy_f',
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '60 days')::date,
       (select v from t_ids where k = 'litter');

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date, litter_id)
select (select v from t_ids where k = 'a_puppy_m'),
       (select v from t_ids where k = 'owner_a'),
       'Assertion 0036 a_puppy_m',
       (select id from public.breeds order by id limit 1),
       'male'::public.dog_sex,
       (current_date - interval '60 days')::date,
       (select v from t_ids where k = 'litter');

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'a_puppy_m'), 'assertions/0036/puppy-vax.pdf',
       'vaccination'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'a_puppy_m'), 'assertions/0036/puppy-vet-exam.pdf',
       'vet_exam'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;


-- ---------------------------------------------------------------------------
-- 1. Shape. The policy's WITH CHECK must reference sex, or 0036 is not applied
-- and sections 2 and 3 would be asserting against the old policy -- section 3
-- in particular would fail (the old policy permits same-sex interest) and read
-- like a regression rather than a missing migration. This says which it is.
-- ---------------------------------------------------------------------------

do $$
declare expr text;
begin
  select pg_get_expr(pol.polwithcheck, pol.polrelid)
    into expr
  from pg_policy pol
  where pol.polname = 'dog_interests_insert_own_verified'
    and pol.polrelid = 'public.dog_interests'::regclass;
  if expr is null then
    raise exception 'FAIL: dog_interests_insert_own_verified has no WITH CHECK expression (or the policy is missing); migration 0036 has not been applied';
  end if;
  if position('sex' in expr) = 0 then
    raise exception 'FAIL: dog_interests_insert_own_verified does not reference sex; migration 0036 has not been applied (got: %)', expr;
  end if;
  if position('litter_id' in expr) = 0 then
    raise exception 'FAIL: dog_interests_insert_own_verified does not reference litter_id; the listing-exclusion half of migration 0036 has not been applied (got: %)', expr;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. The control. A verified MALE expresses interest in a FEMALE (opposite
-- sex) and it works. This is what stops section 3 from being satisfied by a
-- policy that refuses every insert.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'owner_a'), 'role', 'authenticated')::text, true);

-- Vacuity guard: a_male is owned by owner_a and verified; b_female is owned by
-- owner_b (so target-not-own passes) and is the opposite sex. Read with RLS off
-- so this measures the fixture, not visibility.
reset role;
do $$
declare owns boolean; verified boolean; opp boolean; tgt_other boolean; both_breeding boolean;
begin
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'a_male')
                 and owner_id = (select v from t_ids where k = 'owner_a')) into owns;
  select public.dog_is_baseline_verified((select v from t_ids where k = 'a_male')) into verified;
  select exists (select 1 from public.dogs de, public.dogs dt
                 where de.id = (select v from t_ids where k = 'a_male')
                   and dt.id = (select v from t_ids where k = 'b_female')
                   and de.sex <> dt.sex) into opp;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'b_female')
                 and owner_id = (select v from t_ids where k = 'owner_b')) into tgt_other;
  if not owns then raise exception 'FAIL: a_male is not owned by owner_a; the control would be rejected on the ownership clause, not accepted on sex'; end if;
  if not verified then raise exception 'FAIL: a_male is not baseline-verified; the control would be rejected on the verification clause'; end if;
  if not opp then raise exception 'FAIL: a_male and b_female are not opposite sex; the control is not exercising the new clause'; end if;
  select not exists (select 1 from public.dogs
                     where id in ((select v from t_ids where k = 'a_male'),
                                  (select v from t_ids where k = 'b_female'))
                       and litter_id is not null) into both_breeding;
  if not tgt_other then raise exception 'FAIL: b_female is not owned by owner_b; the control could be rejected on the target-not-own clause'; end if;
  if not both_breeding then raise exception 'FAIL: a control dog is a listing (litter_id set); the opposite-sex control must use breeding dogs so it also proves the new litter_id clause accepts a legitimate pairing'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'owner_a'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  begin
    insert into public.dog_interests (expressing_dog_id, target_dog_id)
    values ((select v from t_ids where k = 'a_male'), (select v from t_ids where k = 'b_female'));
    get diagnostics n = row_count;
  exception
    when others then
      raise exception 'FAIL: a verified male''s interest in a female (opposite sex) was refused with sqlstate % (%). 0036 must only reject SAME-sex interest; as written it is blocking a legitimate breeding pairing.',
        sqlstate, sqlerrm;
  end;
  if n <> 1 then
    raise exception 'FAIL: the opposite-sex control insert reported % row(s); expected exactly 1', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. The refusal. The SAME verified male expresses interest in another MALE
-- (same sex) and is rejected -- and rejected by the sex clause specifically,
-- because every other WITH CHECK condition is satisfied (a_male owned+verified,
-- b_male owned by owner_b, not owner_a).
-- ---------------------------------------------------------------------------

-- Vacuity guard: a_male verified+owned by owner_a; b_male owned by owner_b and
-- the SAME sex as a_male. If b_male were owner_a's the insert would be refused
-- by the target-not-own clause (0017), not by sex, and this would prove nothing.
reset role;
do $$
declare verified boolean; same boolean; tgt_other boolean;
begin
  select public.dog_is_baseline_verified((select v from t_ids where k = 'a_male')) into verified;
  select exists (select 1 from public.dogs de, public.dogs dt
                 where de.id = (select v from t_ids where k = 'a_male')
                   and dt.id = (select v from t_ids where k = 'b_male')
                   and de.sex = dt.sex) into same;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'b_male')
                 and owner_id = (select v from t_ids where k = 'owner_b')) into tgt_other;
  if not verified then raise exception 'FAIL: a_male is not verified going into the refusal; it would be rejected on the verification clause, not sex'; end if;
  if not same then raise exception 'FAIL: a_male and b_male are not the same sex; the refusal is not exercising the sex clause'; end if;
  if not tgt_other then raise exception 'FAIL: b_male is not owned by owner_b; the refusal could be the target-not-own clause (0017) firing instead of sex'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'owner_a'), 'role', 'authenticated')::text, true);
do $$
declare n int; raised boolean := false;
begin
  begin
    insert into public.dog_interests (expressing_dog_id, target_dog_id)
    values ((select v from t_ids where k = 'a_male'), (select v from t_ids where k = 'b_male'));
    get diagnostics n = row_count;
  exception
    when others then
      -- Discriminated: an RLS WITH CHECK rejection raises 42501 with
      -- "violates row-level security policy". A bare `when others` would also
      -- accept an unrelated failure (bad fixture, dropped grant) and report a
      -- refusal that never happened.
      if sqlerrm not like '%violates row-level security policy%' then
        raise exception 'FAIL: the same-sex interest insert raised sqlstate % (%), which is not the RLS policy refusing it; this assertion proves nothing',
          sqlstate, sqlerrm;
      end if;
      raised := true;
  end;
  if not raised then
    raise exception 'FAIL: a same-sex breeding interest (male -> male) was accepted (% row(s)). dog_interests_insert_own_verified has no opposite-sex check, so two same-sex dogs can express mutual interest and auto-match (0011''s on_dog_interest_created) into a pairing that can never become a litter.', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The listing refusal (target). The verified male expresses interest in a
-- FEMALE *puppy listing* (opposite sex, owned by owner_b, litter_id set) and is
-- rejected -- by the litter_id clause specifically, because every other WITH
-- CHECK condition is satisfied. A direct PostgREST insert is the only way to
-- reach this (browse_dogs since 0037 hides listings, and the detail page
-- branches on litter_id), which is exactly why the policy must enforce it.
-- ---------------------------------------------------------------------------

-- Vacuity guard: a_male owned by owner_a and verified; b_puppy_f is opposite
-- sex, owned by owner_b (target-not-own passes), its litter_id is NOT null (the
-- condition under test), and a_male's litter_id IS null, so the expressing-side
-- listing clause passes and the target-side clause is the only one left to fail.
reset role;
do $$
declare owns boolean; verified boolean; opp boolean; tgt_other boolean; tgt_listing boolean; expr_not_listing boolean;
begin
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'a_male')
                 and owner_id = (select v from t_ids where k = 'owner_a')) into owns;
  select public.dog_is_baseline_verified((select v from t_ids where k = 'a_male')) into verified;
  select exists (select 1 from public.dogs de, public.dogs dt
                 where de.id = (select v from t_ids where k = 'a_male')
                   and dt.id = (select v from t_ids where k = 'b_puppy_f')
                   and de.sex <> dt.sex) into opp;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'b_puppy_f')
                 and owner_id = (select v from t_ids where k = 'owner_b')) into tgt_other;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'b_puppy_f')
                 and litter_id is not null) into tgt_listing;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'a_male')
                 and litter_id is null) into expr_not_listing;
  if not owns then raise exception 'FAIL: a_male is not owned by owner_a; the target-listing refusal could be rejected on the ownership clause, not litter_id'; end if;
  if not verified then raise exception 'FAIL: a_male is not baseline-verified; the target-listing refusal could be rejected on the verification clause'; end if;
  if not opp then raise exception 'FAIL: a_male and b_puppy_f are not opposite sex; the target-listing refusal could be rejected on the sex clause, not litter_id'; end if;
  if not tgt_other then raise exception 'FAIL: b_puppy_f is not owned by owner_b; the refusal could be the target-not-own clause (0017) firing instead of litter_id'; end if;
  if not tgt_listing then raise exception 'FAIL: b_puppy_f has no litter_id; it is not a listing, so this section is not exercising the litter_id clause'; end if;
  if not expr_not_listing then raise exception 'FAIL: a_male unexpectedly has a litter_id; the expressing-side litter clause would also fail and the target clause would not be isolated'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'owner_a'), 'role', 'authenticated')::text, true);
do $$
declare n int; raised boolean := false;
begin
  begin
    insert into public.dog_interests (expressing_dog_id, target_dog_id)
    values ((select v from t_ids where k = 'a_male'), (select v from t_ids where k = 'b_puppy_f'));
    get diagnostics n = row_count;
  exception
    when others then
      if sqlerrm not like '%violates row-level security policy%' then
        raise exception 'FAIL: the target-listing interest insert raised sqlstate % (%), which is not the RLS policy refusing it; this assertion proves nothing',
          sqlstate, sqlerrm;
      end if;
      raised := true;
  end;
  if not raised then
    raise exception 'FAIL: a breeding interest targeting a marketplace puppy listing (litter_id set) was accepted (% row(s)). dog_interests_insert_own_verified does not exclude listings, so a direct PostgREST insert can express a breeding interest in a dog that is listed for sale, not for breeding.', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5. The listing refusal (expressing). A verified MALE *puppy listing* owned by
-- owner_a (litter_id set) expresses interest in a non-listing opposite-sex dog
-- (b_female) and is rejected -- by the expressing-side litter_id clause, since
-- every other condition passes. Covers the other half of the guard so a
-- mutation dropping only `de.litter_id is null` is still caught.
-- ---------------------------------------------------------------------------

-- Vacuity guard: a_puppy_m owned by owner_a and verified; its litter_id is NOT
-- null (the condition under test); b_female is opposite sex, owned by owner_b,
-- and its litter_id IS null, so the target-side listing clause passes and the
-- expressing-side clause is the only one left to fail.
reset role;
do $$
declare owns boolean; verified boolean; opp boolean; tgt_other boolean; expr_listing boolean; tgt_not_listing boolean;
begin
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'a_puppy_m')
                 and owner_id = (select v from t_ids where k = 'owner_a')) into owns;
  select public.dog_is_baseline_verified((select v from t_ids where k = 'a_puppy_m')) into verified;
  select exists (select 1 from public.dogs de, public.dogs dt
                 where de.id = (select v from t_ids where k = 'a_puppy_m')
                   and dt.id = (select v from t_ids where k = 'b_female')
                   and de.sex <> dt.sex) into opp;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'b_female')
                 and owner_id = (select v from t_ids where k = 'owner_b')) into tgt_other;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'a_puppy_m')
                 and litter_id is not null) into expr_listing;
  select exists (select 1 from public.dogs where id = (select v from t_ids where k = 'b_female')
                 and litter_id is null) into tgt_not_listing;
  if not owns then raise exception 'FAIL: a_puppy_m is not owned by owner_a; the expressing-listing refusal could be rejected on the ownership clause, not litter_id'; end if;
  if not verified then raise exception 'FAIL: a_puppy_m is not baseline-verified; the expressing-listing refusal could be rejected on the verification clause, not litter_id'; end if;
  if not opp then raise exception 'FAIL: a_puppy_m and b_female are not opposite sex; the expressing-listing refusal could be rejected on the sex clause, not litter_id'; end if;
  if not tgt_other then raise exception 'FAIL: b_female is not owned by owner_b; the refusal could be the target-not-own clause firing instead of litter_id'; end if;
  if not expr_listing then raise exception 'FAIL: a_puppy_m has no litter_id; it is not a listing, so this section is not exercising the expressing-side litter_id clause'; end if;
  if not tgt_not_listing then raise exception 'FAIL: b_female unexpectedly has a litter_id; the target-side litter clause would also fail and the expressing clause would not be isolated'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'owner_a'), 'role', 'authenticated')::text, true);
do $$
declare n int; raised boolean := false;
begin
  begin
    insert into public.dog_interests (expressing_dog_id, target_dog_id)
    values ((select v from t_ids where k = 'a_puppy_m'), (select v from t_ids where k = 'b_female'));
    get diagnostics n = row_count;
  exception
    when others then
      if sqlerrm not like '%violates row-level security policy%' then
        raise exception 'FAIL: the expressing-listing interest insert raised sqlstate % (%), which is not the RLS policy refusing it; this assertion proves nothing',
          sqlstate, sqlerrm;
      end if;
      raised := true;
  end;
  if not raised then
    raise exception 'FAIL: a marketplace puppy listing (litter_id set) was accepted as the *expressing* dog of a breeding interest (% row(s)). dog_interests_insert_own_verified does not require the expressing dog to be a breeding dog.', n;
  end if;
end $$;


reset role;
rollback;
