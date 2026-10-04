-- supabase/tests/0031_admin_storage_and_policy_codification_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Transactional; ends in
-- rollback, so it asserts against real policies, real grants and real RLS
-- evaluation without leaving anything behind. Matches 0022, 0026, 0027 and 0028.
--
-- Design rule carried from 0027 and 0028: no assertion may be able to pass
-- vacuously. Every "it is denied" check is paired with an "it was allowed a
-- moment ago" check against the same row, the same viewer and the same surface,
-- and every catalog sweep asserts that it actually scanned something.
--
-- THE TEMP-TABLE TRAP. Temp tables are owned by the creating role, and section 5
-- runs as `authenticated`; without `grant select on t_ids to authenticated`
-- every check after the role switch dies on `permission denied for table t_ids`,
-- which surfaces as a SCRIPT error rather than a failed assertion and silently
-- skips everything below it. That bug was found in 0027 and again in 0028. The
-- grant is carried below. Sections 1-4 touch no fixture at all and are ordered
-- FIRST on purpose, so that even a fixture that cannot be built cannot suppress
-- the three assertions this task requires.

begin;

-- ---------------------------------------------------------------------------
-- 1. NO POLICY IN ANY SCHEMA READS owners.is_admin INLINE
--
-- Deliberately catalog-wide and NOT scoped to `public`. A sweep scoped to
-- `public` is precisely what let this defect through: 0026 fixed the two inlined
-- lookups it could see and recorded "the remaining 2 policies", while a third
-- sat in `storage` reading the column that 0014's trigger freezes.
--
-- What must be true for this to pass: for every row in pg_policy, in every
-- schema, the rendered USING and WITH CHECK expressions must contain no
-- occurrence of the identifier `is_admin` other than as a call to the function
-- `is_admin()` / `public.is_admin()`. The strip-then-search shape is used rather
-- than a LIKE on '%o.is_admin%' so it also catches `owners.is_admin`, a bare
-- `is_admin` column reference, and any aliasing or line-wrapping pg_get_expr
-- chooses.
--
-- Cannot pass vacuously: the loop counts what it scanned and fails if it saw
-- fewer than 40 policies (production has 57 across public and storage). A
-- version of this check that stopped reaching pg_policy would report zero and
-- fail loudly instead of passing green.
-- ---------------------------------------------------------------------------
do $$
declare
  r        record;
  scanned  int := 0;
  stripped text;
begin
  for r in
    select n.nspname, c.relname, p.polname,
           coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as expr
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
  loop
    scanned := scanned + 1;
    stripped := regexp_replace(r.expr, '(public\.)?is_admin\s*\(\s*\)', '', 'g');
    if stripped ~ 'is_admin' then
      raise exception 'FAIL: policy %.%.% still reads the frozen owners.is_admin column inline: %. 0014 freezes that column against every authenticated session and 0026 made public.is_admin() resolve through user_roles, so a policy that inlines the column denies every console-granted admin.',
        r.nspname, r.relname, r.polname, r.expr;
    end if;
  end loop;

  if scanned < 40 then
    raise exception 'FAIL: the catalog-wide sweep saw only % policies; it is not reaching pg_policy and proves nothing', scanned;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE STORAGE POLICY STILL EXISTS, AND HAS THE SHAPE THE FIX INTENDED
--
-- Section 1 alone is satisfiable by DELETING health_docs_storage_owner_access
-- outright, which would deny the admin just as thoroughly. This is the positive
-- half.
--
-- What must be true for this to pass: the policy exists on storage.objects; its
-- USING calls is_admin(); it is still scoped to the health-docs bucket; the
-- owner branch is still present (it references storage.foldername and
-- owner_id); it is still a SELECT policy; and its roles are still {public}.
--
-- The {public} assertion is deliberate and is not a rubber stamp of the status
-- quo. 0031 reasons the decision out in full: {public} here is an artifact of
-- 0005/0006 omitting the `to` clause, anon reaches both branches and matches
-- nothing because both are anchored on a null auth.uid(), and narrowing one of
-- three identically-shaped sibling policies would imply a distinction that does
-- not exist. If someone later narrows it, this fails and sends them to that
-- argument rather than letting the change pass unexamined.
-- ---------------------------------------------------------------------------
do $$
declare
  q      text;
  cmd    "char";
  proles oid[];
