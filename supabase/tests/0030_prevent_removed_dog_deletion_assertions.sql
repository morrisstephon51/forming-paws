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
-- What each of the five claims needs to be true in the database to mean
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
--
--   4. "an admin CAN delete a removed dog" needs an acting admin who also OWNS
--      the removed row. dogs_delete_own (`owner_id = auth.uid()`) is the only
--      DELETE-capable policy on public.dogs — 0028's section 2 pins that set
--      exactly — so an admin has no route to another member's dog at all and
--      the only reachable form of this claim is an admin's own dog. Section 6
--      builds a fourth fixture dog owned by the admin, has the admin remove it,
--      and reads it back through dogs_select_admin (the same visibility the
--      filtered delete depends on) immediately before deleting it.
--
--   5. "a caller with no JWT can still delete a removed dog" needs the row to be
--      present and removed, and auth.uid() to actually BE null, at the moment of
--      the delete. Section 7 asserts both immediately beforehand: without the
--      null check it would silently be re-testing section 6's admin branch, and
--      without the presence check a delete reporting 0 rows would be
--      indistinguishable from the refusal it is supposed to rule out.

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
from unnest(array['dog_admin', 'dog_owner', 'dog', 'spare', 'keeper', 'admin_dog']) k;

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

-- A fourth dog, owned by dog_admin rather than dog_owner, for section 6.
--
-- The admin-permit branch is only reachable on an admin's OWN dog: dogs_delete_
-- own (`owner_id = auth.uid()`) is the only DELETE-capable policy on public.dogs
-- and 0028's section 2 pins that set to exactly {dogs_delete_own}, so an admin
-- deleting somebody else's removed dog matches no row and never reaches the
-- trigger at all. A fixture built the other way round — the admin deleting
-- dog_owner's removed dog — would report 0 rows and fail, and it would fail for
-- a reason that has nothing to do with the branch being asserted.
--
-- It disturbs nothing else in the file. Section 3's guards are scoped either to
-- dog_owner (who does not own this row) or to the fixture dog's id, and section
-- 4's unfiltered DELETE runs as dog_owner, whose candidate set under
-- dogs_delete_own is their own rows only. It carries no health documents and no
-- photo on purpose: section 6 is about a refusal NOT happening, and giving it
-- children would only add cascade noise to a delete that is supposed to succeed.
insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'admin_dog'),
       (select v from t_ids where k = 'dog_admin'),
       'Assertion 0030 admin_dog',
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '2 years')::date;


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

-- Guarded, and this is the only statement in the file that is.
--
-- Every other delete here names a row. `where id = <fixture id>` stays bounded
-- by the fixture whatever role or identity it ends up running under, so the
-- worst a lost `set local role` can do to those is make an assertion fail. This
-- one names nothing: its candidate set is decided entirely by who is asking.
--
-- As `authenticated` with dog_owner's JWT that set is two fixture rows. If the
-- role switch two statements up did not take effect — a pooler resetting session
-- state between statements, a tool that splits this file across connections, a
-- later edit that moves or drops the `set local` — the statement instead runs as
-- postgres, which holds rolbypassrls, and the candidate set is EVERY ROW IN
-- public.dogs: 20 dogs on production today, cascading 8 health documents, 1
-- match and its 7 messages. The rollback at the end of this file means nothing
-- is permanently lost, but that is the smaller half of the problem.
--
-- The larger half is that the file would then PASS while proving nothing about
-- RLS. The trigger still fires on the fixture's removed row, sqlerrm still ends
-- in "may only be deleted by an admin", `raised` is still true, and every count
-- in section 5 is scoped to a fixture id, so all of them still hold. A green run
-- would mean "postgres cannot delete a removed dog either", which nobody is
-- asking and which would be read as "a member cannot".
--
-- So prove the identity first and refuse rather than assert: a failure here is a
-- broken harness, not a failed security claim, and it must not be reported as
-- one.
do $$ begin
  if current_user <> 'authenticated' then
    raise exception 'FAIL: about to run an unfiltered DELETE as %; refusing', current_user;
  end if;
  if auth.uid() is distinct from (select v from t_ids where k = 'dog_owner') then
    raise exception 'FAIL: the unfiltered DELETE would run under the wrong identity (%)', auth.uid();
  end if;
