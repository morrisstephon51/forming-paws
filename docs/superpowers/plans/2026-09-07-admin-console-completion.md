# Admin Console Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the two written-but-unapplied migrations so the existing admin console runs, then add admin management of any member's dogs behind a soft-delete model.

**Architecture:** Migrations 0026 (roles) and 0027 (audit log) land first via a Supabase branch rehearsal, making ~2,100 lines of already-tested console code runnable. Migration 0028 then adds `dogs.removed_at`, one admin UPDATE policy, two removal RPCs, and restates three security-definer functions plus two photo policies. A new `/admin/dogs` section mirrors `/admin/users` exactly.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (`@supabase/ssr`), PostgreSQL RLS, vitest 2.1.9 (jsdom), Supabase MCP for all database operations.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-console-completion-design.md`

## Global Constraints

- **There is no local database and no `DATABASE_URL`.** No `supabase/config.toml`, no local stack. The only Forming Paws project is `wyzcnkdonbdykidmcxvx` — **it is production**, holding 46 owners, 20 dogs, 8 health documents, 1 match, 7 messages, 0 litters. Migrations are applied with the Supabase MCP `apply_migration`; assertions run via `execute_sql`.
- **The migration ledger is NOT a source of truth.** Verify applied state by querying the schema, never by `list_migrations`.
- **Next migration number is 0028.** `0022` is already used twice — do not add a third collision.
- **`owners.id` IS `auth.users.id`.** `auth.uid() = owners.id` everywhere.
- **`owners.is_admin` is write-frozen legacy.** Migration 0014 installs a trigger that raises whenever `is_admin` changes while `auth.uid()` is non-null. Never write it.
- **`as any` is a hard lint failure.** `eslint.config.mjs` extends `next/typescript`, which errors on `@typescript-eslint/no-explicit-any`. There are zero occurrences in `tests/`, `app/`, or `lib/`. Double-cast through `unknown` (`as unknown as SupabaseClient`) or `npm run lint` fails CI.
- **Vitest globals are NOT typed.** `tsconfig.json` sets no `"types": ["vitest/globals"]`, so an un-imported `describe`/`it`/`expect` fails `npx tsc --noEmit` with TS2582. Import every test helper explicitly.
- **Single-file test command is `npm test -- tests/unit/<file>.test.ts`.** Not `npx vitest run`.
- **Verification triad is `npm test`, `npx tsc --noEmit`, `npm run lint`.** Playwright e2e is deliberately excluded from CI (it needs gitignored `.env.local` credentials) and stays a local pre-merge check.
- **Admin pages use `pageMetadata({ …, index: false })`** from `@/lib/seo`.
- **Every SQL function that reads `dogs` and is `security definer` must be restated IN FULL, preserving every existing filter.** `browse_dogs` carries a comment in its own body warning that a restatement omitting `o.deactivated_at is null` silently un-hides deactivated members. Start from the live production definition, not the migration file.
- **`public.dogs_browsable` is deliberately NOT filtered.** It bypasses RLS (owned by `postgres`, no `security_invoker`). Migration 0022 records that filtering it blanks dog names in every existing conversation and in the review queue.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/tests/0027_audit_log_assertions.sql` | Assert the audit log's append-only posture (currently asserted nowhere) |
| `supabase/migrations/0028_admin_dog_management.sql` | `removed_at`, admin UPDATE policy, remove/restore/is-removed RPCs, three restated functions, two narrowed photo policies |
| `supabase/tests/0028_admin_dog_management_assertions.sql` | RLS + visibility + photo assertions for soft delete |
| `app/dogs/[id]/page.tsx` | Explicit removed-dog check, mirroring the deactivation check already there |
| `app/admin/dogs/actions.ts` | `updateDogAction`, `removeDogAction`, `restoreDogAction`, `reassignDogAction` |
| `app/admin/dogs/page.tsx` | Console section: list, edit form, remove/restore |
| `app/admin/layout.tsx` | Add `/admin/dogs` to `NAV` |
| `tests/unit/admin-dogs-actions.test.ts` | Unit coverage for the four server actions |

---

### Task 1: Land migrations 0026 and 0027

**Files:**
- Create: `supabase/tests/0027_audit_log_assertions.sql`
- Database: apply `supabase/migrations/0026_role_system.sql` and `0027_audit_log.sql`

**Interfaces:**
- Produces: `public.roles`, `public.user_roles`, `public.audit_log` tables; `has_role(text)`, `has_any_role(text[])`, `grant_role(uuid,text)`, `revoke_role(uuid,text)` functions; `is_admin()` redefined to `select public.has_role('admin')`. Every later task depends on these existing.

- [ ] **Step 1: Write the missing 0027 assertion script**

`0027_audit_log.sql` creates `audit_log` with policies `audit_log_select_admin` (SELECT, `public.has_role('admin')`) and `audit_log_insert_admin` (INSERT, `actor_id = auth.uid() and public.has_role('admin')`), and deliberately no UPDATE or DELETE policies. Nothing currently asserts that. Create `supabase/tests/0027_audit_log_assertions.sql`:

