-- supabase/tests/0028_admin_dog_management_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Transactional; ends in
-- rollback, so it asserts against real policies and real data without leaving
-- anything behind. Matches 0022, 0026 and 0027.
--
-- Design rule carried from 0027: no assertion may be able to pass vacuously.
-- Every "it is hidden" check is paired with an "it was visible a moment ago"
-- check against the same row, the same viewer and the same surface, so a
-- filter that hides everything fails just as loudly as a filter that hides
-- nothing.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- Every id lives in ONE temp table. Temp tables are owned by the creating role
-- and most of this script runs as `authenticated`; without the grant below,
-- every check dies on `permission denied for table t_ids`, which reads as a
-- script error rather than a failed assertion, so the security checks silently
-- never run. That exact bug was found and fixed in 0027. Keeping all ids in a
-- single granted table means a later edit cannot reintroduce it by adding a
-- second temp table and forgetting the grant.
-- ---------------------------------------------------------------------------

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['dog_admin','dog_owner','dog_viewer','dog','sire','dam','puppy','litter']) k;

grant select on t_ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-dogs@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('dog_admin', 'dog_owner', 'dog_viewer');

select public.grant_role((select v from t_ids where k = 'dog_admin'), 'admin');

-- A breed must exist or the fixture insert below fails for an unrelated reason.
do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

-- Four dogs, all owned by dog_owner: the dog under test, a sire and dam so a
-- litter can exist, and a puppy in that litter so browse_puppies has something
-- to return. dog_viewer owns nothing, which is what makes it a valid stand-in
-- for a member browsing the site.
insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select t.v,
       (select v from t_ids where k = 'dog_owner'),
       'Assertion ' || t.k,
       (select id from public.breeds order by id limit 1),
       case when t.k = 'sire' then 'male'::public.dog_sex else 'female'::public.dog_sex end,
       (current_date - interval '2 years')::date
from t_ids t
where t.k in ('dog', 'sire', 'dam', 'puppy');

insert into public.litters (id, breeder_id, sire_id, dam_id, born_on, ready_on)
select (select v from t_ids where k = 'litter'),
       (select v from t_ids where k = 'dog_owner'),
       (select v from t_ids where k = 'sire'),
       (select v from t_ids where k = 'dam'),
       current_date - 60,
       current_date + 14;

update public.dogs
   set litter_id = (select v from t_ids where k = 'litter')
 where id = (select v from t_ids where k = 'puppy');

-- Health documents and a photo row on the dog under test. Removal is soft
-- precisely so these survive it; without them, "the vet records survive" is an
-- assertion about nothing.
--
-- BOTH documents are required, and not for redundancy.
-- public.dog_is_baseline_verified is an AND of two EXISTS: a `verified`
-- `vet_exam` dated within the last 12 months, and a `verified` `vaccination`.
-- With the vaccination alone the fixture dog would never be counted in
-- community_stats()->>'verified_dogs', and section 9's assertion that that
-- number drops across the removal could only ever pass vacuously — which is
-- exactly the state this file was in before: nothing anywhere exercised the
-- verified_dogs filter, and a restatement that filtered the `dogs` subquery
-- twice and verified_dogs not at all passed the whole suite.
insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'dog'), 'assertions/0028/vax.pdf',
       'vaccination'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'dog'), 'assertions/0028/vet-exam.pdf',
       'vet_exam'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;

insert into public.dog_photos (dog_id, storage_path, position)
select (select v from t_ids where k = 'dog'), 'assertions/0028/photo.jpg', 0;


-- ---------------------------------------------------------------------------
-- 1. Shape: the columns, the functions and the grants Tasks 4 and 5 depend on.
--
-- The privilege checks further down catch an unauthorised caller by trapping
-- insufficient_privilege. A missing function raises undefined_function and a
-- missing grant raises insufficient_privilege too, so without these three
-- checks first, "a non-admin could not remove a dog" would pass just as
-- happily against a database where admin_remove_dog was never created.
-- ---------------------------------------------------------------------------

