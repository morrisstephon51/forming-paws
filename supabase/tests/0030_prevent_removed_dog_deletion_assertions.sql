-- supabase/tests/0030_prevent_removed_dog_deletion_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Transactional; ends in
-- rollback, so it asserts against real policies and real data without leaving
-- anything behind. Matches 0022, 0026, 0027 and 0028.
--
-- Design rule carried from 0027 and 0028: no assertion may be able to pass
-- vacuously. Every refusal is preceded by a guard proving the statement it
-- refuses actually had something to act on, and by a control proving the same
-- statement succeeds when it should.
--
-- What each of the three claims needs to be true in the database to mean
-- anything, and where that is established:
--
--   1. "an owner CAN delete their own un-removed dog" needs a dog that exists,
--      is owned by the acting member and has removed_at null at the moment of
--      the delete. Section 2's guard asserts exactly that triple, as the owner,
--      immediately beforehand. Without this control a trigger that refused every
--      delete — or one that returns NULL and silently cancels every delete —
--      would satisfy sections 4 and 5 perfectly.
--
--   2. "an owner CANNOT delete their own removed dog, unfiltered" needs the
--      acting member to own at least one row with removed_at set at the moment
--      of the unfiltered statement, or the statement changes nothing and the
--      trigger has nothing to refuse. Section 3's guard asserts the owner owns
--      exactly two dogs, exactly one of them removed, read with RLS off because
--      dogs_select_own hides the removed one from its own owner.
--
--   3. "the dog, its health documents and its photo survive" needs those rows to
--      have existed before the refused statement. Section 3's guard counts them
--      (2 health documents, 1 photo) before anything is deleted; section 5
--      counts them again afterwards. Both reads are taken with RLS off, so a
--      zero means the row is gone rather than merely invisible — and dogs_
--      select_own plus dog_photos' owner policies make "merely invisible" the
--      default state for a removed dog, which is exactly the confusion that
--      would otherwise make section 5 unreadable.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- Every id lives in ONE temp table. Temp tables are owned by the creating role
-- and most of this script runs as `authenticated`; without the grant below,
-- every check dies on `permission denied for table t_ids`, which reads as a
-- script error rather than a failed assertion, so the security checks silently
-- never run. That bug was found in 0027 and re-fixed in 0028. Keeping all ids in
-- a single granted table means a later edit cannot reintroduce it by adding a
-- second temp table and forgetting the grant.
-- ---------------------------------------------------------------------------

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['dog_admin', 'dog_owner', 'dog', 'spare', 'keeper']) k;

grant select on t_ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-0030@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('dog_admin', 'dog_owner');

select public.grant_role((select v from t_ids where k = 'dog_admin'), 'admin');

-- A breed must exist or the fixture insert below fails for an unrelated reason.
do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

-- Three dogs, all owned by dog_owner, each with a distinct job:
--
--   dog     the one an admin removes. It carries the health documents and the
--           photo, because the FK cascade taking those is the whole reason this
--           migration exists.
--   spare   the control in section 2. It is deleted by its own owner while
--           un-removed and must actually go.
--   keeper  un-removed, and never deliberately deleted. It is in the candidate
--           set of section 4's unfiltered `delete from public.dogs`, so its
--           survival in section 5 is what proves the trigger ABORTED the
--           statement rather than quietly skipping one row — which is what a
--           `return null` implementation would do, taking keeper with it.
--
-- No litter is created. litters.sire_id and litters.dam_id reference dogs with
-- NO ACTION rather than CASCADE, so a dog in a litter would make the unfiltered
-- delete in section 4 capable of failing with a foreign_key_violation, and that
-- refusal is not the refusal this file is about.
insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select t.v,
       (select v from t_ids where k = 'dog_owner'),
       'Assertion 0030 ' || t.k,
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '2 years')::date
from t_ids t
where t.k in ('dog', 'spare', 'keeper');

-- Two health documents and a photo on the dog that gets removed. Soft delete
-- exists precisely so these survive moderation; without them, "the vet records
-- survive the refused delete" is an assertion about an empty table. Two
-- documents rather than one so a cascade that destroyed only some of them still
-- fails the count in section 5.
insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'dog'), 'assertions/0030/vax.pdf',
       'vaccination'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select (select v from t_ids where k = 'dog'), 'assertions/0030/vet-exam.pdf',
       'vet_exam'::public.health_doc_type, current_date - 30,
       'verified'::public.health_doc_status;

insert into public.dog_photos (dog_id, storage_path, position)
select (select v from t_ids where k = 'dog'), 'assertions/0030/photo.jpg', 0;


-- ---------------------------------------------------------------------------
-- 1. Shape.
--
-- Without this, a database where 0030 was never applied fails at section 4 with
-- "a member hard-deleted their own moderated dog", which is true but reads like
-- a policy regression rather than a missing migration. This says which it is.
-- ---------------------------------------------------------------------------