```sql
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

-- The table must have at least the columns lib/auth/audit.ts writes. This
-- only detects a missing column, not an extra one the app doesn't use.
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

-- Switch to the admin actor first, so the non-admin read check below has a
-- real row to fail to see.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'audit_admin'), 'role', 'authenticated')::text,
  true);

-- An admin may insert a row for themselves. Wrapped so an unexpected failure
-- here (e.g. audit_log_insert_admin missing or misconfigured) surfaces as
-- FAIL: instead of aborting the script with a raw Postgres error.
do $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, detail)
  values ((select v from t_ids where k = 'audit_admin'), 'role.grant', 'owner', 'target-1',
          jsonb_build_object('role', 'breeder'));
exception
  when others then
    raise exception 'FAIL: admin insert failed unexpectedly: %', sqlerrm;
end $$;

-- The insert must have actually landed: the non-admin read check right after
-- this depends on a real row existing.
do $$
declare n int;
begin
  select count(*) into n from public.audit_log
  where actor_id = (select v from t_ids where k = 'audit_admin') and action = 'role.grant';
  if n <> 1 then
    raise exception 'FAIL: admin insert produced % rows, expected 1', n;
  end if;
end $$;

-- Switch to the non-admin actor while the admin's row still exists.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'audit_plain'), 'role', 'authenticated')::text,
  true);

-- A non-admin must not be able to READ the log either. This only proves
-- anything because a row already exists (inserted above, as the admin): if
-- the table were still empty, `visible = 0` would pass identically whether
-- audit_log_select_admin is correct, absent, or replaced with `using (true)`.
-- Do not simplify this back to running before any row exists.
do $$
declare visible int;
begin
  select count(*) into visible from public.audit_log;
  if visible > 0 then
    raise exception 'FAIL: a non-admin can read % audit row(s)', visible;
  end if;
end $$;

-- A non-admin must not be able to insert, even claiming their own actor_id.
do $$
begin
  begin
    insert into public.audit_log (actor_id, action, target_type, target_id)
    values ((select v from t_ids where k = 'audit_plain'), 'role.grant', 'owner', 'x');
    raise exception 'FAIL: a non-admin inserted an audit row';
  exception
    when insufficient_privilege then null;
    when others then raise;
  end;
end $$;

-- Switch back to the admin actor for the forge check.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'audit_admin'), 'role', 'authenticated')::text,
  true);

-- An admin must NOT be able to forge another actor's row.
do $$
begin
  begin
    insert into public.audit_log (actor_id, action, target_type)
    values ((select v from t_ids where k = 'audit_plain'), 'role.revoke', 'owner');
    raise exception 'FAIL: an admin inserted an audit row attributed to someone else';
  exception
    when insufficient_privilege then null;
    when others then raise;
  end;
end $$;

reset role;
rollback;
```

- [ ] **Step 2: Confirm nothing has landed yet**

Run via Supabase MCP `execute_sql` on project `wyzcnkdonbdykidmcxvx`:

```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='roles') as t_roles,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='user_roles') as t_user_roles,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='audit_log') as t_audit_log,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='has_role') as f_has_role,
  (select count(*) from public.owners where is_admin) as admins;
```

Expected: `t_roles=0, t_user_roles=0, t_audit_log=0, f_has_role=0, admins=1`.

**If any count is non-zero, STOP.** Something landed out of band; re-read the schema before proceeding.

- [ ] **Step 3: Create the rehearsal branch**

Use Supabase MCP `create_branch` on project `wyzcnkdonbdykidmcxvx` with name `admin-console-rehearsal`. Record the returned branch project ref — every command in Steps 4–6 targets **that ref**, not production.

Confirm cost first with `get_cost` / `confirm_cost` if the MCP requires it.

- [ ] **Step 4: Apply both migrations to the branch**

`apply_migration` against the branch ref, name `role_system`, with the full verbatim contents of `supabase/migrations/0026_role_system.sql`.

Then `apply_migration`, name `audit_log`, with the full verbatim contents of `supabase/migrations/0027_audit_log.sql`.

Expected: both succeed. If 0026 fails, do not attempt 0027 — it declares `audit_log_select_admin` using `public.has_role('admin')`, which 0026 creates.

- [ ] **Step 5: Run both assertion scripts against the branch**

`execute_sql` with the full contents of `supabase/tests/0026_role_system_assertions.sql`, then the same for `supabase/tests/0027_audit_log_assertions.sql`.

Expected: both complete with no exception. Any `FAIL:` message is a stop.

- [ ] **Step 6: Prove the backfill saved the existing admin**

The single live admin must still be an admin after `is_admin()` is redefined. Run against the branch:

```sql
select
  (select count(*) from public.owners where is_admin) as legacy_admins,
  (select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id
     where r.name = 'admin') as role_admins,
  (select pg_get_functiondef(p.oid) like '%has_role%' from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='is_admin') as bridge_installed;
```

Expected: `legacy_admins = 1`, `role_admins = 1`, `bridge_installed = true`.

**If `role_admins` is 0 while `legacy_admins` is 1, STOP** — the backfill did not run before the redefinition and applying this to production would lock the only admin out of the console.

- [ ] **Step 7: Apply to production**

Only after Steps 5 and 6 are clean. `apply_migration` against `wyzcnkdonbdykidmcxvx`, name `role_system`, full contents of `0026_role_system.sql`. Then name `audit_log`, full contents of `0027_audit_log.sql`.

- [ ] **Step 8: Re-run Step 6's query against production**

Expected identically: `legacy_admins = 1`, `role_admins = 1`, `bridge_installed = true`.

Also run both assertion scripts against production — they are transactional and roll back, leaving nothing behind.

- [ ] **Step 9: Delete the rehearsal branch**

Supabase MCP `delete_branch` on the branch ref. Confirm with `list_branches` that it is gone, so it stops accruing compute.

- [ ] **Step 10: Commit**

```bash
git add supabase/tests/0027_audit_log_assertions.sql
git commit -m "test(db): assert the audit log's append-only posture

0027 shipped with no assertion script. This proves RLS is on, that there
are no UPDATE or DELETE policies, that a non-admin can neither read nor
insert, and that an admin cannot forge a row attributed to another actor."
```

---

### Task 2: Migration 0028 — soft delete, admin writes, restated functions

**Files:**
- Create: `supabase/migrations/0028_admin_dog_management.sql`
- Create: `supabase/tests/0028_admin_dog_management_assertions.sql`

**Interfaces:**
- Consumes: `public.is_admin()` from 0026.
- Produces:
  - `dogs.removed_at timestamptz`, `dogs.removed_by uuid`
  - policy `dogs_update_admin`
  - `public.admin_remove_dog(p_dog_id uuid, p_reason text)` → `void`, execute granted to `authenticated`
  - `public.admin_restore_dog(p_dog_id uuid)` → `void`, execute granted to `authenticated`
  - `public.dog_is_removed(p_dog_id uuid)` → `boolean`, execute granted to `authenticated`
  - restated `browse_dogs`, `browse_puppies`, `community_stats`
  - narrowed `dog_photos_select_browsable`, `dog_photos_storage_browsable_select`

  Task 4 calls `dog_is_removed`. Task 5's server actions call `admin_remove_dog`
  and `admin_restore_dog` by exactly these names and argument names.

- [ ] **Step 1: Capture the live function definitions**

Before writing anything, run against production and keep the output — this is the text Step 2 edits:

```sql
select p.proname, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('browse_dogs','browse_puppies','community_stats')
order by p.proname;
```

