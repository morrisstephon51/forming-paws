-- supabase/migrations/0026_role_system.sql
--
-- Replaces the single owners.is_admin boolean with a roles/user_roles model.
-- is_admin is backfilled FROM here once and then left alone: migration 0014
-- installs a trigger that raises if is_admin changes while auth.uid() is
-- non-null, so no authenticated session can keep it in sync. Roles are the
-- source of truth from this migration forward. Dropping the column is a later
-- cleanup, once every call site is confirmed migrated.

create table public.roles (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text not null default ''
);

insert into public.roles (name, description) values
  ('admin',     'Full administrative access'),
  ('moderator', 'Content moderation without user administration'),
  ('breeder',   'May post puppy listings');

create table public.user_roles (
  owner_id   uuid   not null references public.owners(id) on delete cascade,
  role_id    bigint not null references public.roles(id)  on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.owners(id) on delete set null,
  primary key (owner_id, role_id)
);

create index user_roles_owner_idx on public.user_roles (owner_id);

alter table public.roles      enable row level security;
alter table public.user_roles enable row level security;

create policy "roles_select_all" on public.roles
  for select to authenticated using (true);

-- An owner reads only their own grants. Admin-wide reads go through the
-- security-definer helpers below, never through a policy that would have to
-- call has_role() against the very table the policy guards.
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (owner_id = auth.uid());

-- DELIBERATELY no insert/update/delete policies on user_roles. Every write goes
-- through grant_role/revoke_role. Same posture as 0014's is_admin guard: a
-- privilege change is never a direct authenticated-API write.

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.owner_id = auth.uid() and r.name = role_name
  );
$$;

create or replace function public.has_any_role(role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.owner_id = auth.uid() and r.name = any(role_names)
  );
$$;

-- Backfill BEFORE the is_admin() redefinition below, or every existing admin
-- loses access the moment the function is replaced.
insert into public.user_roles (owner_id, role_id)
select o.id, (select id from public.roles where name = 'admin')
from public.owners o
where o.is_admin
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS BRIDGE -- the reason this migration is safe to apply.
--
-- 11 policies across 8 tables gate on admin status. 9 call public.is_admin(),
-- which reads owners.is_admin -- the column this migration freezes. Without the
-- redefinition below, an owner granted 'admin' through the console would pass
-- the app-layer requireRole() gate and then match ZERO rows in every admin
-- policy: an empty console that reads as "no data" rather than "denied".
-- Redefining the function fixes all 9 call sites at once, with no policy edits.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin');
$$;

-- The remaining 2 policies inline the owners.is_admin lookup instead of calling
-- is_admin(), so the redefinition above does not reach them. Point them at the
-- function so there is exactly one definition of "is an admin" in the database.
drop policy if exists "health_documents_admin_select_all" on public.health_documents;
create policy "health_documents_admin_select_all" on public.health_documents
  for select to authenticated using (public.is_admin());

drop policy if exists "health_documents_admin_update" on public.health_documents;
create policy "health_documents_admin_update" on public.health_documents
  for update to authenticated using (public.is_admin());

create or replace function public.grant_role(target_owner uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role_id bigint;
begin
  if auth.uid() is not null and not public.has_role('admin') then
    raise exception 'only an admin may grant roles';
  end if;

  -- Mirrors 0014: a caller may never escalate THEMSELVES to admin. auth.uid()
  -- is null for service-role/SQL access, which keeps the operational
  -- "grant the first admin via SQL" path working.
  if auth.uid() is not null and target_owner = auth.uid() and role_name = 'admin' then
    raise exception 'an admin cannot grant the admin role to themselves';
  end if;

  select id into target_role_id from public.roles where name = role_name;
  if target_role_id is null then
    raise exception 'unknown role %', role_name;
  end if;

  insert into public.user_roles (owner_id, role_id, granted_by)
  values (target_owner, target_role_id, auth.uid())
  on conflict (owner_id, role_id) do nothing;
end;
$$;

create or replace function public.revoke_role(target_owner uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role_id bigint;
  admin_count int;
begin
  if auth.uid() is not null and not public.has_role('admin') then
    raise exception 'only an admin may revoke roles';
  end if;

  select id into target_role_id from public.roles where name = role_name;
  if target_role_id is null then
    raise exception 'unknown role %', role_name;
  end if;

  if role_name = 'admin' then
    select count(*) into admin_count
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where r.name = 'admin';
    if admin_count <= 1 then
      raise exception 'cannot revoke the last admin';
    end if;
  end if;

  delete from public.user_roles
  where owner_id = target_owner and role_id = target_role_id;
end;
$$;

revoke all on function public.grant_role(uuid, text)  from public;
revoke all on function public.revoke_role(uuid, text) from public;
grant execute on function public.grant_role(uuid, text)  to authenticated;
grant execute on function public.revoke_role(uuid, text) to authenticated;
grant execute on function public.has_role(text)          to authenticated;
grant execute on function public.has_any_role(text[])    to authenticated;
