-- supabase/tests/0027_audit_log_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Kept as a file so it is
-- reviewable in git and re-runnable, matching 0022_deactivation_assertions.sql
-- and 0026_role_system_assertions.sql. Everything happens inside a transaction
-- ending in `rollback`, so it asserts against real policies and real data
-- without leaving anything behind.

begin;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values ('audit_admin', gen_random_uuid()), ('audit_plain', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-audit@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids;

select public.grant_role((select v from t_ids where k = 'audit_admin'), 'admin');

-- The table must exist with the exact column set lib/auth/audit.ts writes.
do $$
declare missing text;
begin
  select string_agg(c, ', ') into missing
  from unnest(array['id','actor_id','action','target_type','target_id','detail','created_at']) c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = c
  );
  if missing is not null then
    raise exception 'FAIL: audit_log is missing column(s): %', missing;
  end if;
end $$;

-- Append-only posture: there must be NO update or delete policy. Without this,
-- a later migration could quietly make the log editable and nothing would notice.
do $$
declare bad int;
begin
  select count(*) into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'audit_log' and cmd in ('UPDATE','DELETE');
  if bad > 0 then
    raise exception 'FAIL: audit_log has % update/delete policy(ies); the log is not append-only', bad;
  end if;
end $$;

-- RLS must actually be on, or the policies above are decoration.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'audit_log' and c.relrowsecurity
  ) then
    raise exception 'FAIL: RLS is not enabled on audit_log';
  end if;
end $$;

-- A non-admin must not be able to insert, even claiming their own actor_id.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'audit_plain'), 'role', 'authenticated')::text,
  true);

do $$
begin
  begin
    insert into public.audit_log (actor_id, action, target_type, target_id)
    values ((select v from t_ids where k = 'audit_plain'), 'role.grant', 'owner', 'x');
    raise exception 'FAIL: a non-admin inserted an audit row';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- A non-admin must not be able to READ the log either.
do $$
declare visible int;
begin
  select count(*) into visible from public.audit_log;
  if visible > 0 then
    raise exception 'FAIL: a non-admin can read % audit row(s)', visible;
  end if;
end $$;

-- An admin may insert a row for themselves.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'audit_admin'), 'role', 'authenticated')::text,
  true);

insert into public.audit_log (actor_id, action, target_type, target_id, detail)
values ((select v from t_ids where k = 'audit_admin'), 'role.grant', 'owner', 'target-1',
        jsonb_build_object('role', 'breeder'));

do $$
declare n int;
begin
  select count(*) into n from public.audit_log
  where actor_id = (select v from t_ids where k = 'audit_admin') and action = 'role.grant';
  if n <> 1 then
    raise exception 'FAIL: admin insert produced % rows, expected 1', n;
  end if;
end $$;

-- An admin must NOT be able to forge another actor's row.
do $$
begin
  begin
    insert into public.audit_log (actor_id, action, target_type)
    values ((select v from t_ids where k = 'audit_plain'), 'role.revoke', 'owner');
    raise exception 'FAIL: an admin inserted an audit row attributed to someone else';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

reset role;
rollback;