do $$
declare missing text;
begin
  select string_agg(c, ', ') into missing
  from unnest(array['removed_at', 'removed_by']) c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dogs' and column_name = c
  );
  if missing is not null then
    raise exception 'FAIL: dogs is missing column(s): %', missing;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dogs'
      and column_name = 'removed_at' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'FAIL: dogs.removed_at is not timestamptz';
  end if;
end $$;

do $$
declare missing text;
begin
  select string_agg(sig, ', ') into missing
  from unnest(array['public.admin_remove_dog(uuid, text)',
                    'public.admin_restore_dog(uuid)',
                    'public.dog_is_removed(uuid)']) sig
  where to_regprocedure(sig) is null;
  if missing is not null then
    raise exception 'FAIL: missing function(s) the admin console calls by name: %', missing;
  end if;
end $$;

do $$
declare bad text;
begin
  select string_agg(sig, ', ') into bad
  from unnest(array['public.admin_remove_dog(uuid, text)',
                    'public.admin_restore_dog(uuid)',
                    'public.dog_is_removed(uuid)']) sig
  where not has_function_privilege('authenticated', sig, 'execute');
  if bad is not null then
    raise exception 'FAIL: authenticated cannot execute: %', bad;
  end if;

  -- anon still holding execute means `revoke all ... from public` did not land,
  -- because PUBLIC gets execute on a new function by default. dog_is_removed is
  -- in this list too: the migration revokes it from public for the same reason,
  -- and it leaks whether an arbitrary dog id exists and has been moderated.
  select string_agg(sig, ', ') into bad
  from unnest(array['public.admin_remove_dog(uuid, text)',
                    'public.admin_restore_dog(uuid)',
                    'public.dog_is_removed(uuid)']) sig
  where has_function_privilege('anon', sig, 'execute');
  if bad is not null then
    raise exception 'FAIL: anon can execute %; revoke from public did not land', bad;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Policy posture on dogs.
-- ---------------------------------------------------------------------------

-- No policy may grant admins hard deletion of a dog — that is the whole point of
-- the soft-delete model, because the FK cascade would take the verified vet
-- records and the match threads with it.
--
-- Asserted as an exact set of policy names, not by looking for the string
-- `is_admin` in a qual. A hard-delete path spelled `has_role('admin')`, or as an
-- inline `exists (select 1 from user_roles ...)`, or granted by a `for all`
-- policy, is the same hole and would walk straight past a substring match.
-- cmd = 'ALL' is included for that last reason: pg_policies reports a FOR ALL
-- policy as 'ALL', and it confers DELETE just as surely as one written FOR
-- DELETE. Any change at all to the delete surface of public.dogs should stop
-- here and be argued for explicitly.
do $$
declare names text;
begin
  select coalesce(string_agg(policyname, ', ' order by policyname), '(none)') into names
  from pg_policies
  where schemaname = 'public' and tablename = 'dogs' and cmd in ('DELETE', 'ALL');
  if names is distinct from 'dogs_delete_own' then
    raise exception 'FAIL: the DELETE-capable policies on public.dogs are {%}; expected exactly {dogs_delete_own}. Removal must be soft.', names;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dogs'
      and policyname = 'dogs_update_admin' and cmd = 'UPDATE'
  ) then
    raise exception 'FAIL: dogs_update_admin does not exist; an admin cannot edit a member''s dog';
  end if;
end $$;