do $$
declare def text;
begin
  select pg_get_triggerdef(t.oid) into def
  from pg_trigger t
  where t.tgrelid = 'public.dogs'::regclass
    and t.tgname = 'dogs_prevent_removed_dog_deletion'
    and not t.tgisinternal;
  if def is null then
    raise exception 'FAIL: trigger dogs_prevent_removed_dog_deletion is missing from public.dogs; migration 0030 has not been applied';
  end if;
  -- BEFORE, not AFTER. An AFTER DELETE trigger fires alongside the FK cascade
  -- rather than ahead of it; the raise would still roll the transaction back,
  -- but the ordering guarantee this depends on would be gone.
  if def not like '%BEFORE DELETE%' then
    raise exception 'FAIL: dogs_prevent_removed_dog_deletion is (%); expected a BEFORE DELETE trigger', def;
  end if;
  -- FOR EACH STATEMENT would never see OLD.removed_at and could not refuse
  -- anything row-wise.
  if def not like '%FOR EACH ROW%' then
    raise exception 'FAIL: dogs_prevent_removed_dog_deletion is not FOR EACH ROW (%); a statement-level trigger has no OLD row to inspect', def;
  end if;
end $$;

do $$
declare secdef boolean;
begin
  select p.prosecdef into secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'prevent_removed_dog_deletion';
  if secdef is null then
    raise exception 'FAIL: public.prevent_removed_dog_deletion() is missing; the trigger above has nothing to execute';
  end if;
  -- Matches 0028's sibling, which is deliberately not definer either. is_admin()
  -- and auth.uid() both resolve through the request.jwt.claims GUC rather than
  -- current_user, so definer rights would buy this function nothing and would
  -- only hand postgres's privileges to whatever a later edit adds to the body.
  if secdef then
    raise exception 'FAIL: public.prevent_removed_dog_deletion() is SECURITY DEFINER; it must evaluate the caller''s own identity, like 0028''s sibling trigger function';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. The control. An owner deletes their own UN-REMOVED dog, and it works.
--
-- This is the assertion that stops every other assertion in this file from
-- being satisfied by a trigger that simply refuses all deletion. Deleting your
-- own dog is intended product behaviour; dogs_delete_own has existed since 0003
-- for exactly that.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);

-- Vacuity guard: the row must exist, belong to this member, and be un-removed.
-- Read as the owner, through dogs_select_own, which is the same visibility the
-- delete below depends on.
do $$
declare n int;
begin
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'spare')
    and owner_id = (select v from t_ids where k = 'dog_owner')
    and removed_at is null;
  if n <> 1 then
    raise exception 'FAIL: the fixture spare dog is not a present, un-removed dog owned by the acting member (got %); the control delete below would prove nothing', n;
  end if;
end $$;

do $$
declare n int;
begin
  begin
    delete from public.dogs where id = (select v from t_ids where k = 'spare');
    get diagnostics n = row_count;
  exception
    when others then
      raise exception 'FAIL: an owner''s delete of their own UN-REMOVED dog was refused with sqlstate % (%). 0030''s trigger must only refuse rows whose removed_at is set; as written it is breaking ordinary product behaviour that dogs_delete_own has permitted since 0003.',
        sqlstate, sqlerrm;
  end;
  if n <> 1 then
    raise exception 'FAIL: an owner''s delete of their own un-removed dog reported % row(s); expected exactly 1. A BEFORE DELETE trigger that returns NULL raises nothing and cancels the row silently, and this is what that looks like.', n;
  end if;
end $$;

-- Measured, not assumed. The check above reads a row count reported by the same
-- statement whose effect is in question; this one reads the table instead, which
-- is a different instrument. It is taken with RLS off because to the owner a
-- deleted dog and a hidden dog are the same count.
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'spare');
  if n <> 0 then
    raise exception 'FAIL: the control delete reported 1 row but the un-removed dog is still in the table (got %); the delete did not actually happen', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. An admin removes the dog under test, and the state section 4 needs is
-- confirmed to exist.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);
select public.admin_remove_dog((select v from t_ids where k = 'dog'), 'assertion 0030');

-- Every guard below runs with RLS off, on purpose. dogs_select_own excludes
-- removed rows from their own owner and dog_photos' owner policy reaches the
-- owner through public.dogs, so as the owner all four of these counts would be
-- zero for reasons that have nothing to do with deletion.
reset role;
do $$
declare
  total int;
  removed int;
  docs int;
  photos int;