The bodies in Step 2 were captured on 2026-09-07. **Diff them against this output.** If they differ, the live version wins — restate from it, and add only the two filters this task introduces.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0028_admin_dog_management.sql`:

```sql
-- supabase/migrations/0028_admin_dog_management.sql
--
-- Admin management of any member's dogs, on a soft-delete model.
--
-- Removal is `removed_at`, never DELETE. Foreign keys cascade from dogs into
-- dog_photos, health_documents, dog_interests, matches and puppy_inquiries, so
-- a hard admin delete would destroy the verified vet records this platform's
-- health-gating claim rests on, plus every message thread the dog appeared in.
-- No dogs_delete_admin policy is added for the same reason.
--
-- Three of the surfaces below are security definer and bypass RLS entirely, so
-- each is restated IN FULL. browse_dogs carries its own warning about exactly
-- this: a restatement that drops `o.deactivated_at is null` silently un-hides
-- every deactivated owner. Both filters are preserved here and one is added.

alter table public.dogs
  add column removed_at timestamptz,
  add column removed_by uuid references public.owners(id) on delete set null;

comment on column public.dogs.removed_at is
  'Set by admin_remove_dog. A removed dog leaves discovery and its owner''s own '
  'list, but its health documents, photos rows and match threads are preserved. '
  'Admins still see it so it can be restored.';

-- Partial index on the column dogs_select_own actually filters by. An index on
-- (id) would just duplicate the primary key.
create index dogs_owner_not_removed_idx on public.dogs (owner_id) where removed_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- An owner stops seeing their own removed dog. dogs_select_admin already exists
-- and is deliberately left UNFILTERED so an admin can see and restore.
drop policy if exists "dogs_select_own" on public.dogs;
create policy "dogs_select_own" on public.dogs
  for select to authenticated
  using (owner_id = auth.uid() and removed_at is null);

-- The actually-missing capability. USING is row-independent, so it also governs
-- the post-update row and an owner_id reassignment passes.
create policy "dogs_update_admin" on public.dogs
  for update to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Removal and restore
--
-- These mirror grant_role/revoke_role: the database is the real gate, and the
-- audit row is written by the caller (lib/auth/audit.ts) through the
-- authenticated client, so audit_log_insert_admin's actor_id = auth.uid()
-- check is satisfied by a real session rather than by a definer's identity.
-- ---------------------------------------------------------------------------