-- 0028 restates dogs_litter_ownership_on_update so that an admin passes it. The
-- behavioural proof is in section 7; this is the other half of it. Section 7
-- would pass just as happily against a database where the restrictive policy had
-- been "fixed" by deleting it outright — which would also let any member attach
-- a dog to a litter they do not breed. So assert it is still there, and still
-- RESTRICTIVE: a restatement that lost `as restrictive` would turn a veto into
-- one more permissive alternative and silently grant everyone the exception.
do $$
declare kind text;
begin
  select permissive into kind from pg_policies
  where schemaname = 'public' and tablename = 'dogs'
    and policyname = 'dogs_litter_ownership_on_update' and cmd = 'UPDATE';
  if kind is null then
    raise exception 'FAIL: dogs_litter_ownership_on_update is missing; any member could attach a dog to a litter they do not breed';
  end if;
  if kind <> 'RESTRICTIVE' then
    raise exception 'FAIL: dogs_litter_ownership_on_update is %, not RESTRICTIVE; it no longer vetoes anything', kind;
  end if;
end $$;

-- dogs_select_admin must stay unfiltered, or a removed dog can never be found
-- again and admin_restore_dog becomes unreachable from the console.
do $$
declare q text;
begin
  select qual into q from pg_policies
  where schemaname = 'public' and tablename = 'dogs' and policyname = 'dogs_select_admin';
  if q is null then
    raise exception 'FAIL: dogs_select_admin is missing; removed dogs would be unrestorable';
  end if;
  if q like '%removed_at%' then
    raise exception 'FAIL: dogs_select_admin filters removed_at; removed dogs become unrestorable';
  end if;
end $$;

-- The two browsable-coupled photo policies must reach removed_at through the
-- security-definer helper. A plain join to public.dogs would be re-filtered by
-- dogs_select_own — RLS applies to tables referenced inside a policy expression
-- — and would blank every other member's photos, not just removed ones.
do $$
declare q text;
begin
  select qual into q from pg_policies
  where schemaname = 'public' and tablename = 'dog_photos'
    and policyname = 'dog_photos_select_browsable';
  if q is null then
    raise exception 'FAIL: dog_photos_select_browsable is missing';
  end if;
  if q not like '%dog_is_removed%' then
    raise exception 'FAIL: dog_photos_select_browsable does not check dog_is_removed';
  end if;

  select qual into q from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'dog_photos_storage_browsable_select';
  if q is null then
    raise exception 'FAIL: dog_photos_storage_browsable_select is missing';
  end if;
  if q not like '%dog_is_removed%' then
    raise exception 'FAIL: dog_photos_storage_browsable_select does not check dog_is_removed';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. The restated security-definer surfaces still carry every filter.
--
-- These three are defined by CREATE OR REPLACE and RLS never reaches them, so
-- a future migration that restates one and drops a line has no other tripwire.
--
-- Every fetch is followed by an explicit `is null` guard before anything is
-- matched against it. Without one this whole section is a trapdoor: `select ...
-- into d` leaves d NULL when no row matches, `d not like '%x%'` on a NULL d
-- evaluates to NULL rather than true, and `if NULL then` does not fire — so a
-- function that had been deleted outright would sail through every check below
-- it. Section 1 guards the three functions 0028 CREATES with to_regprocedure;
-- these are the three it RESTATES, and they had no equivalent.
--
-- Note also what these checks can and cannot do. Matching a filter's text
-- against the whole function body cannot tell you which subquery it landed in.
-- That is why community_stats is additionally asserted behaviourally, twice, in
-- sections 4 and 9 — once per counter — rather than trusted to the occurrence
-- count below, which is kept only as a fast, early tripwire.
-- ---------------------------------------------------------------------------