end $$;

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


-- ---------------------------------------------------------------------------
-- 6. The permit branch. An admin CAN hard-delete a removed dog.
--
-- Nothing above this line notices if `not public.is_admin()` falls out of the
-- trigger's condition, or if is_admin() comes to answer false for a real admin.
-- A trigger that refuses EVERY caller of a removed row, admins included, passes
-- sections 1 through 5 exactly as a correct one does: section 2's control
-- deletes an UN-removed dog, so it never reaches the admin clause at all, and
-- sections 4 and 5 are asserting a refusal in the first place. This section is
-- the only thing in the file that fails.
--
-- Asserted on the admin's OWN dog, because that is the only reachable form of
-- the claim. dogs_delete_own (`owner_id = auth.uid()`) is the only DELETE-
-- capable policy on public.dogs and 0028's section 2 pins that set exactly, so
-- an admin's delete of another member's removed dog matches no row and never
-- reaches this trigger — asserting THAT would be asserting the absence of a
-- policy, which 0028 already does directly. What is asserted here is what 0030's
-- header now states outright: an admin may permanently destroy the moderation
-- evidence against their own dog.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);
select public.admin_remove_dog((select v from t_ids where k = 'admin_dog'), 'assertion 0030 admin self-removal');

-- Vacuity guard: the row must exist, be owned by the acting admin, and be
-- REMOVED. Removed above all — an un-removed dog is deleted by its own owner
-- with the trigger's condition short-circuiting on `old.removed_at is not null`,
-- which is section 2's statement, not this one; without this half of the guard
-- the section below would succeed while consulting the admin clause never.
--
-- Read AS the admin rather than with RLS off, deliberately — that is
-- the same visibility the delete below depends on. A DELETE whose WHERE reads a
-- column has the SELECT policies applied to it too, and dogs_select_own excludes
-- removed rows from their own owner, so this statement can only find its row
-- through dogs_select_admin, which 0028 deliberately leaves unfiltered. Reading
-- with RLS off here would conceal a missing dogs_select_admin and turn the
-- delete's "0 rows" into an unexplained accusation against 0030's trigger.
do $$
declare n int;
begin
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'admin_dog')
    and owner_id = (select v from t_ids where k = 'dog_admin')
    and removed_at is not null;
  if n <> 1 then
    raise exception 'FAIL: the admin''s own dog is not a present, removed, admin-visible row (got %); the delete below would report 0 rows for a reason that has nothing to do with 0030', n;
  end if;
end $$;

do $$
declare n int;
begin
  begin
    delete from public.dogs where id = (select v from t_ids where k = 'admin_dog');
    get diagnostics n = row_count;
  exception
    when others then
      raise exception 'FAIL: an admin''s delete of their OWN removed dog was refused with sqlstate % (%). 0030''s `not public.is_admin()` clause is live rather than decorative — an admin is also a member, and dogs_delete_own admits them to their own row — so as written the trigger is refusing the one caller the migration says is entitled.',
        sqlstate, sqlerrm;
  end;
  if n <> 1 then
    raise exception 'FAIL: an admin''s delete of their own removed dog reported % row(s); expected exactly 1. A BEFORE DELETE trigger that returns NULL raises nothing and cancels the row silently, and this is what that looks like.', n;
  end if;
end $$;