create or replace function public.admin_remove_dog(p_dog_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may remove a dog' using errcode = '42501';
  end if;

  update public.dogs
     set removed_at = now(),
         removed_by = auth.uid()
   where id = p_dog_id
     and removed_at is null;

  if not found then
    raise exception 'Dog % does not exist or is already removed', p_dog_id;
  end if;
end;
$$;

create or replace function public.admin_restore_dog(p_dog_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may restore a dog' using errcode = '42501';
  end if;

  update public.dogs
     set removed_at = null,
         removed_by = null
   where id = p_dog_id
     and removed_at is not null;

  if not found then
    raise exception 'Dog % does not exist or is not removed', p_dog_id;
  end if;
end;
$$;

-- /dogs/[id] needs to know whether a dog is removed, but a non-owner cannot read
-- dogs.removed_at at all — dogs_select_own filters the row away entirely, so a
-- direct select would return nothing and the check would quietly pass for every
-- dog on the site. This mirrors owner_is_active, which that page already calls
-- for exactly the same reason.
create or replace function public.dog_is_removed(p_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select removed_at is not null from public.dogs where id = p_dog_id), false);
$$;

revoke all on function public.dog_is_removed(uuid) from public;
grant execute on function public.dog_is_removed(uuid) to authenticated;

revoke all on function public.admin_remove_dog(uuid, text) from public;
revoke all on function public.admin_restore_dog(uuid) from public;
grant execute on function public.admin_remove_dog(uuid, text) to authenticated;
grant execute on function public.admin_restore_dog(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Discovery surfaces. All three are security definer; RLS never reaches them.
-- Restated in full from the live definitions captured 2026-09-07.
-- ---------------------------------------------------------------------------

create or replace function public.browse_dogs(
  p_breed_id bigint default null,
  p_sex public.dog_sex default null,
  p_verified_only boolean default false,
  p_min_age_years int default null,
  p_max_age_years int default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid, name text, breed_name text, sex public.dog_sex, birth_date date,
  owner_id uuid, location_label text, distance_miles numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.name,
    b.name as breed_name,
    d.sex,
    d.birth_date,
    d.owner_id,
    o.location_label,
    case
      when me.location_point is not null and o.location_point is not null
        then st_distance(me.location_point, o.location_point) / 1609.34
      else null
    end as distance_miles
  from public.dogs d
  join public.breeds b on b.id = d.breed_id
  join public.owners o on o.id = d.owner_id
  left join public.owners me on me.id = auth.uid()
  where d.owner_id <> auth.uid()
    -- Carried forward from 0022. This function is defined by CREATE OR REPLACE,
    -- so any migration that restates it and omits this line silently un-hides
    -- every deactivated owner's dogs from browse — a member who asked us to
    -- delete their account would reappear in the feed.
    and o.deactivated_at is null
    -- Added by 0028. Same hazard, same rule: keep this line on every restatement.
    and d.removed_at is null
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (p_sex is null or d.sex = p_sex)
    and (p_verified_only is false or public.dog_is_baseline_verified(d.id))
    and (p_min_age_years is null or d.birth_date <= current_date - (p_min_age_years || ' years')::interval)
    -- "at most N years old" = has not yet reached its (N+1)th birthday, matched
    -- to the completed-calendar-year age shown on the card (see #34).
    and (p_max_age_years is null or d.birth_date > current_date - ((p_max_age_years + 1) || ' years')::interval)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, d.created_at desc;
$$;

-- browse_puppies never had the deactivation filter browse_dogs has. Its whole
-- owner-side predicate was `d.owner_id <> auth.uid()`, and
-- deactivate_own_account touches neither dogs nor litters — so a member who
-- deactivated kept their puppies listed on /marketplace. Verified latent, not
-- active (0 deactivated owners, 0 dogs with a litter_id on 2026-09-07), but it
-- goes live the moment puppy listings ship. Fixed here because this function is
-- already being restated.
create or replace function public.browse_puppies(
  p_breed_id bigint default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid, name text, breed_name text, sex public.dog_sex, birth_date date,
  listed_price_cents integer, litter_id uuid, ready_on date, owner_id uuid,
  location_label text, distance_miles numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.name,
    b.name as breed_name,
    d.sex,
    d.birth_date,
    d.listed_price_cents,
    d.litter_id,
    l.ready_on,
    d.owner_id,
    o.location_label,
    case
      when me.location_point is not null and o.location_point is not null
        then st_distance(me.location_point, o.location_point) / 1609.34
      else null
    end as distance_miles
  from public.dogs d
  join public.breeds b on b.id = d.breed_id
  join public.litters l on l.id = d.litter_id
  join public.owners o on o.id = d.owner_id
  left join public.owners me on me.id = auth.uid()
  where d.litter_id is not null
    and d.owner_id <> auth.uid()
    and o.deactivated_at is null
    and d.removed_at is null
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, l.ready_on nulls last, d.created_at desc;
$$;

-- Both dog counts exclude removed dogs. dog_is_baseline_verified is
-- deliberately NOT filtered — it answers "does this dog hold current verified
-- documents" for a dog_id the caller already has, so filtering it would report
-- a removed dog as unverified to the admin deciding whether to restore it.
create or replace function public.community_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'members', (select count(*) from public.owners where coalesce(email,'') not like 'e2e-%' and coalesce(email,'') not like 'formingpaws.qa%'),
    'dogs', (select count(*) from public.dogs d join public.owners o on o.id = d.owner_id
              where coalesce(o.email,'') not like 'e2e-%' and coalesce(o.email,'') not like 'formingpaws.qa%'
                and d.removed_at is null),
    'verified_dogs', (select count(*) from public.dogs d
                       where d.removed_at is null and public.dog_is_baseline_verified(d.id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Photos
--
-- 0019 coupled photo visibility to dogs_browsable so that a filter added to the
-- view would propagate automatically. That view is deliberately NOT filtered
-- here (0022: filtering it blanks dog names in every existing conversation and
-- in the review queue), so the propagation does not happen and the check has to
-- be stated directly. Without this a dog removed for abusive imagery keeps
-- serving that imagery to every signed-in member.
--
-- The owner-scoped policies dog_photos_select_own and
-- dog_photos_storage_owner_access are deliberately untouched, per 0019's note
-- that they must keep working independently of browsability. Policies are OR'd,
-- so narrowing only the browsable pair is sufficient and safe.
-- ---------------------------------------------------------------------------

drop policy if exists "dog_photos_select_browsable" on public.dog_photos;
create policy "dog_photos_select_browsable" on public.dog_photos
  for select to authenticated
  using (
    exists (
      select 1
      from public.dogs_browsable b
      join public.dogs d on d.id = b.id
      where b.id = dog_photos.dog_id
        and d.removed_at is null
    )
  );

drop policy if exists "dog_photos_storage_browsable_select" on storage.objects;
create policy "dog_photos_storage_browsable_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dog-photos'
    and exists (
      select 1
      from public.dogs_browsable b
      join public.dogs d on d.id = b.id
      where b.id::text = (storage.foldername(objects.name))[1]
        and d.removed_at is null
    )
  );
```

- [ ] **Step 3: Write the assertion script**

Create `supabase/tests/0028_admin_dog_management_assertions.sql`:

```sql
-- supabase/tests/0028_admin_dog_management_assertions.sql
--
-- Run via the Supabase MCP: execute_sql(<this file>). Transactional; ends in
-- rollback, so it asserts against real policies and real data without leaving
-- anything behind. Matches 0022 and 0026.

begin;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('dog_admin', gen_random_uuid()),
  ('dog_owner', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-dogs@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids;

select public.grant_role((select v from t_ids where k = 'dog_admin'), 'admin');

-- A breed must exist or the fixture insert below fails for an unrelated reason.
do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

create temporary table t_dog (id uuid);
with ins as (
  insert into public.dogs (owner_id, name, breed_id, sex, birth_date)
  select (select v from t_ids where k = 'dog_owner'),
         'Assertion Dog',
         (select id from public.breeds order by id limit 1),
         'female',
         current_date - interval '2 years'
  returning id
)
insert into t_dog (id) select id from ins;

-- The columns must exist before anything else is meaningful.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='dogs' and column_name='removed_at'
  ) then
    raise exception 'FAIL: dogs.removed_at does not exist';
  end if;
end $$;

-- No DELETE policy may grant admins hard deletion — that is the whole point.
do $$
declare bad int;
begin
  select count(*) into bad from pg_policies
  where schemaname='public' and tablename='dogs' and cmd='DELETE'
    and coalesce(qual,'') like '%is_admin%';
  if bad > 0 then
    raise exception 'FAIL: an admin DELETE policy exists on dogs; removal must be soft';
  end if;
end $$;

-- A non-admin must not be able to remove a dog.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);

do $$
begin
  begin
    perform public.admin_remove_dog((select id from t_dog), 'test');
    raise exception 'FAIL: a non-admin removed a dog';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- The owner sees their own dog while it is present.
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select id from t_dog);
  if n <> 1 then raise exception 'FAIL: owner cannot see their own un-removed dog'; end if;
end $$;

-- An admin removes it.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);
select public.admin_remove_dog((select id from t_dog), 'assertion');

do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select id from t_dog) and removed_at is not null;
  if n <> 1 then raise exception 'FAIL: admin_remove_dog did not set removed_at'; end if;
end $$;

-- The admin still sees it — otherwise restore is impossible.
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select id from t_dog);
  if n <> 1 then raise exception 'FAIL: admin cannot see a removed dog; it can never be restored'; end if;
end $$;

-- The owner no longer sees it.
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_owner'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select id from t_dog);
  if n <> 0 then raise exception 'FAIL: a removed dog is still visible to its owner'; end if;
end $$;

-- It is absent from the discovery feeds.
do $$
declare n int;
begin
  select count(*) into n from public.browse_dogs() where id = (select id from t_dog);
  if n <> 0 then raise exception 'FAIL: a removed dog still appears in browse_dogs'; end if;
end $$;

-- The health documents survive — this is why removal is soft.
reset role;
do $$
begin
  if not exists (select 1 from public.dogs where id = (select id from t_dog)) then
    raise exception 'FAIL: the dog row itself was destroyed';
  end if;
end $$;

-- The name still resolves for existing threads and the review queue.
do $$
declare n int;
begin
  select count(*) into n from public.dogs_browsable where id = (select id from t_dog);
  if n <> 1 then
    raise exception 'FAIL: dogs_browsable no longer resolves a removed dog; match threads will blank out';
  end if;
end $$;

-- Restore returns it.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'dog_admin'), 'role', 'authenticated')::text, true);
select public.admin_restore_dog((select id from t_dog));