begin
  select pg_get_expr(p.polqual, p.polrelid), p.polcmd, p.polroles
    into q, cmd, proles
  from pg_policy p
  join pg_class c     on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage'
    and c.relname = 'objects'
    and p.polname = 'health_docs_storage_owner_access';

  if q is null then
    raise exception 'FAIL: storage.objects/health_docs_storage_owner_access is missing; no owner and no admin can read any health document';
  end if;
  if q !~ 'is_admin\s*\(\s*\)' then
    raise exception 'FAIL: health_docs_storage_owner_access does not call is_admin(); a console-granted admin can approve vet records they cannot open. Qual: %', q;
  end if;
  if q !~ 'health-docs' then
    raise exception 'FAIL: health_docs_storage_owner_access is no longer scoped to the health-docs bucket; it now governs objects in other buckets. Qual: %', q;
  end if;
  if q !~ 'foldername' or q !~ 'owner_id' then
    raise exception 'FAIL: health_docs_storage_owner_access lost its owner branch; members can no longer read their own dogs'' documents. Qual: %', q;
  end if;
  if cmd <> 'r' then
    raise exception 'FAIL: health_docs_storage_owner_access is polcmd %, not SELECT', cmd;
  end if;
  if proles <> array[0]::oid[] then
    raise exception 'FAIL: health_docs_storage_owner_access roles changed from {public} to %. 0031 declines this narrowing on purpose and gives three reasons; revisit them before changing this assertion.', proles::text;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. dogs_select_admin AND owners_select_admin EXIST WITH THE EXPECTED SHAPE
--
-- Both are live in production but were in no migration file until 0031. On a
-- database rebuilt from the files alone they were simply absent, and the console
-- degraded silently: /admin/dogs empty, /admin/users showing one member,
-- /admin/audit-log showing every actor as unknown, restore unreachable.
--
-- What must be true for this to pass: each policy exists on its table; is a
-- PERMISSIVE SELECT policy; is granted TO authenticated and to nothing else; and
-- its USING calls is_admin() rather than inlining anything. dogs_select_admin
-- must additionally carry NO removed_at predicate -- 0028 depends on it staying
-- unfiltered so admin_restore_dog can find a removed dog at all, and 0028's own
-- script asserts the same thing.
--
-- Cannot pass vacuously: `q is null` is checked explicitly, so a missing policy
-- fails rather than skipping. The loop covers both names and would have to find
-- both.
-- ---------------------------------------------------------------------------
do $$
declare
  spec       record;
  q          text;
  cmd        "char";
  permissive boolean;
  proles     oid[];
  auth_oid   oid := (select oid from pg_roles where rolname = 'authenticated');
begin
  if auth_oid is null then
    raise exception 'FAIL: there is no `authenticated` role in this database; every role comparison below would be vacuous';
  end if;

  for spec in
    select * from (values
      ('dogs',   'dogs_select_admin',   '/admin/dogs renders empty and admin_restore_dog is unreachable'),
      ('owners', 'owners_select_admin', '/admin/users shows only the acting admin and every audit-log actor is unknown')
    ) as t(tbl, pol, consequence)
  loop
    select pg_get_expr(p.polqual, p.polrelid), p.polcmd, p.polpermissive, p.polroles
      into q, cmd, permissive, proles
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = spec.tbl and p.polname = spec.pol;

    if q is null then
      raise exception 'FAIL: public.% is missing the policy %; %', spec.tbl, spec.pol, spec.consequence;
    end if;
    if cmd <> 'r' then
      raise exception 'FAIL: % is polcmd %, not SELECT', spec.pol, cmd;
    end if;
    if not permissive then
      raise exception 'FAIL: % is RESTRICTIVE; a restrictive policy grants no access and would veto instead of admit', spec.pol;
    end if;
    if proles <> array[auth_oid]::oid[] then
      raise exception 'FAIL: % is granted to %, expected exactly {authenticated}', spec.pol, proles::text;
    end if;
    if q !~ 'is_admin\s*\(\s*\)' then
      raise exception 'FAIL: % does not call is_admin(); qual is %', spec.pol, q;
    end if;
  end loop;
end $$;

