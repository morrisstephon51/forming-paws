-- supabase/tests/0026_role_system_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Kept as a file so it is
-- reviewable in git and re-runnable, matching 0022_deactivation_assertions.sql.
-- Everything happens inside a transaction ending in `rollback`, so it asserts
-- against real policies and real data without leaving anything behind.

begin;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values ('admin_a', gen_random_uuid()), ('plain_b', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-roles@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids;

-- admin_a becomes an admin through the SQL path (auth.uid() is null here).
select public.grant_role((select v from t_ids where k = 'admin_a'), 'admin');

do $$
begin
  if not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.owner_id = (select v from t_ids where k = 'admin_a') and r.name = 'admin'
  ) then
    raise exception 'FAIL: SQL-path grant_role did not create the admin grant';
  end if;
end $$;

-- The backfill must not have been bypassed: every is_admin owner is an admin.
do $$
declare missing int;
begin
  select count(*) into missing
  from public.owners o
  where o.is_admin
    and not exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.owner_id = o.id and r.name = 'admin'
    );
  if missing > 0 then
    raise exception 'FAIL: % is_admin owner(s) have no admin role after backfill', missing;
  end if;
end $$;

-- The RLS bridge: is_admin() must resolve through the role system, so an owner
-- granted 'admin' via grant_role satisfies all 9 policies that call it.
do $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_admin';
  if src not like '%has_role%' then
    raise exception 'FAIL: is_admin() still reads owners.is_admin; console-granted admins will see an empty console';
  end if;
end $$;

-- No policy may still inline the owners.is_admin column lookup.
do $$
declare leftover int;
begin
  select count(*) into leftover
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual,'') || coalesce(with_check,'')) like '%o.is_admin%';
  if leftover > 0 then
    raise exception 'FAIL: % policy/policies still read owners.is_admin directly', leftover;
  end if;
end $$;

-- revoke_role refuses to remove the last admin.
do $$
declare admin_count int;
begin
  select count(*) into admin_count
  from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name = 'admin';
  if admin_count = 1 then
    begin
      perform public.revoke_role((select v from t_ids where k = 'admin_a'), 'admin');
      raise exception 'FAIL: revoke_role removed the last admin';
    exception when others then
      if sqlerrm not like '%last admin%' then raise; end if;
    end;
  end if;
end $$;

-- Unknown role names are rejected, not silently ignored.
do $$
begin
  begin
    perform public.grant_role((select v from t_ids where k = 'plain_b'), 'sorcerer');
    raise exception 'FAIL: grant_role accepted an unknown role';
  exception when others then
    if sqlerrm not like '%unknown role%' then raise; end if;
  end;
end $$;

-- An admin must be able to read every grant, not just their own, or the member
-- list shows everyone as roleless.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_roles'
      and policyname='user_roles_select_admin' and cmd='SELECT'
  ) then
    raise exception 'FAIL: no admin read policy on user_roles; /admin/users will show every member as having no roles';
  end if;
end $$;

-- user_roles has no write policies: role writes must go through grant_role.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_roles' and cmd <> 'SELECT'
  ) then
    raise exception 'FAIL: user_roles has a non-SELECT policy; role writes must go through grant_role';
  end if;
end $$;

rollback;