do $$
declare n int;
begin
  select count(*) into n from public.dogs where id = (select id from t_dog) and removed_at is null;
  if n <> 1 then raise exception 'FAIL: admin_restore_dog did not clear removed_at'; end if;
end $$;

reset role;
rollback;
```

- [ ] **Step 4: Commit before applying**

```bash
git add supabase/migrations/0028_admin_dog_management.sql supabase/tests/0028_admin_dog_management_assertions.sql
git commit -m "feat(db): migration 0028 — admin dog management on a soft-delete model

Adds dogs.removed_at, one admin UPDATE policy, and remove/restore RPCs.
No DELETE policy: production FKs cascade from dogs into health_documents
and matches, so a hard admin delete would destroy the vet records the
health-gating claim rests on.

Restates browse_dogs, browse_puppies and community_stats in full — all
three are security definer and RLS never reaches them. browse_puppies
also gains the o.deactivated_at filter it never had.

dogs_browsable stays unfiltered so names keep resolving in existing
threads (0022), so the two browsable-coupled photo policies get the
removed_at check stated directly instead of inheriting it (0019)."
```

---

### Task 3: Rehearse and apply 0028

**Files:** none changed — this is a database operation.

- [ ] **Step 1: Create a fresh rehearsal branch**

Supabase MCP `create_branch` on `wyzcnkdonbdykidmcxvx`, name `dogs-0028-rehearsal`. Record the ref.

Because Task 1 already applied 0026 and 0027 to production, this branch inherits them.

- [ ] **Step 2: Apply 0028 to the branch**

`apply_migration` against the branch ref, name `admin_dog_management`, full contents of `supabase/migrations/0028_admin_dog_management.sql`.

- [ ] **Step 3: Run the assertions against the branch**

`execute_sql` with the full contents of `supabase/tests/0028_admin_dog_management_assertions.sql`.

Expected: completes with no exception.

- [ ] **Step 4: Prove no filter was lost in the restatements**

This is the specific failure `browse_dogs` warns about. Run against the branch:

```sql
select
  pg_get_functiondef(p.oid) like '%deactivated_at is null%' as has_deactivated_filter,
  pg_get_functiondef(p.oid) like '%removed_at is null%'     as has_removed_filter,
  p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname in ('browse_dogs','browse_puppies')
order by p.proname;
```

Expected: **both** columns `true` for **both** functions. A `false` anywhere means a filter was dropped — stop and fix the migration.

- [ ] **Step 5: Prove the photo policies actually narrowed**

```sql
select schemaname, policyname, qual::text like '%removed_at%' as has_removed_check
from pg_policies
where (schemaname='public' and policyname='dog_photos_select_browsable')
   or (schemaname='storage' and policyname='dog_photos_storage_browsable_select');
```

Expected: two rows, both `has_removed_check = true`.

- [ ] **Step 6: Apply to production and re-verify**

`apply_migration` against `wyzcnkdonbdykidmcxvx`. Then re-run Steps 3, 4 and 5 against production. All must be identically clean.

- [ ] **Step 7: Delete the branch**

`delete_branch` on the rehearsal ref; confirm with `list_branches`.

---

### Task 4: Honour `removed_at` on the dog detail page

**Files:**
- Modify: `app/dogs/[id]/page.tsx`

**Interfaces:**
- Consumes: `public.dog_is_removed(p_dog_id uuid)` from Task 2.

`/dogs/[id]` resolves a dog in two branches. It first tries `from('dogs')`, which
RLS scopes to the owner — and, since `dogs_select_admin` already exists, to any
admin. If that returns nothing it falls back to the `dogs_browsable` view, which
bypasses RLS and is deliberately unfiltered, then calls the `owner_is_active` RPC
to 404 a deactivated owner's dog.

After Task 2, `dogs_select_own` filters removed rows, so the branches sort
themselves out:

| Viewer | Branch reached | Result |
|---|---|---|
| Admin | `from('dogs')` succeeds via `dogs_select_admin` (unfiltered) | Sees the removed dog — needed to review before restoring |
| Owner of a removed dog | falls through to `dogs_browsable` | 404, via the new check |
| Any other member | falls through to `dogs_browsable` | 404, via the new check |

So the check belongs in the fallback branch only, right beside `owner_is_active`,
and needs no role lookup at all.

- [ ] **Step 1: Add the removed check**

In `app/dogs/[id]/page.tsx`, the `else` branch currently ends with:

```tsx
    if (!ownerActive) notFound()

    dog = { ...browsableDog, breedName: browsableDog.breed_name }
```

Insert the removed check between those two statements:

```tsx
    if (!ownerActive) notFound()

    // Same shape and same reason as the owner_is_active check above: a removed
    // dog stays reachable through dogs_browsable, because that view also
    // resolves names inside existing conversations and the review queue and
    // must not be filtered (0022). Via the RPC, not `select removed_at from
    // dogs`: dogs_select_own now filters removed rows away entirely, so a
    // direct select returns nothing and the check would quietly pass for every
    // dog on the site.
    //
    // Admins never reach this branch — dogs_select_admin is unfiltered, so the
    // `from('dogs')` read above already succeeded for them.
    const { data: dogRemoved } = await supabase.rpc('dog_is_removed', {
      p_dog_id: id,
    })

    if (dogRemoved) notFound()

    dog = { ...browsableDog, breedName: browsableDog.breed_name }
```

No new imports are needed — `notFound` is already imported on line 2.

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add "app/dogs/[id]/page.tsx"
git commit -m "fix(dogs): 404 a removed dog reached by direct URL

dogs_browsable stays unfiltered so names keep resolving in existing match
threads, so the removed check lives in the page — the same shape and the
same reasoning as the owner_is_active check beside it. Admins never reach
this branch; dogs_select_admin is unfiltered."
```

---

### Task 5: Admin dog server actions