begin
  select count(*) into total from public.dogs
  where owner_id = (select v from t_ids where k = 'dog_owner');
  if total <> 2 then
    raise exception 'FAIL: the fixture owner owns % dog(s) going into the unfiltered DELETE; expected exactly 2 (one removed, one not)', total;
  end if;

  select count(*) into removed from public.dogs
  where owner_id = (select v from t_ids where k = 'dog_owner') and removed_at is not null;
  if removed <> 1 then
    raise exception 'FAIL: the fixture owner owns % removed dog(s); expected exactly 1. With none, the unfiltered DELETE below has no removed row to act on, the trigger is never consulted, and the refusal it asserts could not happen.', removed;
  end if;

  select count(*) into docs from public.health_documents
  where dog_id = (select v from t_ids where k = 'dog');
  if docs <> 2 then
    raise exception 'FAIL: the removed dog carries % health document(s) before the delete; expected 2. Section 5''s "the vet records survived" would then be an assertion about an empty table.', docs;
  end if;

  select count(*) into photos from public.dog_photos
  where dog_id = (select v from t_ids where k = 'dog');
  if photos <> 1 then
    raise exception 'FAIL: the removed dog carries % photo row(s) before the delete; expected 1. Section 5''s photo check would then pass vacuously.', photos;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 4. The refusal, in the UNFILTERED statement shape.
--
-- The filtered shape (`delete from public.dogs where id = <dog>`) is already
-- refused, but by a different mechanism: a DELETE whose WHERE reads a column has
-- the SELECT policies applied to it as well, and 0028 took removed rows out of
-- dogs_select_own, so the statement matches nothing. Asserting the filtered
-- shape here would therefore pass on a database with no trigger at all, for a
-- reason that has nothing to do with 0030.
--
-- The unfiltered shape reads no column, so no SELECT policy is ever consulted;
-- dogs_delete_own alone then permits it on every row this member owns. That is
-- the shape that is actually dangerous and it is the only one worth asserting.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);

do $$
declare
  n int;
  raised boolean := false;
begin
  begin
    -- No WHERE clause, and that is the entire point.
    delete from public.dogs;
    get diagnostics n = row_count;
  exception
    when others then
      -- Discriminated, like the handlers in 0028's sections 6, 8 and 12. A bare
      -- `when others then raised := true` accepts ANY failure — a dropped grant,
      -- a bad fixture id, an unrelated FK violation — and would report a refusal
      -- that never happened. 0030's trigger raises a plain P0001 whose message
      -- ends in "may only be deleted by an admin"; note that 0028's sibling ends
      -- in "may only be changed by an admin", so this match cannot be satisfied
      -- by the UPDATE trigger firing for some other reason.
      if sqlerrm not like '%may only be deleted by an admin%' then
        raise exception 'FAIL: the owner''s unfiltered DELETE raised sqlstate % (%), which is not 0030''s trigger refusing it; this assertion proves nothing',
          sqlstate, sqlerrm;
      end if;
      raised := true;
  end;
  if not raised then
    if n = 0 then
      raise exception 'FAIL: the unfiltered DELETE matched no row at all; the refusal it is supposed to provoke was never reached';
    end if;
    raise exception 'FAIL: a member hard-deleted their own moderated dog with an unfiltered DELETE (% row(s)). dogs_delete_own restricts nothing beyond ownership, and a DELETE that reads no column has no SELECT policy applied to it, so only a trigger can stop this — and the ON DELETE CASCADE into health_documents, dog_photos, dog_interests, matches and puppy_inquiries has just destroyed the evidence for the moderation.', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5. Nothing was destroyed. An exception handler rolls back to its implicit
-- savepoint, so this is the proof that no row leaked past the trigger.
--
-- Read with RLS off throughout. The whole point of the removal is that these
-- rows are invisible to their owner and to every other member, so reading them
-- under RLS could not distinguish "still there" from "cascaded away" — which is
-- the distinction this section exists to make.
-- ---------------------------------------------------------------------------

reset role;
do $$
declare
  n int;
  docs int;
begin
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'dog') and removed_at is not null;
  if n <> 1 then
    raise exception 'FAIL: the refused unfiltered DELETE still destroyed the removed dog (got %)', n;
  end if;

  select count(*) into docs from public.health_documents
  where dog_id = (select v from t_ids where k = 'dog');
  if docs <> 2 then
    raise exception 'FAIL: % of the 2 health documents survived the refused DELETE; the ON DELETE CASCADE fired and the verified vet records that justify the moderation are gone', docs;
  end if;

  select count(*) into n from public.dog_photos
  where dog_id = (select v from t_ids where k = 'dog');
  if n <> 1 then
    raise exception 'FAIL: % dog_photos row(s) survived the refused DELETE; expected 1. The cascade fired.', n;
  end if;

  -- The un-removed sibling that was in the same candidate set. If it is gone,
  -- the trigger skipped the removed row rather than aborting the statement —
  -- a `return null` implementation does exactly that, and every check above
  -- would still pass.
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'keeper');
  if n <> 1 then
    raise exception 'FAIL: the owner''s un-removed dog was destroyed by the refused statement (got %); the trigger silently cancelled the removed row instead of aborting the whole DELETE', n;
  end if;
end $$;

reset role;
rollback;
