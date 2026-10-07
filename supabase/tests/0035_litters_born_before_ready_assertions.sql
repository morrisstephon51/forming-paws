-- supabase/tests/0035_litters_born_before_ready_assertions.sql
--
-- Run against a database that has migration 0035 applied, e.g.
--   psql "$DATABASE_URL" -f supabase/tests/0035_litters_born_before_ready_assertions.sql
--
-- Everything happens inside a transaction that ends in `rollback`, so it
-- asserts against the real constraint and leaves nothing behind. Each
-- assertion raises `FAIL ...` loudly on the first broken expectation, the same
-- shape the other *_assertions.sql files use.
--
-- This script runs as the migration role (table owner), which bypasses RLS the
-- same way 0028/0033 do when they are not explicitly testing a policy -- it
-- exercises the CHECK constraint directly, not litters_insert_own_verified.

begin;

-- ---------------------------------------------------------------------------
-- 0. Shape: the constraint exists on public.litters. A missing constraint
--    would make the behavioural assertions below pass vacuously (the bad
--    insert would succeed for the wrong reason), so rule it out first.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.litters'::regclass
      and conname = 'litters_born_before_ready'
      and contype = 'c'
  ) then
    raise exception 'FAIL 0: constraint litters_born_before_ready is missing from public.litters';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixture: one breeder and two of their own distinct dogs, built the way
-- 0033's assertions do -- insert auth.users and let on_auth_user_created
-- create the owners row, then insert the dogs directly.
-- ---------------------------------------------------------------------------
create temporary table t (k text primary key, id uuid);
insert into t (k, id) values
  ('breeder', gen_random_uuid()),
  ('sire', gen_random_uuid()),
  ('dam', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'breeder-0035@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', 'breeder')
from t where k = 'breeder';

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select id from t where k = 'sire'),
       (select id from t where k = 'breeder'),
       'Sire', (select id from public.breeds order by id limit 1), 'male', '2020-01-01';

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select id from t where k = 'dam'),
       (select id from t where k = 'breeder'),
       'Dam', (select id from public.breeds order by id limit 1), 'female', '2020-01-01';

-- ---------------------------------------------------------------------------
-- 1. Rejects born_on AFTER ready_on (ready before born is impossible).
-- ---------------------------------------------------------------------------
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.litters (breeder_id, sire_id, dam_id, born_on, ready_on)
    values ((select id from t where k = 'breeder'),
            (select id from t where k = 'sire'),
            (select id from t where k = 'dam'),
            '2024-06-01', '2024-05-01');
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL 1: a litter with born_on > ready_on was accepted';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Accepts born_on BEFORE ready_on (the normal case).
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.litters (breeder_id, sire_id, dam_id, born_on, ready_on)
  values ((select id from t where k = 'breeder'),
          (select id from t where k = 'sire'),
          (select id from t where k = 'dam'),
          '2024-05-01', '2024-06-01');
exception when others then
  raise exception 'FAIL 2: a valid litter (born_on <= ready_on) was rejected: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 3. NULL-permissive: a known born_on with an unknown ready_on is allowed.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.litters (breeder_id, sire_id, dam_id, born_on, ready_on)
  values ((select id from t where k = 'breeder'),
          (select id from t where k = 'sire'),
          (select id from t where k = 'dam'),
          '2024-05-01', null);
exception when others then
  raise exception 'FAIL 3: a litter with born_on and null ready_on was rejected: %', sqlerrm;
end $$;

rollback;