**Files:**
- Create: `app/admin/dogs/actions.ts`
- Create: `tests/unit/admin-dogs-actions.test.ts`

**Interfaces:**
- Consumes: `hasRole` from `@/lib/auth/roles`, `recordAuditEvent` from `@/lib/auth/audit`, `createClient` from `@/lib/supabase/server`, and the RPCs `admin_remove_dog(p_dog_id, p_reason)` / `admin_restore_dog(p_dog_id)` from Task 2.
- Produces: `updateDogAction(formData)`, `removeDogAction(formData)`, `restoreDogAction(formData)`, `reassignDogAction(formData)` — all `(formData: FormData) => Promise<void>`. Task 6's page binds forms to exactly these names.

- [ ] **Step 1: Write the failing test**

No unit test in this repo currently imports anything under `app/admin` — this is the first. It follows `tests/unit/roles.test.ts` exactly: `vi.hoisted` handles, module-level `vi.mock`, a local fake client, `await import()` inside each `it`.

Create `tests/unit/admin-dogs-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  auditInsert: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

/**
 * Stands in for the Supabase server client. Every action calls createClient
 * directly, hasRole calls it a second time, and recordAuditEvent a third — all
 * three resolve to this same object, so it has to answer has_role, the dogs
 * update, the RPCs, and the audit_log insert at once.
 *
 * `.eq` is what gets awaited, so the resolved { error } must hang off it. If it
 * hung off `.update`, `const { error } = await ...` would be undefined and a
 * broken action would pass.
 */
function client({ user, roles, updateError = null, rpcError = null }: {
  user: string | null
  roles: string[]
  updateError?: { message: string } | null
  rpcError?: { message: string } | null
}) {
  return {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'has_role') return { data: roles.includes(String(args.role_name)), error: null }
      mocks.rpc(fn, args)
      return { data: null, error: rpcError }
    },
    from: (table: string) => {
      if (table === 'audit_log') {
        return { insert: async (row: Record<string, unknown>) => { mocks.auditInsert(row); return { error: null } } }
      }
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: string) => {
            mocks.update(table, patch, col, val)
            return { error: updateError }
          },
        }),
      }
    },
  }
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.append(k, v)
  return f
}

beforeEach(() => {
  mocks.createClient.mockReset()
  mocks.revalidatePath.mockReset()
  mocks.rpc.mockReset()
  mocks.update.mockReset()
  mocks.auditInsert.mockReset()
})

describe('removeDogAction', () => {
  it('calls admin_remove_dog and records an audit event', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await removeDogAction(fd({ dogId: 'dog-1', reason: 'spam' }))

    expect(mocks.rpc).toHaveBeenCalledWith('admin_remove_dog', { p_dog_id: 'dog-1', p_reason: 'spam' })
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dog.remove', target_type: 'dog', target_id: 'dog-1' }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/dogs')
  })

  it('refuses a non-admin before touching the database', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'plain1', roles: [] }))
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await expect(removeDogAction(fd({ dogId: 'dog-1' }))).rejects.toThrow('Forbidden')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses a signed-out caller', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await expect(removeDogAction(fd({ dogId: 'dog-1' }))).rejects.toThrow('Unauthorized')
  })

  it('surfaces a database refusal and records nothing', async () => {
    mocks.createClient.mockResolvedValue(
      client({ user: 'admin1', roles: ['admin'], rpcError: { message: 'already removed' } }),
    )
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await expect(removeDogAction(fd({ dogId: 'dog-1' }))).rejects.toThrow('already removed')
    expect(mocks.auditInsert).not.toHaveBeenCalled()
  })
})

describe('restoreDogAction', () => {
  it('calls admin_restore_dog and audits it', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { restoreDogAction } = await import('@/app/admin/dogs/actions')
    await restoreDogAction(fd({ dogId: 'dog-2' }))
    expect(mocks.rpc).toHaveBeenCalledWith('admin_restore_dog', { p_dog_id: 'dog-2' })
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dog.restore', target_id: 'dog-2' }),
    )
  })
})

describe('updateDogAction', () => {
  it('writes only the editable fields', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { updateDogAction } = await import('@/app/admin/dogs/actions')
    await updateDogAction(fd({
      dogId: 'dog-3',
      name: 'Rex',
      breedId: '4',
      sex: 'male',
      birthDate: '2022-01-01',
      weightLbs: '30',
      temperamentNotes: 'calm',
      listedPriceCents: '',
    }))

    expect(mocks.update).toHaveBeenCalledWith(
      'dogs',
      {
        name: 'Rex',
        breed_id: 4,
        sex: 'male',
        birth_date: '2022-01-01',
        weight_lbs: 30,
        temperament_notes: 'calm',
        listed_price_cents: null,
      },
      'id',
      'dog-3',
    )
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('owner_id')
  })

  it('rejects an unknown sex before writing', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { updateDogAction } = await import('@/app/admin/dogs/actions')
    await expect(
      updateDogAction(fd({ dogId: 'dog-3', name: 'Rex', breedId: '4', sex: 'unknown', birthDate: '2022-01-01' })),
    ).rejects.toThrow('sex must be male or female')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refuses a non-admin without reporting input problems', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'plain1', roles: [] }))
    const { updateDogAction } = await import('@/app/admin/dogs/actions')
    // Deliberately malformed. The gate runs first, so the caller learns they are
    // not allowed in — not which of their fields was wrong.
    await expect(updateDogAction(fd({ dogId: '', name: '' }))).rejects.toThrow('Forbidden')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('reassignDogAction', () => {
  it('requires the typed dog name to match', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { reassignDogAction } = await import('@/app/admin/dogs/actions')
    await expect(
      reassignDogAction(fd({ dogId: 'dog-4', newOwnerId: 'o2', dogName: 'Rex', confirmName: 'rexx' })),
    ).rejects.toThrow('Confirmation did not match')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('reassigns and audits both owners when the name matches', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { reassignDogAction } = await import('@/app/admin/dogs/actions')
    await reassignDogAction(fd({
      dogId: 'dog-4', newOwnerId: 'o2', dogName: 'Rex', confirmName: 'Rex', previousOwnerId: 'o1',
    }))
    expect(mocks.update).toHaveBeenCalledWith('dogs', { owner_id: 'o2' }, 'id', 'dog-4')
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dog.reassign',
        detail: { fromOwnerId: 'o1', toOwnerId: 'o2' },
      }),
    )
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npm test -- tests/unit/admin-dogs-actions.test.ts
```