do $$
declare
  d text;
  removed_hits int;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'browse_dogs';
  if d is null then
    raise exception 'FAIL: public.browse_dogs is missing';
  end if;
  if d not like '%o.deactivated_at is null%' then
    raise exception 'FAIL: browse_dogs lost `o.deactivated_at is null`; deactivated owners are back in the feed';
  end if;
  if d not like '%d.removed_at is null%' then
    raise exception 'FAIL: browse_dogs is missing `d.removed_at is null`';
  end if;

  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'browse_puppies';
  if d is null then
    raise exception 'FAIL: public.browse_puppies is missing';
  end if;
  if d not like '%o.deactivated_at is null%' then
    raise exception 'FAIL: browse_puppies lost `o.deactivated_at is null`';
  end if;
  if d not like '%d.removed_at is null%' then
    raise exception 'FAIL: browse_puppies is missing `d.removed_at is null`';
  end if;

  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'community_stats';
  if d is null then
    raise exception 'FAIL: public.community_stats is missing';
  end if;
  removed_hits := (length(d) - length(replace(d, 'removed_at', ''))) / length('removed_at');
  if removed_hits < 2 then
    raise exception 'FAIL: community_stats mentions removed_at % time(s); both dog-counting subqueries must filter it', removed_hits;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 4. Baseline: everything the later "it is gone" checks will contradict.
--
-- Read this section as the control group. Each count here is the reason the
-- matching count after removal proves something.
-- ---------------------------------------------------------------------------

set local role authenticated;

-- As the owner.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: the owner cannot see their own un-removed dog (got %)', n;
  end if;
end $$;

-- As a plain member who owns nothing: the browse surfaces and the photo.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_viewer'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: the fixture dog is not in browse_dogs before removal (got %); every later browse assertion would be vacuous', n;
  end if;

  select count(*) into n from public.browse_puppies() where id = (select v from t_ids where k = 'puppy');
  if n <> 1 then
    raise exception 'FAIL: the fixture puppy is not in browse_puppies before removal (got %)', n;
  end if;

  -- This is the regression guard for the photo policies. A non-owner must be
  -- able to read the photo row of somebody else's browsable dog; if the
  -- removed_at check were written as a join to public.dogs, this would be 0
  -- and every member's photos would be blank site-wide.
  select count(*) into n from public.dog_photos
  where dog_id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: a non-owner cannot see the photo of an un-removed browsable dog (got %); dog_photos_select_browsable is over-filtering', n;
  end if;

  if public.dog_is_removed((select v from t_ids where k = 'dog')) then
    raise exception 'FAIL: dog_is_removed reports an un-removed dog as removed';
  end if;

  if public.dog_is_removed(gen_random_uuid()) then
    raise exception 'FAIL: dog_is_removed returns true for a dog that does not exist';
  end if;

  -- The control for section 9's verified_dogs assertion. If the fixture dog is
  -- not baseline-verified here, it is not in community_stats()->>'verified_dogs'
  -- to begin with, that number cannot drop when the dog is removed, and the
  -- assertion becomes a test of nothing. dog_is_baseline_verified needs BOTH a
  -- verified vet_exam inside 12 months AND a verified vaccination; the fixture
  -- inserts exactly those two rows and nothing between here and there touches
  -- them.
  if not public.dog_is_baseline_verified((select v from t_ids where k = 'dog')) then
    raise exception 'FAIL: the fixture dog is not baseline-verified before removal; the verified_dogs assertion in section 9 would pass vacuously';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5. The deactivation filters, asserted visible -> hidden -> visible.
--
-- browse_dogs has carried `o.deactivated_at is null` since 0022 and 0028
-- restates the function in full, so this is the tripwire for dropping it.
-- browse_puppies never had it; this is the first assertion that it does.
-- The third state matters: without restoring the owner, a filter that hid
-- everything unconditionally would look identical to a correct one.
-- ---------------------------------------------------------------------------

reset role;
update public.owners set deactivated_at = now()
 where id = (select v from t_ids where k = 'dog_owner');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_viewer'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'dog');
  if n <> 0 then
    raise exception 'FAIL: browse_dogs still shows a deactivated owner''s dog (got %)', n;
  end if;

  select count(*) into n from public.browse_puppies() where id = (select v from t_ids where k = 'puppy');
  if n <> 0 then
    raise exception 'FAIL: browse_puppies still shows a deactivated owner''s puppy (got %)', n;
  end if;
end $$;

