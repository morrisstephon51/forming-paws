-- supabase/tests/0037_exclude_listings_from_breeding_browse_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Transactional; ends in
-- rollback, so it asserts against real policies and real data without leaving
-- anything behind. Matches 0022, 0026, 0027, 0028.
--
-- Design rule carried from 0027/0028: no assertion may pass vacuously. The one
-- check that proves the fix ("a puppy is NOT in browse_dogs") is paired with a
-- control against the SAME surface and SAME viewer ("an adult dog IS in
-- browse_dogs") so a function that returned nothing at all would fail just as
-- loudly as one that still returned the puppy. The puppy's continued presence in
-- browse_puppies is asserted too, so a fix that reached too far -- hiding the
-- listing from the marketplace as well -- is caught.
--
-- On the UNFIXED browse_dogs (no `d.litter_id is null`) the puppy assertion in
-- section 2 fails: the puppy is returned and the count is 1, not 0. That is the
-- mutation proof -- this file goes red against main and green only once 0037 is
-- applied.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures. All ids in one granted temp table, per 0027/0028: most of the
-- script runs as `authenticated`, and without the grant every read of t_ids
-- dies on "permission denied" -- which reads as a script error, not a failed
-- assertion, so the checks would silently never run.
-- ---------------------------------------------------------------------------

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['owner','viewer','adult','sire','dam','puppy','litter']) k;

grant select on t_ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-0037@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('owner', 'viewer');

do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

-- Four dogs owned by `owner`: an adult breeding candidate (litter_id null), plus
-- a sire, a dam and a puppy. `viewer` owns nothing, which is what makes it a
-- valid stand-in for a member browsing the site. Births two years back so no age
-- band excludes them (browse_dogs is called with all-null params regardless).
insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select t.v,
       (select v from t_ids where k = 'owner'),
       'Assertion ' || t.k,
       (select id from public.breeds order by id limit 1),
       case when t.k in ('adult','sire') then 'male'::public.dog_sex else 'female'::public.dog_sex end,
       (current_date - interval '2 years')::date
from t_ids t
where t.k in ('adult', 'sire', 'dam', 'puppy');

-- Litter inserted directly (this runs as the migration role, RLS off), so the
-- litter-insert verification/cap gates are not in scope here -- exactly how 0028
-- builds its puppy fixture.
insert into public.litters (id, breeder_id, sire_id, dam_id, born_on, ready_on)
select (select v from t_ids where k = 'litter'),
       (select v from t_ids where k = 'owner'),
       (select v from t_ids where k = 'sire'),
       (select v from t_ids where k = 'dam'),
       current_date - 60,
       current_date + 14;

update public.dogs
   set litter_id = (select v from t_ids where k = 'litter')
 where id = (select v from t_ids where k = 'puppy');


-- ---------------------------------------------------------------------------
-- 1. Shape: browse_dogs still carries the two filters a CREATE OR REPLACE could
-- silently drop, and now also carries the litter_id partition. Matched against
-- the exact signature via to_regprocedure, with an is-null guard first, so a
-- renamed or re-signatured function is reported rather than skipped (0028 s.3).
-- ---------------------------------------------------------------------------

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p
  where p.oid = to_regprocedure(
    'public.browse_dogs(bigint, public.dog_sex, boolean, integer, integer, numeric)');
  if d is null then
    raise exception 'FAIL: public.browse_dogs(bigint, dog_sex, boolean, integer, integer, numeric) is missing or its signature changed';
  end if;
  if d not like '%o.deactivated_at is null%' then
    raise exception 'FAIL: browse_dogs lost `o.deactivated_at is null`; deactivated owners are back in the feed';
  end if;
  if d not like '%d.removed_at is null%' then
    raise exception 'FAIL: browse_dogs lost `d.removed_at is null`; moderated dogs are back in the feed';
  end if;
  if d not like '%litter_id is null%' then
    raise exception 'FAIL: browse_dogs is missing `d.litter_id is null`; marketplace listings still leak into the breeding browse (0037 not applied)';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Behaviour, as a plain member who owns nothing. The control and the fix are
-- the same surface and the same viewer, so neither can pass vacuously.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'viewer'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  -- Control: the adult breeding candidate IS in browse_dogs. If this is ever 0,
  -- the fix assertion below proves nothing (the function is hiding everything).
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'adult');
  if n <> 1 then
    raise exception 'FAIL: the adult breeding dog is not in browse_dogs (got %); every assertion below would be vacuous', n;
  end if;

  -- The fix: a marketplace listing (litter_id is not null) must NOT appear in the
  -- breeding browse. This is 1 on the unfixed function and 0 once 0037 applies.
  select count(*) into n from public.browse_dogs() where id = (select v from t_ids where k = 'puppy');
  if n <> 0 then
    raise exception 'FAIL: a puppy listing still appears in browse_dogs (got %); browse_dogs is missing `d.litter_id is null` and for-sale puppies pollute the breeding feed', n;
  end if;

  -- Regression guard: the fix must not reach the marketplace. The puppy still
  -- belongs on browse_puppies.
  select count(*) into n from public.browse_puppies() where id = (select v from t_ids where k = 'puppy');
  if n <> 1 then
    raise exception 'FAIL: the puppy is no longer in browse_puppies (got %); 0037 over-reached and broke the marketplace surface', n;
  end if;

  -- Symmetry sanity: the adult (litter_id null) was never a marketplace listing,
  -- so browse_puppies must not return it. Confirms the two surfaces partition the
  -- dog population rather than merely both-filtering.
  select count(*) into n from public.browse_puppies() where id = (select v from t_ids where k = 'adult');
  if n <> 0 then
    raise exception 'FAIL: an adult breeding dog (litter_id null) appears in browse_puppies (got %)', n;
  end if;
end $$;

reset role;
rollback;