Expected: FAIL — `Cannot find module '@/app/admin/dogs/actions'`.

- [ ] **Step 3: Implement the actions**

Create `app/admin/dogs/actions.ts`. The shape deliberately mirrors `app/admin/users/actions.ts`: a private helper does the gate, the exported wrappers are what the page binds.

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/auth/roles'
import { recordAuditEvent } from '@/lib/auth/audit'

const SEXES = ['male', 'female'] as const

/**
 * Every action in this file gates the same way app/admin/users/actions.ts does.
 * The database is the real gate — admin_remove_dog and admin_restore_dog
 * re-check is_admin(), and dogs_update_admin governs the direct update. The
 * check here only produces a clearer error than a bare RPC rejection.
 */
async function adminClient() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')
  if (!(await hasRole('admin'))) throw new Error('Forbidden')
  return supabase
}

function requiredString(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key} is required`)
  return value
}

/** '' means "clear it" for the nullable columns, not "write an empty string". */
function optionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`${key} must be a number`)
  return n
}

export async function updateDogAction(formData: FormData) {
  const supabase = await adminClient()

  const dogId = requiredString(formData, 'dogId')
  const name = requiredString(formData, 'name')
  const breedId = Number(requiredString(formData, 'breedId'))
  if (!Number.isFinite(breedId)) throw new Error('breedId must be a number')
  const sex = requiredString(formData, 'sex')
  if (!SEXES.includes(sex as (typeof SEXES)[number])) throw new Error('sex must be male or female')
  const birthDate = requiredString(formData, 'birthDate')

  const patch = {
    name,
    breed_id: breedId,
    sex,
    birth_date: birthDate,
    weight_lbs: optionalNumber(formData, 'weightLbs'),
    temperament_notes: String(formData.get('temperamentNotes') ?? '').trim() || null,
    listed_price_cents: optionalNumber(formData, 'listedPriceCents'),
  }

  const { error } = await supabase.from('dogs').update(patch).eq('id', dogId)
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: 'dog.update',
    targetType: 'dog',
    targetId: dogId,
    detail: { fields: Object.keys(patch) },
  })
  revalidatePath('/admin/dogs')
}

export async function removeDogAction(formData: FormData) {
  const supabase = await adminClient()
  const dogId = requiredString(formData, 'dogId')
  const reason = String(formData.get('reason') ?? '').trim() || null

  const { error } = await supabase.rpc('admin_remove_dog', { p_dog_id: dogId, p_reason: reason })
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: 'dog.remove',
    targetType: 'dog',
    targetId: dogId,
    detail: reason ? { reason } : {},
  })
  revalidatePath('/admin/dogs')
}

export async function restoreDogAction(formData: FormData) {
  const supabase = await adminClient()
  const dogId = requiredString(formData, 'dogId')

  const { error } = await supabase.rpc('admin_restore_dog', { p_dog_id: dogId })
  if (error) throw new Error(error.message)

  await recordAuditEvent({ action: 'dog.restore', targetType: 'dog', targetId: dogId })
  revalidatePath('/admin/dogs')
}

/**
 * Reassignment moves a dog, its photos and its health documents between two
 * real people. It is the most dangerous single write in the console, so it
 * requires the dog's name typed back before it will run.
 */
export async function reassignDogAction(formData: FormData) {
  const supabase = await adminClient()

  const dogId = requiredString(formData, 'dogId')
  const newOwnerId = requiredString(formData, 'newOwnerId')
  const dogName = requiredString(formData, 'dogName')
  const confirmName = String(formData.get('confirmName') ?? '').trim()
  if (confirmName !== dogName) throw new Error('Confirmation did not match the dog name')

  const previousOwnerId = String(formData.get('previousOwnerId') ?? '') || null

  const { error } = await supabase.from('dogs').update({ owner_id: newOwnerId }).eq('id', dogId)
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: 'dog.reassign',
    targetType: 'dog',
    targetId: dogId,
    detail: { fromOwnerId: previousOwnerId, toOwnerId: newOwnerId },
  })
  revalidatePath('/admin/dogs')
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test -- tests/unit/admin-dogs-actions.test.ts
```

Expected: all pass. If `removeDogAction`'s "refuses a non-admin" test fails with a `TypeError` rather than `Forbidden`, the fake client is missing the `has_role` branch — `hasRole` calls `createClient` a second time through the same mock.

- [ ] **Step 5: Commit**

```bash
git add app/admin/dogs/actions.ts tests/unit/admin-dogs-actions.test.ts
git commit -m "feat(admin): dog management server actions

Update, remove, restore and reassign, gated the same way
app/admin/users/actions.ts is. Reassignment requires the dog's name typed
back — it moves photos and health documents between two real people."
```

---

### Task 6: The `/admin/dogs` console section

**Files:**
- Create: `app/admin/dogs/page.tsx`
- Modify: `app/admin/layout.tsx:10-16`

**Interfaces:**
- Consumes: `updateDogAction`, `removeDogAction`, `restoreDogAction`, `reassignDogAction` from Task 5.

- [ ] **Step 1: Add the nav entry**

In `app/admin/layout.tsx`, the `NAV` array currently holds five entries. Add Dogs after Users:

```tsx
const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/dogs', label: 'Dogs' },
  { href: '/admin/review-queue', label: 'Review queue' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/audit-log', label: 'Audit log' },
]
```

- [ ] **Step 2: Write the page**

Create `app/admin/dogs/page.tsx`, mirroring `app/admin/users/page.tsx` — same `requireRole` call, same `pageMetadata`, same `max-w-2xl` main, same `rounded border border-hairline p-4` card and `fp-h2` / `text-ink-soft` vocabulary.

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { pageMetadata } from '@/lib/seo'
import {
  updateDogAction,
  removeDogAction,
  restoreDogAction,
  reassignDogAction,
} from './actions'

export const metadata = pageMetadata({
  title: 'Dogs',
  description: 'Manage member dogs.',
  path: '/admin/dogs',
  index: false,
})

const FIELD = 'mt-1 w-full rounded border border-hairline px-2 py-1 text-sm'
const BTN = 'rounded border border-hairline px-2 py-1 text-sm'