reset role;
update public.owners set deactivated_at = null
 where id = (select v from t_ids where k = 'dog_owner');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_viewer'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: reactivating the owner did not bring the dog back to browse_dogs (got %); the hidden result above proved nothing', n;
  end if;

  select count(*) into n from public.browse_puppies() where id = (select v from t_ids where k = 'puppy');
  if n <> 1 then
    raise exception 'FAIL: reactivating the owner did not bring the puppy back to browse_puppies (got %)', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. Only an admin may remove. Checked as the dog's own OWNER, who is the most
-- plausible unauthorised caller and the one with the strongest claim to the row.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);

do $$
begin
  begin
    perform public.admin_remove_dog((select v from t_ids where k = 'dog'), 'test');
    raise exception 'FAIL: a non-admin removed a dog';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise exception 'FAIL: admin_remove_dog raised sqlstate % (%) for a non-admin instead of insufficient_privilege',
        sqlstate, sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.admin_restore_dog((select v from t_ids where k = 'dog'));
    raise exception 'FAIL: a non-admin restored a dog';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise exception 'FAIL: admin_restore_dog raised sqlstate % (%) for a non-admin instead of insufficient_privilege',
        sqlstate, sqlerrm;
  end;
end $$;

-- The rejected calls must not have changed anything.
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: the refused non-admin calls still altered the dog''s visibility to its owner (got %)', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 7. An admin can actually update another member's dog — litter or no litter.
--
-- dogs_update_admin is permissive, and a permissive policy can be silently
-- overruled. dogs_litter_ownership_on_update is RESTRICTIVE on {authenticated}:
-- restrictive policies are AND'ed with the OR of the permissive ones, so its
-- WITH CHECK ("no litter, or you are the litter's breeder") is a veto that
-- dogs_update_admin cannot outvote. An admin is not the breeder — the member is
-- — so before 0028 restated it, every admin edit of a dog in a litter was
-- rejected. 0 of 20 production dogs carry a litter_id today, which is the only
-- reason nobody has hit it; it goes live with puppy listings.
--
-- A WITH CHECK failure raises insufficient_privilege rather than quietly
-- matching no rows, so it is trapped and re-raised as a FAIL — otherwise the
-- script would abort here with a bare RLS error that reads like a harness bug.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);

-- Vacuity guard: the row this section is about must genuinely be in a litter,
-- and must genuinely belong to somebody other than the admin doing the editing.
-- Read here as the admin, through dogs_select_admin.
do $$
declare n int;
begin
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'puppy')
    and litter_id is not null
    and owner_id = (select v from t_ids where k = 'dog_owner');
  if n <> 1 then
    raise exception 'FAIL: the fixture puppy is not another member''s dog with a non-null litter_id (got %); the restrictive-policy assertion below would prove nothing', n;
  end if;
end $$;

do $$
declare n int;
begin
  begin
    update public.dogs set name = 'Assertion puppy (admin edit)'
     where id = (select v from t_ids where k = 'puppy');
    get diagnostics n = row_count;
  exception
    when insufficient_privilege then
      raise exception 'FAIL: an admin cannot update another member''s dog that is in a litter; dogs_litter_ownership_on_update is vetoing dogs_update_admin, and Task 5''s updateDogAction will fail on exactly the puppy listings an admin most needs to moderate';
  end;
  if n <> 1 then
    raise exception 'FAIL: an admin''s update of another member''s litter puppy touched % row(s); expected exactly 1', n;
  end if;
end $$;

-- The ordinary path, with no litter involved, must still work. If the
-- restatement above broke the `litter_id is null` alternative, only this fires.
do $$
declare n int;
begin
  begin
    update public.dogs set name = 'Assertion dog (admin edit)'
     where id = (select v from t_ids where k = 'dog');
    get diagnostics n = row_count;
  exception
    when insufficient_privilege then
      raise exception 'FAIL: an admin cannot update another member''s dog even with litter_id null; the restated restrictive policy lost its first alternative';
  end;
  if n <> 1 then
    raise exception 'FAIL: an admin''s update of another member''s litter-less dog touched % row(s); expected exactly 1', n;
  end if;