do $$
declare q text;
begin
  select pg_get_expr(p.polqual, p.polrelid) into q
  from pg_policy p
  join pg_class c     on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'dogs' and p.polname = 'dogs_select_admin';

  if q like '%removed_at%' then
    raise exception 'FAIL: dogs_select_admin filters removed_at; removed dogs become invisible to admins and unrestorable. Qual: %', q;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. anon AND authenticated HOLD NO TRUNCATE ON THE TABLES 0031 REVOKED
--
-- TRUNCATE fires no row triggers and consults no RLS, so it walks past 0028's
-- prevent_non_admin_dog_removal_change and 0030's prevent_removed_dog_deletion
-- without either ever running.
--
-- has_table_privilege is used rather than a direct read of relacl because it is
-- the question that actually matters -- "can this role truncate this table" --
-- and it accounts for privileges held through role membership. Confirmed on
-- production 2026-09-09: neither anon nor authenticated is a member of any role
-- (only authenticator and postgres are members of them), so there is no
-- inherited TRUNCATE that a direct revoke would fail to remove.
--
-- What must be true for this to pass: for every base table in `public` owned by
-- postgres, neither anon nor authenticated holds TRUNCATE.
--
-- Cannot pass vacuously, in two independent ways. The loop fails if it scanned
-- fewer than 15 tables (production has 18), so an empty or mis-filtered scan is
-- caught. And it separately asserts that anon DOES still hold SELECT on
-- public.dogs -- the paired positive that proves has_table_privilege is being
-- called correctly and returning true for something, so a run of `false`
-- TRUNCATE answers is a real result and not a broken predicate.
-- ---------------------------------------------------------------------------
do $$
declare
  r       record;
  scanned int := 0;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and pg_get_userbyid(c.relowner) = 'postgres'
    order by c.relname
  loop
    scanned := scanned + 1;

    if has_table_privilege('anon', format('public.%I', r.relname), 'TRUNCATE') then
      raise exception 'FAIL: anon holds TRUNCATE on public.%. TRUNCATE bypasses row triggers and RLS entirely, defeating 0028''s and 0030''s guards outright. If the revoke ran and this still fails, check the pg_default_acl entry for schema public (objtype r, grantor postgres): it grants arwdDxtm to anon on every new table, and the D is TRUNCATE.', r.relname;
    end if;

    if has_table_privilege('authenticated', format('public.%I', r.relname), 'TRUNCATE') then
      raise exception 'FAIL: authenticated holds TRUNCATE on public.%. TRUNCATE bypasses row triggers and RLS entirely, defeating 0028''s and 0030''s guards outright.', r.relname;
    end if;
  end loop;

  if scanned < 15 then
    raise exception 'FAIL: the TRUNCATE sweep scanned only % postgres-owned base tables in public (expected 18); it is not reaching the catalog and proves nothing', scanned;
  end if;

  if not has_table_privilege('anon', 'public.dogs', 'SELECT') then
    raise exception 'FAIL: anon holds no SELECT on public.dogs either. Every TRUNCATE answer above may be a broken predicate rather than a revoked privilege, so this section proves nothing.';
  end if;
end $$;

-- The default ACL is what re-grants TRUNCATE on the next `create table` in
-- public, so closing it is what stops the fix from decaying. Its ABSENCE is also
-- a safe state (nothing to inherit), which is why this is written as "if the
-- entry exists it must not carry TRUNCATE" rather than as a required row.
do $$
declare bad text;
begin
  select string_agg(a.grantee::regrole::text, ', ')
    into bad
  from pg_default_acl d,
       lateral aclexplode(d.defaclacl) a
  where d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'r'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and a.privilege_type = 'TRUNCATE'
    and a.grantee::regrole::text in ('anon', 'authenticated');

  if bad is not null then
    raise exception 'FAIL: the pg_default_acl entry for schema public (objtype r, grantor postgres) still grants TRUNCATE to %. Every table a future migration creates will inherit it and silently reopen what 0031 closed.', bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. THE FIX, EVALUATED RATHER THAN READ
--
-- Sections 1 and 2 assert what the policy TEXT says. This asserts what the
-- database DOES, because a text check is exactly what missed this defect for
-- five migrations.
--
-- The fixture admin is granted through public.grant_role, i.e. the console path,
-- so owners.is_admin stays false for them -- asserted explicitly below, because
-- that single fact is what makes the storage read a real test. Under the old
-- inlined policy this admin matched the `o.is_admin` branch not at all and the
-- owner branch not at all, and the signed URL was refused. Under the fix they
-- resolve through user_roles.
--
-- Ordered last so that a fixture that cannot be built cannot suppress sections
-- 1-4. The storage insert is wrapped so a failure there is reported as a loud
-- FAIL rather than a bare script error that reads like a passing run.
-- ---------------------------------------------------------------------------

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['hd_admin', 'hd_owner', 'hd_viewer', 'hd_dog']) k;