export default async function AdminDogsPage() {
  await requireRole('admin')
  const supabase = await createClient()

  // dogs_select_admin is deliberately unfiltered, so removed dogs appear here
  // and nowhere else. That is what makes restore possible.
  const { data: dogs } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, weight_lbs, temperament_notes, breed_id, litter_id, listed_price_cents, owner_id, removed_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: breeds } = await supabase.from('breeds').select('id, name').order('name')
  const { data: owners } = await supabase
    .from('owners')
    .select('id, display_name')
    .order('display_name')
    .limit(500)

  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.display_name]))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Dogs</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Removing a dog hides it from browse, matching and its owner&rsquo;s own list. Its health
        documents, photos and message threads are preserved and it can be restored.
      </p>

      {(dogs ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No dogs yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {(dogs ?? []).map((dog) => (
            <li key={dog.id} className="rounded border border-hairline p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{dog.name}</p>
                <p className="text-xs text-ink-soft">
                  {dog.removed_at ? `Removed ${new Date(dog.removed_at).toLocaleDateString()}` : 'Active'}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Owner: {ownerName.get(dog.owner_id) ?? dog.owner_id}
              </p>

              <form action={updateDogAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="dogId" value={dog.id} />
                <label className="text-xs text-ink-soft">
                  Name
                  <input name="name" defaultValue={dog.name} className={FIELD} required />
                </label>
                <label className="text-xs text-ink-soft">
                  Breed
                  <select name="breedId" defaultValue={String(dog.breed_id)} className={FIELD}>
                    {(breeds ?? []).map((b) => (
                      <option key={b.id} value={String(b.id)}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  Sex
                  <select name="sex" defaultValue={dog.sex} className={FIELD}>
                    <option value="male">male</option>
                    <option value="female">female</option>
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  Birth date
                  <input type="date" name="birthDate" defaultValue={dog.birth_date} className={FIELD} required />
                </label>
                <label className="text-xs text-ink-soft">
                  Weight (lbs)
                  <input name="weightLbs" defaultValue={dog.weight_lbs ?? ''} className={FIELD} />
                </label>
                <label className="text-xs text-ink-soft">
                  Temperament notes
                  <textarea name="temperamentNotes" defaultValue={dog.temperament_notes ?? ''} className={FIELD} rows={2} />
                </label>
                <label className="text-xs text-ink-soft">
                  Listed price (cents) — clear to pull from the marketplace
                  <input name="listedPriceCents" defaultValue={dog.listed_price_cents ?? ''} className={FIELD} />
                </label>
                <button type="submit" className={BTN}>Save changes</button>
              </form>

              <form action={reassignDogAction} className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
                <input type="hidden" name="dogId" value={dog.id} />
                <input type="hidden" name="dogName" value={dog.name} />
                <input type="hidden" name="previousOwnerId" value={dog.owner_id} />
                <label className="text-xs text-ink-soft">
                  Reassign to
                  <select name="newOwnerId" defaultValue={dog.owner_id} className={FIELD}>
                    {(owners ?? []).map((o) => (
                      <option key={o.id} value={o.id}>{o.display_name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  Type <strong>{dog.name}</strong> to confirm — this moves photos and health documents
                  <input name="confirmName" className={FIELD} />
                </label>
                <button type="submit" className={BTN}>Reassign owner</button>
              </form>

              {dog.removed_at ? (
                <form action={restoreDogAction} className="mt-3 border-t border-hairline pt-3">
                  <input type="hidden" name="dogId" value={dog.id} />
                  <button type="submit" className={BTN}>Restore</button>
                </form>
              ) : (
                <form action={removeDogAction} className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
                  <input type="hidden" name="dogId" value={dog.id} />
                  <label className="text-xs text-ink-soft">
                    Reason
                    <input name="reason" className={FIELD} />
                  </label>
                  <button type="submit" className={BTN}>Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Typecheck, lint, build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all clean, and `/admin/dogs` appears in the build output as a dynamic route alongside the other five.

- [ ] **Step 4: Commit**

```bash
git add app/admin/dogs/page.tsx app/admin/layout.tsx
git commit -m "feat(admin): /admin/dogs console section

Sixth section in the console nav. Lists every dog including removed ones
— dogs_select_admin is unfiltered, which is what makes restore possible."
```

---

### Task 7: Full verification and merge

**Files:** none changed.

- [ ] **Step 1: Run the whole triad**

```bash
npm test && npx tsc --noEmit && npm run lint
```

Expected: all 200 pre-existing unit tests still pass, plus the new `admin-dogs-actions` suite. Zero type errors, zero lint errors.

- [ ] **Step 2: Re-run every assertion script against production**

Via Supabase MCP `execute_sql`, in order: `0026_role_system_assertions.sql`, `0027_audit_log_assertions.sql`, `0028_admin_dog_management_assertions.sql`.

Expected: three clean runs, no `FAIL:`.

- [ ] **Step 3: Verify the spec's "Done when" list**

Walk `docs/superpowers/specs/2026-09-07-admin-console-completion-design.md` §"Done when" items 1 through 7 plus 5a and 5b, and confirm each one against the running system. Item 2 — an owner granted `admin` through the console sees a populated console — needs an actual grant-and-check, not an inspection.

- [ ] **Step 4: Confirm no `is_admin` column reads crept back in**

```bash
grep -rn "is_admin" app lib components --include="*.ts" --include="*.tsx"
```

Expected: no output. The boolean is legacy in the database only.

- [ ] **Step 5: Merge**

Use `superpowers:finishing-a-development-branch` to decide between merge, PR, or cleanup for `feat/admin-console-role-system`.

---

## Done When

Everything in the spec's "Done when" section, plus:

1. `supabase/tests/` holds assertion scripts for 0026, 0027 and 0028, and all three run clean against production.
2. No Supabase rehearsal branches remain — `list_branches` shows none.
3. `npm test`, `npx tsc --noEmit` and `npm run lint` are clean.

## Deliberately not in this plan

- **Dropping `owners.is_admin`.** It stays as write-frozen legacy.
- **Puppy listings (Plan 2)** and its unresolved `listing_inquiries` parent question.
- **Owner-facing soft delete.** Owners keep the existing hard-delete path; `removed_at` is a moderation tool.
- **Mascot standardisation and the landing-page scroll work.** Agreed to follow this plan as separate specs.