end $$;

-- And the policy's original meaning is unchanged for the member it was written
-- for: the breeder can still edit their own puppy. A restatement that satisfied
-- the admin by breaking the breeder's alternative would pass both checks above.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  begin
    update public.dogs set name = 'Assertion puppy (breeder edit)'
     where id = (select v from t_ids where k = 'puppy');
    get diagnostics n = row_count;
  exception
    when insufficient_privilege then
      raise exception 'FAIL: the litter''s own breeder can no longer update their puppy; the restated restrictive policy lost its breeder alternative';
  end;
  if n <> 1 then
    raise exception 'FAIL: the breeder''s update of their own puppy touched % row(s); expected exactly 1', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 8. An admin removes the dog.
-- ---------------------------------------------------------------------------

-- Both dog counters, captured from ONE call, in one top-level statement,
-- immediately before the removal that must move both of them. Asserting `dogs`
-- alone — all this file used to do — cannot tell a restatement that filters the
-- dogs subquery from one that filters it twice and leaves verified_dogs
-- unfiltered.
--
-- Deliberately not wrapped in a do block: SET LOCAL / set_config(..., true)
-- issued inside a function has fussier scoping rules than the same call at
-- statement level, and a capture that quietly failed to stick would make
-- section 9 raise "unrecognized configuration parameter" instead of an
-- assertion result. Section 9 checks it stuck before it compares anything.
reset role;
select set_config('assert0028.dogs_before', s ->> 'dogs', true),
       set_config('assert0028.verified_before', s ->> 'verified_dogs', true)
from (select public.community_stats() as s) t;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);
select public.admin_remove_dog((select v from t_ids where k = 'dog'), 'assertion');

do $$
declare n int;
begin
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'dog')
    and removed_at is not null
    and removed_by = (select v from t_ids where k = 'dog_admin');
  if n <> 1 then
    raise exception 'FAIL: admin_remove_dog did not stamp removed_at/removed_by with the acting admin (got %)', n;
  end if;
end $$;

-- The admin still sees it — otherwise restore is impossible.
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: an admin cannot see a removed dog; it can never be restored';
  end if;
end $$;

-- Removing twice must fail rather than silently re-stamp removed_at, which
-- would rewrite the removal time and lose who removed it first.
do $$
declare raised boolean := false;
begin
  begin
    perform public.admin_remove_dog((select v from t_ids where k = 'dog'), 'again');
  exception
    when others then raised := true;
  end;
  if not raised then
    raise exception 'FAIL: admin_remove_dog silently re-removed an already-removed dog';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 9. The removal is visible everywhere it should be. Each of these contradicts
-- a count taken in section 4 against the same row and the same viewer.
-- ---------------------------------------------------------------------------

-- The owner no longer sees it.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'dog');
  if n <> 0 then
    raise exception 'FAIL: a removed dog is still visible to its owner (got %)', n;
  end if;
end $$;

-- A plain member sees neither the dog nor its photo.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_viewer'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'dog');
  if n <> 0 then
    raise exception 'FAIL: a removed dog still appears in browse_dogs (got %)', n;
  end if;

  select count(*) into n from public.dog_photos where dog_id = (select v from t_ids where k = 'dog');
  if n <> 0 then
    raise exception 'FAIL: a removed dog''s photo is still readable by other members (got %)', n;
  end if;

  if not public.dog_is_removed((select v from t_ids where k = 'dog')) then
    raise exception 'FAIL: dog_is_removed reports a removed dog as present; /dogs/[id] would still render it';
  end if;
end $$;

