-- supabase/tests/0022_deactivation_assertions.sql
--
-- Run this against a database that has migration 0022 applied. Everything
-- happens inside a transaction that ends in `rollback`, so it asserts against
-- real policies and real data without leaving anything behind.
--
--   psql "$DATABASE_URL" -f supabase/tests/0022_deactivation_assertions.sql
--
-- Every assertion is a `do $$ ... raise exception ... $$`, so the script fails
-- loudly on the first broken expectation rather than printing rows a reader has
-- to interpret.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two owners, one dog each, in a match.
-- ---------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('owner_a', gen_random_uuid()),
  ('owner_b', gen_random_uuid());

-- auth.users first: public.owners.id references it, and the handle_new_user
-- trigger populates the owners row for us — exercising the trigger 0022
-- rewrote rather than side-stepping it.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-assert@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select gen_random_uuid(), v, k || '-dog', (select id from public.breeds order by id limit 1),
       'female', current_date - interval '3 years'
from t_ids;


-- ---------------------------------------------------------------------------
-- 1. The trigger writes email, reconciling the drift 0022 documented.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.owners o
    join t_ids t on t.v = o.id
    where o.email is null
  ) then
    raise exception 'FAIL: handle_new_user did not populate owners.email';
  end if;
  raise notice 'PASS 1: owners.email populated by trigger';
end $$;


-- ---------------------------------------------------------------------------
-- 2. browse_dogs hides a deactivated owner — asserted in all three states.
--
-- Visible -> hidden -> visible again. The middle value on its own proves
-- nothing: a count of zero could equally mean the fixture was never visible.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select v from t_ids where k = 'owner_a');
  b uuid := (select v from t_ids where k = 'owner_b');
  before_count int;
  during_count int;
  after_count int;
begin
  -- Browse as A, looking for B's dog.
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  select count(*) into before_count from public.browse_dogs() where owner_id = b;

  update public.owners set deactivated_at = now() where id = b;
  select count(*) into during_count from public.browse_dogs() where owner_id = b;

  update public.owners set deactivated_at = null where id = b;
  select count(*) into after_count from public.browse_dogs() where owner_id = b;

  if before_count = 0 then
    raise exception 'FAIL: fixture dog was never browsable, so the test proves nothing';
  end if;
  if during_count <> 0 then
    raise exception 'FAIL: deactivated owner still appears in browse_dogs (got %)', during_count;
  end if;
  if after_count <> before_count then
    raise exception 'FAIL: reactivation did not restore browsability (% vs %)',
      after_count, before_count;
  end if;

  raise notice 'PASS 2: browse_dogs visible(%) -> hidden(%) -> visible(%)',
    before_count, during_count, after_count;
end $$;


-- ---------------------------------------------------------------------------
-- 3. dogs_browsable still resolves the name while deactivated.
--
-- This is the regression guard. Filtering the view would blank the dog's name
-- in every existing conversation and in the admin review queue.
-- ---------------------------------------------------------------------------
do $$
declare
  b uuid := (select v from t_ids where k = 'owner_b');
  name_while_gone text;
begin
  update public.owners set deactivated_at = now() where id = b;

  select name into name_while_gone
  from public.dogs_browsable where owner_id = b limit 1;

  if name_while_gone is null then
    raise exception
      'FAIL: dogs_browsable stopped resolving a deactivated owner''s dog name — '
      'existing threads and the admin queue would render blank names';
  end if;

  update public.owners set deactivated_at = null where id = b;
  raise notice 'PASS 3: dogs_browsable still resolves "%" while deactivated', name_while_gone;
end $$;


-- ---------------------------------------------------------------------------
-- 4. owner_is_active reports on OTHER owners.
--
-- The point of it being security definer. Under owners_select_own a plain
-- select against someone else's row returns nothing, so a page doing that would
-- read null and conclude "active" for every member on the site.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select v from t_ids where k = 'owner_a');
  b uuid := (select v from t_ids where k = 'owner_b');
  active_before boolean;
  active_after boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);

  select public.owner_is_active(b) into active_before;
  update public.owners set deactivated_at = now() where id = b;
  select public.owner_is_active(b) into active_after;
  update public.owners set deactivated_at = null where id = b;

  if not active_before then
    raise exception 'FAIL: owner_is_active said an active owner was inactive';
  end if;
  if active_after then
    raise exception 'FAIL: owner_is_active did not see the deactivation';
  end if;

  raise notice 'PASS 4: owner_is_active true -> false across another owner''s row';
end $$;


-- ---------------------------------------------------------------------------
-- 5. A member cannot write deactivated_at directly.
--
-- The column grant is what enforces this; an RLS policy could not.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select v from t_ids where k = 'owner_a');
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);

  begin
    update public.owners set deactivated_at = null where id = a;
    reset role;
    raise exception 'FAIL: authenticated was able to write deactivated_at directly';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS 5: direct write to deactivated_at refused (insufficient_privilege)';
  end;
end $$;


-- ---------------------------------------------------------------------------
-- 6. A member CAN still write the columns settings needs.
--
-- The revoke in 0022 is broad, so this proves it did not take the app with it.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select v from t_ids where k = 'owner_a');
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);

  update public.owners
     set display_name = 'Renamed', notify_messages = false, location_label = 'Chicago'
   where id = a;

  reset role;
  raise notice 'PASS 6: display_name, notify_* and location_label remain writable';
exception
  when insufficient_privilege then
    reset role;
    raise exception 'FAIL: the column revoke also blocked a legitimate settings write';
end $$;


-- ---------------------------------------------------------------------------
-- 7. An open report blocks the purge, for BOTH parties.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select v from t_ids where k = 'owner_a');
  b uuid := (select v from t_ids where k = 'owner_b');
  dog_a uuid := (select id from public.dogs where owner_id = a limit 1);
  dog_b uuid := (select id from public.dogs where owner_id = b limit 1);
  match_id uuid := gen_random_uuid();
  due_before int;
  due_during int;
begin
  -- Both deactivated long enough ago to be due.
  update public.owners set deactivated_at = now() - interval '31 days' where id in (a, b);

  select count(*) into due_before
  from public.owners_due_for_purge() where owner_id in (a, b);

  insert into public.matches (id, dog_a_id, dog_b_id)
  values (match_id, least(dog_a, dog_b), greatest(dog_a, dog_b));

  insert into public.match_reports (match_id, reporter_owner_id, reason, status)
  values (match_id, a, (select enumlabel::text::public.report_reason
                        from pg_enum e join pg_type t on t.oid = e.enumtypid
                        where t.typname = 'report_reason' order by e.enumsortorder limit 1),
          'open');

  select count(*) into due_during
  from public.owners_due_for_purge() where owner_id in (a, b);

  if due_before <> 2 then
    raise exception 'FAIL: expected both owners due for purge before the report, got %', due_before;
  end if;
  if due_during <> 0 then
    raise exception
      'FAIL: an open report did not protect both parties from purge (% still due)', due_during;
  end if;

  raise notice 'PASS 7: due(%) -> due(%) once a report is open', due_before, due_during;
end $$;

rollback;