-- The trap, defused. Section 5 switches to `authenticated` and every statement
-- after that reads t_ids.
grant select on t_ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-hd@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('hd_admin', 'hd_owner', 'hd_viewer');

-- Granted the way the console grants it: a user_roles row, never the column.
select public.grant_role((select v from t_ids where k = 'hd_admin'), 'admin');

do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the health-document fixture';
  end if;
end $$;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'hd_dog'),
       (select v from t_ids where k = 'hd_owner'),
       'Assertion 0031 dog',
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '2 years')::date;

-- The storage row the review queue would need a signed URL for. The path shape
-- is <dog_id>/<file>, which is what storage.foldername(objects.name))[1] reads.
do $$
begin
  insert into storage.objects (bucket_id, name)
  select 'health-docs', (select v from t_ids where k = 'hd_dog')::text || '/assertion-0031.pdf';
exception
  when others then
    raise exception 'FAIL: could not build the storage.objects fixture (% %); section 5 proved nothing and must not be read as a pass', sqlstate, sqlerrm;
end $$;

-- The premise of the whole section. If this admin carried owners.is_admin = true
-- they would pass the OLD inlined policy too, and the storage read below would
-- prove nothing about the fix.
do $$
declare
  col_flag  boolean;
  role_flag boolean;
begin
  select o.is_admin into col_flag
  from public.owners o where o.id = (select v from t_ids where k = 'hd_admin');

  if col_flag is null then
    raise exception 'FAIL: no owners row for the fixture admin; handle_new_user did not fire and the fixture is not what this section assumes';
  end if;
  if col_flag then
    raise exception 'FAIL: the fixture admin has owners.is_admin = true, so it would satisfy the OLD inlined policy as well. The storage read below would pass with or without the fix and proves nothing.';
  end if;

  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.owner_id = (select v from t_ids where k = 'hd_admin') and r.name = 'admin'
  ) into role_flag;

  if not role_flag then
    raise exception 'FAIL: the fixture admin has no admin row in user_roles; grant_role did not take and this is not a console-granted admin';
  end if;
end $$;

set local role authenticated;

-- The owner of the dog. The positive anchor: if this fails, every "denied"
-- result below is a broken fixture rather than a policy decision.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'hd_owner'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from storage.objects
  where bucket_id = 'health-docs'
    and name = (select v from t_ids where k = 'hd_dog')::text || '/assertion-0031.pdf';
  if n <> 1 then
    raise exception 'FAIL: the dog''s own owner cannot read their own health document object (got %). The owner branch of health_docs_storage_owner_access is broken, and every other result in this section is meaningless.', n;
  end if;
end $$;

-- A signed-in member who owns nothing and holds no role. Must see nothing --
-- otherwise the policy admits everyone and the admin result below is vacuous.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'hd_viewer'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from storage.objects
  where bucket_id = 'health-docs'
    and name = (select v from t_ids where k = 'hd_dog')::text || '/assertion-0031.pdf';
  if n <> 0 then
    raise exception 'FAIL: a member who owns nothing and holds no role read another member''s health document (got %). health_docs_storage_owner_access is admitting everyone, which would make the admin assertion below vacuous.', n;
  end if;
end $$;

-- THE FIX. A console-granted admin, owners.is_admin = false, reading another
-- member's vet document. Before 0031 this returned 0 while
-- health_documents_admin_select_all and health_documents_admin_update both
-- returned the row -- the admin could approve a record they could not open.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'hd_admin'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from storage.objects
  where bucket_id = 'health-docs'
    and name = (select v from t_ids where k = 'hd_dog')::text || '/assertion-0031.pdf';
  if n <> 1 then
    raise exception 'FAIL: a console-granted admin (user_roles row, owners.is_admin = false) cannot read another member''s health document (got %). health_docs_storage_owner_access is still resolving admin status through the frozen owners.is_admin column, so /admin/review-queue renders vet documents that cannot be opened and can only be approved or rejected blind.', n;
  end if;
end $$;

reset role;
rollback;