-- BOTH community_stats dog counters drop by exactly one. "Exactly" is the point:
-- a filter applied to the wrong subquery, or twice, moves these by the wrong
-- amount. And "both" is the point of doing it twice: `dogs` alone leaves the
-- verified_dogs subquery completely untested, so a restatement that filtered
-- `dogs` twice and verified_dogs not at all would satisfy the first check and
-- keep every removed-but-verified dog in the number the marketing page prints.
--
-- This can only pass if the fixture dog was baseline-verified before removal,
-- which section 4 asserts outright against the same dog id.
reset role;
do $$
declare
  stats json;
  before_txt text;
  after_txt text;
  before_n int;
  after_n int;
begin
  stats := public.community_stats();

  -- Both sides of both comparisons must actually be numbers. A missing capture
  -- or a dropped json key would otherwise leave one side NULL, `after_n <>
  -- before_n - 1` would evaluate to NULL, and the `if` would never fire — the
  -- same trapdoor section 3 documents. current_setting's second argument is
  -- missing_ok, so an unset name comes back NULL rather than raising.
  before_txt := current_setting('assert0028.dogs_before', true);
  after_txt := stats ->> 'dogs';
  if coalesce(before_txt, '') = '' or after_txt is null then
    raise exception 'FAIL: no dogs count on both sides of the removal (before=%, after=%); the comparison would be vacuous',
      coalesce(before_txt, '<unset>'), coalesce(after_txt, '<null>');
  end if;
  before_n := before_txt::int;
  after_n := after_txt::int;
  if after_n <> before_n - 1 then
    raise exception 'FAIL: community_stats dogs went % -> % across one removal; expected a drop of exactly 1',
      before_n, after_n;
  end if;

  before_txt := current_setting('assert0028.verified_before', true);
  after_txt := stats ->> 'verified_dogs';
  if coalesce(before_txt, '') = '' or after_txt is null then
    raise exception 'FAIL: no verified_dogs count on both sides of the removal (before=%, after=%); community_stats has stopped returning the key this assertion exists to cover',
      coalesce(before_txt, '<unset>'), coalesce(after_txt, '<null>');
  end if;
  before_n := before_txt::int;
  after_n := after_txt::int;
  if after_n <> before_n - 1 then
    raise exception 'FAIL: community_stats verified_dogs went % -> % across the removal of one baseline-verified dog; expected a drop of exactly 1. The `d.removed_at is null` filter is missing from, or duplicated outside, the verified_dogs subquery.',
      before_n, after_n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 10. What removal must NOT destroy. This is the entire argument for soft delete.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from public.dogs where id = (select v from t_ids where k = 'dog')) then
    raise exception 'FAIL: the dog row itself was destroyed';
  end if;

  if not exists (
    select 1 from public.health_documents
    where dog_id = (select v from t_ids where k = 'dog') and status = 'verified'
  ) then
    raise exception 'FAIL: the verified health document was destroyed by removal; the FK cascade fired';
  end if;

  if not exists (select 1 from public.dog_photos where dog_id = (select v from t_ids where k = 'dog')) then
    raise exception 'FAIL: the dog_photos row was destroyed by removal; only its visibility should change';
  end if;
end $$;

-- The name still resolves for existing threads and the review queue.
do $$
declare n int;
begin
  select count(*) into n from public.dogs_browsable where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: dogs_browsable no longer resolves a removed dog; match threads will blank out';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 11. Restore puts everything back. Without this the whole file is compatible
-- with a removal that is simply irreversible.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);
select public.admin_restore_dog((select v from t_ids where k = 'dog'));

do $$
declare n int;
begin
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'dog')
    and removed_at is null and removed_by is null;
  if n <> 1 then
    raise exception 'FAIL: admin_restore_dog did not clear removed_at/removed_by (got %)', n;
  end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: the owner cannot see their restored dog (got %)', n;
  end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_viewer'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: a restored dog did not return to browse_dogs (got %)', n;
  end if;

  select count(*) into n from public.dog_photos where dog_id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: a restored dog''s photo is still hidden from other members (got %)', n;
  end if;
end $$;

reset role;
rollback;