-- Measured, not assumed, as in section 2: the check above reads a count reported
-- by the statement whose effect is in question, this one reads the table. Taken
-- with RLS off, because to the admin a deleted dog and a hidden dog are the same
-- count.
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'admin_dog');
  if n <> 0 then
    raise exception 'FAIL: the admin''s delete reported 1 row but their removed dog is still in the table (got %); the delete did not actually happen', n;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 7. The null-auth.uid() path still deletes. LAST SECTION, DELIBERATELY.
--
-- The trigger's `auth.uid() is not null` clause is not a courtesy to the SQL
-- editor. public.purge_deactivated_accounts() runs nightly from pg_cron as
-- postgres — no JWT context, so a null auth.uid() — and deletes straight out of
-- auth.users; that delete cascades auth.users -> owners -> dogs, and a CASCADE
-- fires row triggers exactly as a direct DELETE does, so this trigger is
-- consulted once for every dog the purge takes. Drop the clause and one
-- moderated dog belonging to one member inside the 30-day purge window aborts
-- the entire job — every night, for everybody — and nothing else in this file
-- would notice, because every other section supplies a JWT.
--
-- LAST, and this is load-bearing rather than tidiness: this section hard-deletes
-- the very row sections 4 and 5 assert survived. Run any earlier, section 5's
-- "the removed dog is still here" becomes an assertion about a row this section
-- already took, and the file would report a cascade failure that never happened.
-- Nothing may be added after it except the rollback.
--
-- It deletes public.dogs directly rather than deleting out of auth.users as the
-- real job does. Same trigger, same OLD row, same null identity; going through
-- auth.users would additionally drag dog_owner's owners row and their surviving
-- keeper dog away with it, proving nothing extra about the clause under test.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '', true);

-- Vacuity guard in two halves. The identity half first: with the claims cleared
-- auth.uid() must actually BE null, or this section is quietly re-running
-- section 6's admin branch — dog_admin's claims are the ones most recently set —
-- and would pass for a reason that is not the one being claimed. Then the row
-- half, in two parts: PRESENT, or the delete below reports 0 rows for a reason
-- that has nothing to do with any trigger; and still REMOVED, or the trigger's
-- condition short-circuits on `old.removed_at is not null` and the delete
-- succeeds without the null-uid clause ever being reached — a pass that asserts
-- nothing, which is exactly what this file's design rule forbids.
do $$
declare n int;
begin
  if auth.uid() is not null then
    raise exception 'FAIL: request.jwt.claims did not clear; auth.uid() is still %, so this section would be re-testing section 6''s admin branch rather than the null-uid one', auth.uid();
  end if;
  select count(*) into n from public.dogs
  where id = (select v from t_ids where k = 'dog') and removed_at is not null;
  if n <> 1 then
    raise exception 'FAIL: the removed fixture dog is not present going into the purge-path delete (got %); the delete below could then report 0 rows with nothing having refused anything', n;
  end if;
end $$;

do $$
declare n int;
begin
  begin
    delete from public.dogs where id = (select v from t_ids where k = 'dog');
    get diagnostics n = row_count;
  exception
    when others then
      raise exception 'FAIL: deleting a removed dog with a null auth.uid() was refused with sqlstate % (%). That is the path public.purge_deactivated_accounts() takes from pg_cron, so the nightly purge now aborts for every member holding a moderated dog, silently, until someone reads this trigger.',
        sqlstate, sqlerrm;
  end;
  if n <> 1 then
    raise exception 'FAIL: the null-auth.uid() delete of the removed dog reported % row(s); expected exactly 1. A BEFORE DELETE trigger that returns NULL cancels the row silently and reports 0, which is the purge quietly leaving rows behind with no error to find it by.', n;
  end if;
end $$;

-- Measured, not assumed, as in sections 2 and 6.
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select v from t_ids where k = 'dog');
  if n <> 0 then
    raise exception 'FAIL: the null-auth.uid() delete reported 1 row but the removed dog is still in the table (got %); the purge path does not actually clear it', n;
  end if;
end $$;

reset role;
rollback;
