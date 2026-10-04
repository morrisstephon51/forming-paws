# Admin Console & Role System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `owners.is_admin` boolean with a real role model (admin / moderator / breeder), and grow `app/admin` from three loose pages into a navigable console with user management and an immutable audit log.

**Architecture:** A `roles` + `user_roles` junction with a `security definer` `has_role()` function callable from RLS policies, server actions, and nav rendering alike. All role writes go through `grant_role`/`revoke_role` security-definer functions — `user_roles` has deliberately no INSERT/UPDATE/DELETE policies, mirroring the posture migration 0014 established for `is_admin`. Existing admin pages migrate to a shared `requireRole` util behind an unchanged user-visible surface.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (`@supabase/ssr`), PostgreSQL RLS, vitest (unit), Playwright (e2e), psql assertion scripts (`supabase/tests/`).


## Status — 2026-08-26

| Task | State |
|---|---|
| 1 · Migration 0026 (role system + RLS bridge) | **written, NOT applied** — awaiting production approval |
| 2 · `requireRole` util | done — 7 unit tests green |
| 3 · Migrate 6 admin files off `is_admin` | done — `grep -rn is_admin app lib` returns nothing |
| 4 · Admin console shell | done |
| 5 · Migration 0027 (audit log) + helper | helper done; **migration written, NOT applied** |
| 6 · Member & role management | done |
| 7 · Audit log viewer | done |

Verification at time of writing: `tsc --noEmit` clean · `eslint` clean · **200/200 unit tests** ·
`next build` succeeds with all five `/admin/*` routes compiling as dynamic.

**Nothing is runnable end to end until 0026 and 0027 are applied** — the app calls `has_role`
and reads `user_roles`/`audit_log`, none of which exist in the database yet. This is the agreed
sequence: app code first, reviewed diff, then the migration.

---
## Global Constraints

- **Next migration number is 0026.** 25 migrations exist; `0022` is used twice already — do not add a third collision.
- **`owners.id` IS `auth.users.id`.** There is no separate users table. `auth.uid() = owners.id` everywhere.
- **`owners.is_admin` becomes legacy after this plan. It is NOT dropped and NOT written to.** See Task 1 Step 3 for why writing it is impossible from an authenticated session.
- **`has_role()` must be `security definer set search_path = public`.** A plain function reading `user_roles` from inside a policy on `user_roles` recurses infinitely.
- **There is no local database and no `DATABASE_URL`.** No `supabase/config.toml`, no local stack. The only Forming Paws project is `wyzcnkdonbdykidmcxvx` (ACTIVE_HEALTHY) — **it is production**, holding 36 owners, 14 dogs, and live messages. Migrations are applied with the Supabase MCP `apply_migration`; assertions run via `execute_sql`.
- **The migration ledger is NOT a source of truth.** `contact_messages` exists in production but has no row in `supabase_migrations.schema_migrations` — some migrations were applied via `execute_sql`, which records nothing. Verify applied state by querying the schema, never by `list_migrations`.
- **SQL tests follow `supabase/tests/0022_deactivation_assertions.sql`:** wrapped in `begin; … rollback;`, each assertion a `do $$ … raise exception … $$` so it fails loudly.
- **Admin pages use `pageMetadata({ …, index: false })`** from `@/lib/seo`.
- **Existing gate pattern to replace** (present in all 6 admin files): `supabase.auth.getUser()` → `redirect('/login')`, then `owners.select('is_admin')` → `redirect('/home')` (pages) or `throw new Error('Forbidden')` (actions).

---

## Corrections to the Kairo architecture spec

The spec at `docs/specs/2026-08-26-admin-console-and-puppy-listings-spec.md` was produced by an agent that cannot read the repository. Three of its bindings are wrong and are corrected here:

| Spec said | Reality | Effect on this plan |
|---|---|---|
| Backfill `is_admin` from a users table | `is_admin` is on `owners` | Task 1 backfills from `owners` |
| Add `item_type` to `review_queue_items` | **No such table.** The review queue reads `health_documents` | Dropped entirely; listing moderation is Plan 2's own `status` column |
| `listing_inquiries(listing_id, conversation_id, …)` | **No `conversations` table.** `messages.match_id` → `matches(id)` NOT NULL, and `matches` is strictly dog↔dog (`dog_a_id < dog_b_id`) | Deferred to Plan 2; inquiries cannot ride `matches` |

**And one thing the spec could not have known:** migration `0014_prevent_owner_self_admin_escalation.sql` installs a trigger that raises whenever `is_admin` changes while `auth.uid() is not null`. Any code that tries to keep `is_admin` in sync from an admin's session **will throw**. This plan therefore treats `is_admin` as write-frozen legacy. Task 1 Step 4 asserts this explicitly rather than trusting it.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0026_role_system.sql` | roles, user_roles, has_role/has_any_role, grant_role/revoke_role, backfill |
| `supabase/tests/0026_role_system_assertions.sql` | RLS + escalation-guard assertions |
| `lib/auth/roles.ts` | `hasRole`, `requireRole`, `requireAnyRole` — the single server-side gate |
| `tests/unit/roles.test.ts` | unit coverage for the gate |
| `app/admin/layout.tsx` | console shell: one gate, one nav |
| `supabase/migrations/0027_audit_log.sql` | append-only audit_log + RLS |
| `lib/auth/audit.ts` | `recordAuditEvent` |
| `app/admin/users/{page.tsx,actions.ts}` | user & role management |
| `app/admin/audit-log/page.tsx` | audit viewer |

---

### Task 1: Migration 0026 — role system

**Files:**
- Create: `supabase/migrations/0026_role_system.sql`
- Test: `supabase/tests/0026_role_system_assertions.sql`

**Interfaces:**
- Produces: SQL `public.has_role(text) → boolean`, `public.has_any_role(text[]) → boolean`, `public.grant_role(uuid, text) → void`, `public.revoke_role(uuid, text) → void`; tables `public.roles(id, name, description)`, `public.user_roles(owner_id, role_id, granted_at, granted_by)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0026_role_system.sql
--
-- Replaces the single owners.is_admin boolean with a roles/user_roles model.
-- is_admin is backfilled FROM here once and then left alone: migration 0014
-- installs a trigger that raises if is_admin changes while auth.uid() is
-- non-null, so no authenticated session can keep it in sync. Roles are the
-- source of truth from this migration forward. Dropping the column is a later
-- cleanup once every call site is confirmed migrated (see Task 3).

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

-- DELIBERATELY no insert/update/delete policies on user_roles. Every write
-- goes through grant_role/revoke_role. Same posture as 0014's is_admin guard:
-- a privilege change is never a direct authenticated-API write.

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

-- Backfill: every current admin keeps their access.
insert into public.user_roles (owner_id, role_id)
select o.id, (select id from public.roles where name = 'admin')
from public.owners o
where o.is_admin
on conflict do nothing;

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


-- ---------------------------------------------------------------------------
-- RLS BRIDGE — the whole reason this migration is safe.
--
-- 11 policies across 8 tables gate on admin status. 9 of them call
-- public.is_admin(), which reads owners.is_admin — the column this migration
-- freezes. Without the redefinition below, an owner granted 'admin' through
-- the new console would pass the app-layer requireRole() gate and then match
-- ZERO rows in every admin policy: an empty console that looks like "no data"
-- rather than "denied". Redefining the function fixes all 9 call sites at once
-- with no policy edits.
--
-- Ordering matters: the backfill above must already have run, or every existing
-- admin loses access the moment this function is replaced.
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

revoke all on function public.grant_role(uuid, text)  from public;
revoke all on function public.revoke_role(uuid, text) from public;
grant execute on function public.grant_role(uuid, text)  to authenticated;
grant execute on function public.revoke_role(uuid, text) to authenticated;
grant execute on function public.has_role(text)          to authenticated;
grant execute on function public.has_any_role(text[])    to authenticated;
```

- [ ] **Step 2: Write the assertion test**

```sql
-- supabase/tests/0026_role_system_assertions.sql
-- Run via the Supabase MCP: execute_sql(<this file>). Kept as a file so it is
-- reviewable in git and re-runnable, matching 0022_deactivation_assertions.sql.
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

-- The backfill must not have been bypassed: is_admin owners are admins.
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

-- unknown role names are rejected, not silently ignored.
do $$
begin
  begin
    perform public.grant_role((select v from t_ids where k = 'plain_b'), 'sorcerer');
    raise exception 'FAIL: grant_role accepted an unknown role';
  exception when others then
    if sqlerrm not like '%unknown role%' then raise; end if;
  end;
end $$;

-- The RLS bridge: is_admin() must now resolve through the role system, so that
-- an owner granted 'admin' via grant_role satisfies all 9 policies that call it.
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

-- user_roles has no write policies: a direct authenticated INSERT must fail.
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
```

- [ ] **Step 3: Apply the migration and run the assertions**

Apply with the Supabase MCP against project `wyzcnkdonbdykidmcxvx`:
- `apply_migration(name: "role_system", query: <contents of 0026_role_system.sql>)`
- then `execute_sql(<contents of supabase/tests/0026_role_system_assertions.sql>)`

Expected: migration applies clean; the assertion script completes with **no** `FAIL:` exception raised.

- [ ] **Step 4: Prove the `is_admin` freeze is real, not assumed**

Confirm the 0014 trigger genuinely blocks the sync path this plan chose to avoid. Run via `execute_sql`:
```sql
select tgname from pg_trigger where tgname = 'owners_prevent_self_admin_escalation';
```
Expected: one row. If the trigger is absent, stop — the freeze rationale in Global Constraints no longer holds and Task 6's design must be revisited.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0026_role_system.sql supabase/tests/0026_role_system_assertions.sql
git commit -m "feat(db): role system with security-definer grant/revoke, replacing is_admin"
```

---

### Task 2: `requireRole` server util

**Files:**
- Create: `lib/auth/roles.ts`
- Test: `tests/unit/roles.test.ts`

**Interfaces:**
- Consumes: `public.has_role` / `public.has_any_role` from Task 1; `createClient` from `@/lib/supabase/server`.
- Produces: `requireRole(role: string, opts?: { redirectTo?: string }): Promise<{ userId: string }>`, `requireAnyRole(roles: string[], opts?): Promise<{ userId: string }>`, `hasRole(role: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/roles.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/navigation', () => ({
  redirect: (p: string) => { mocks.redirect(p); throw new Error('NEXT_REDIRECT') },
}))

function client({ user, roles }: { user: string | null; roles: string[] }) {
  return {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ then: undefined, data: roles.map((r) => ({ roles: { name: r } })), error: null }),
      }),
    }),
    rpc: async (_fn: string, args: { role_name?: string; role_names?: string[] }) => ({
      data: args.role_name ? roles.includes(args.role_name)
                           : (args.role_names ?? []).some((r) => roles.includes(r)),
      error: null,
    }),
  }
}

describe('requireRole', () => {
  beforeEach(() => { mocks.redirect.mockReset() })

  it('returns the user id when the role is held', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u1', roles: ['admin'] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).resolves.toEqual({ userId: 'u1' })
  })

  it('redirects to /login when signed out', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /home when the role is missing', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u2', roles: ['breeder'] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/home')
  })

  it('requireAnyRole passes when one of several roles is held', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u3', roles: ['moderator'] }))
    const { requireAnyRole } = await import('@/lib/auth/roles')
    await expect(requireAnyRole(['admin', 'moderator'])).resolves.toEqual({ userId: 'u3' })
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/unit/roles.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/roles`.

- [ ] **Step 3: Implement**

```ts
// lib/auth/roles.ts
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Options = { redirectTo?: string }

export async function hasRole(role: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('has_role', { role_name: role })
  return data === true
}

/**
 * Gate a page or server action on a single role. Signed-out callers go to
 * /login; signed-in callers without the role go to /home — matching the
 * behaviour the six original admin files implemented by hand.
 */
export async function requireRole(role: string, opts: Options = {}): Promise<{ userId: string }> {
  return requireAnyRole([role], opts)
}

export async function requireAnyRole(roles: string[], opts: Options = {}): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data } = await supabase.rpc('has_any_role', { role_names: roles })
  if (data !== true) redirect(opts.redirectTo ?? '/home')

  return { userId: userData.user.id }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- tests/unit/roles.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/roles.ts tests/unit/roles.test.ts
git commit -m "feat(auth): requireRole/requireAnyRole gate backed by has_role RPC"
```

---

### Task 3: Migrate the six existing admin files to `requireRole`

**Files:**
- Modify: `app/admin/messages/page.tsx`, `app/admin/messages/actions.ts`, `app/admin/review-queue/page.tsx`, `app/admin/review-queue/actions.ts`, `app/admin/reports/page.tsx`, `app/admin/reports/actions.ts`

**Interfaces:**
- Consumes: `requireRole` from Task 2.

- [ ] **Step 1: Replace the gate in each of the three pages**

In each `page.tsx`, delete the `getUser` + `owners.select('is_admin')` block and replace with a single call. For `app/admin/reports/page.tsx` the result is:

```ts
import { requireRole } from '@/lib/auth/roles'

export default async function ReportsPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data: reports } = await supabase
    .from('match_reports')
    .select('id, match_id, reason, detail, status, created_at')
    .in('status', ['open', 'reviewing'])
    .order('created_at')
  // …unchanged render below
```

Apply the identical shape to `app/admin/messages/page.tsx` and `app/admin/review-queue/page.tsx`, keeping each file's own data query untouched.

- [ ] **Step 2: Replace the gate in each of the three action files**

Actions threw rather than redirected. Preserve that:

```ts
import { hasRole } from '@/lib/auth/roles'

async function assertAdmin() {
  if (!(await hasRole('admin'))) throw new Error('Forbidden')
}
```

Call `await assertAdmin()` where the old `owners.select('is_admin')` / `throw new Error('Forbidden')` pair stood, in all three `actions.ts` files.

- [ ] **Step 3: Verify no `is_admin` reads survive in app code**

Run: `grep -rn "is_admin" app lib | grep -v node_modules`
Expected: **no output.** Any hit is an unmigrated call site — fix it before continuing.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all unit tests pass, no type errors, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin
git commit -m "refactor(admin): gate all six admin surfaces on requireRole instead of is_admin"
```

---

### Task 4: Admin console shell

**Files:**
- Create: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: `requireRole` from Task 2.
- Produces: nav shell wrapping every `/admin/*` route.

- [ ] **Step 1: Write the layout**

```tsx
// app/admin/layout.tsx
import Link from 'next/link'
import { requireRole } from '@/lib/auth/roles'

const NAV = [
  { href: '/admin/users',        label: 'Users' },
  { href: '/admin/review-queue', label: 'Review queue' },
  { href: '/admin/reports',      label: 'Reports' },
  { href: '/admin/messages',     label: 'Messages' },
  { href: '/admin/audit-log',    label: 'Audit log' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin')

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="border-b border-ink/10 pb-4">
        <h1 className="fp-h2">Administration</h1>
        <nav aria-label="Admin sections" className="mt-3 flex flex-wrap gap-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-ink-soft hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="pt-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Confirm the layout gate does not double-redirect**

Run: `npm run dev` and visit `/admin/reports` signed in as an admin.
Expected: page renders once with nav above it. The per-page `requireRole` calls from Task 3 stay — defence in depth, and a page reached outside this layout is still gated.

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(admin): console shell with section nav"
```

---

### Task 5: Audit log

**Files:**
- Create: `supabase/migrations/0027_audit_log.sql`, `lib/auth/audit.ts`

**Interfaces:**
- Produces: table `public.audit_log(id, actor_id, action, target_type, target_id, detail, created_at)`; `recordAuditEvent(input: { action: string; targetType: string; targetId?: string; detail?: Record<string, unknown> }): Promise<void>`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0027_audit_log.sql
-- Append-only record of privileged actions. Admins read; nobody updates or
-- deletes — there are no UPDATE/DELETE policies, by design.

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.owners(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.has_role('admin'));

-- Only admins perform the actions this log records, so only admins may write
-- to it. Without the has_role check any authenticated user could inject rows.
create policy "audit_log_insert_admin" on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid() and public.has_role('admin'));
```

- [ ] **Step 2: Write the helper**

```ts
// lib/auth/audit.ts
import { createClient } from '@/lib/supabase/server'

export async function recordAuditEvent(input: {
  action: string
  targetType: string
  targetId?: string
  detail?: Record<string, unknown>
}): Promise<void> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Cannot record an audit event without an actor')

  const { error } = await supabase.from('audit_log').insert({
    actor_id: userData.user.id,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    detail: input.detail ?? {},
  })
  // An audit write that fails silently is worse than one that fails loudly.
  if (error) throw new Error(`Audit write failed: ${error.message}`)
}
```

- [ ] **Step 3: Apply and verify the append-only posture**

Apply via `apply_migration(name: "audit_log", query: <contents of 0027_audit_log.sql>)`, then `execute_sql`:
```sql
select cmd, count(*) from pg_policies where tablename='audit_log' group by cmd;
```
Expected: only `SELECT` and `INSERT` rows. If `UPDATE` or `DELETE` appears, the log is mutable — fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0027_audit_log.sql lib/auth/audit.ts
git commit -m "feat(admin): append-only audit log"
```

---

### Task 6: User & role management page

**Files:**
- Create: `app/admin/users/page.tsx`, `app/admin/users/actions.ts`

**Interfaces:**
- Consumes: `grant_role`/`revoke_role` (Task 1), `hasRole` (Task 2), `recordAuditEvent` (Task 5).
- Produces: server actions `grantRoleAction(formData: FormData)`, `revokeRoleAction(formData: FormData)`.

- [ ] **Step 1: Write the actions**

```ts
// app/admin/users/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/auth/roles'
import { recordAuditEvent } from '@/lib/auth/audit'

async function assertAdmin() {
  if (!(await hasRole('admin'))) throw new Error('Forbidden')
}

async function mutateRole(formData: FormData, fn: 'grant_role' | 'revoke_role') {
  await assertAdmin()
  const ownerId = String(formData.get('ownerId') ?? '')
  const roleName = String(formData.get('roleName') ?? '')
  if (!ownerId || !roleName) throw new Error('ownerId and roleName are required')

  const supabase = await createClient()
  // The database is the real gate: grant_role/revoke_role re-check admin,
  // refuse self-escalation, and refuse removing the last admin.
  const { error } = await supabase.rpc(fn, { target_owner: ownerId, role_name: roleName })
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: fn === 'grant_role' ? 'role.grant' : 'role.revoke',
    targetType: 'owner',
    targetId: ownerId,
    detail: { role: roleName },
  })
  revalidatePath('/admin/users')
}

export async function grantRoleAction(formData: FormData)  { await mutateRole(formData, 'grant_role') }
export async function revokeRoleAction(formData: FormData) { await mutateRole(formData, 'revoke_role') }
```

- [ ] **Step 2: Write the page**

```tsx
// app/admin/users/page.tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { pageMetadata } from '@/lib/seo'
import { grantRoleAction, revokeRoleAction } from './actions'

export const metadata = pageMetadata({
  title: 'Users',
  description: 'Manage member roles.',
  path: '/admin/users',
  index: false,
})

export default async function UsersPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data: owners } = await supabase
    .from('owners')
    .select('id, display_name, created_at, user_roles(roles(name))')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: roles } = await supabase.from('roles').select('name').order('name')

  return (
    <main>
      <h2 className="fp-h3">Members</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Role changes are enforced by the database. An admin cannot grant themselves the admin
        role, and the last admin cannot be removed.
      </p>

      <ul className="mt-6 divide-y divide-ink/10">
        {(owners ?? []).map((owner) => {
          const held: string[] = (owner.user_roles ?? [])
            .map((ur: { roles: { name: string } | null }) => ur.roles?.name)
            .filter((n: string | undefined): n is string => Boolean(n))

          return (
            <li key={owner.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{owner.display_name}</span>
                <span className="text-xs text-ink-soft">{held.join(', ') || 'no roles'}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {(roles ?? []).map((role) => {
                  const has = held.includes(role.name)
                  return (
                    <form key={role.name} action={has ? revokeRoleAction : grantRoleAction}>
                      <input type="hidden" name="ownerId" value={owner.id} />
                      <input type="hidden" name="roleName" value={role.name} />
                      <button type="submit" className="rounded border border-ink/20 px-2 py-1 text-xs">
                        {has ? `Revoke ${role.name}` : `Grant ${role.name}`}
                      </button>
                    </form>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Verify the guards fire**

Signed in as an admin, click **Grant admin** on your own row.
Expected: the action throws `an admin cannot grant the admin role to themselves`. If it succeeds, Task 1's guard is not installed — stop and fix.

- [ ] **Step 4: Run the suite and commit**

Run: `npm test && npx tsc --noEmit && npm run lint`

```bash
git add app/admin/users
git commit -m "feat(admin): user and role management with audited grant/revoke"
```

---

### Task 7: Audit log viewer

**Files:**
- Create: `app/admin/audit-log/page.tsx`

**Interfaces:**
- Consumes: `audit_log` (Task 5), `requireRole` (Task 2).

- [ ] **Step 1: Write the page**

```tsx
// app/admin/audit-log/page.tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Audit log',
  description: 'Record of privileged actions.',
  path: '/admin/audit-log',
  index: false,
})

export default async function AuditLogPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, detail, created_at, owners(display_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <main>
      <h2 className="fp-h3">Audit log</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Append-only. There is no update or delete policy on this table.
      </p>

      {(events ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No events recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th scope="col" className="py-2 pr-4">When</th>
                <th scope="col" className="py-2 pr-4">Actor</th>
                <th scope="col" className="py-2 pr-4">Action</th>
                <th scope="col" className="py-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e) => (
                <tr key={e.id} className="border-b border-ink/5">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    {(e.owners as { display_name: string } | null)?.display_name ?? 'system'}
                  </td>
                  <td className="py-2 pr-4">{e.action}</td>
                  <td className="py-2">{e.target_type}{e.target_id ? ` · ${e.target_id}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verify end to end**

Grant `breeder` to another member on `/admin/users`, then open `/admin/audit-log`.
Expected: a `role.grant` row naming you as actor and that member as target. If the grant succeeded but no row appears, `recordAuditEvent` is swallowing an error — it is written to throw, so investigate rather than proceed.

- [ ] **Step 3: Run the suite and commit**

Run: `npm test && npm run test:e2e && npx tsc --noEmit && npm run lint`

```bash
git add app/admin/audit-log
git commit -m "feat(admin): audit log viewer"
```

---

## Done When

1. Every owner who had `is_admin = true` before 0026 can still reach all three original admin routes and perform every original admin action, unchanged.
2. `grep -rn "is_admin" app lib` returns nothing — the boolean is legacy in the database only.
2a. `public.is_admin()` resolves through `has_role('admin')`, so all 9 policies that call it, plus the 2 rewritten `health_documents` policies, honour console-granted admins. An owner granted admin in the console sees a populated console, not an empty one.
3. An admin attempting to grant themselves `admin` is refused by the database, not by the UI.
4. Revoking the last remaining admin is refused.
5. Every `grant_role`/`revoke_role` through the console produces an `audit_log` row visible at `/admin/audit-log`.
6. `npm test`, `npx tsc --noEmit`, and `npm run lint` are all clean.

## Deliberately not in this plan

The Kairo spec asked for "user **and dog** management". Only user management is built here.
Admin dog management (browsing, editing, and removing any member's dogs) needs `dogs` RLS
changes — `dogs_select_own` currently restricts SELECT to `owner_id = auth.uid()`, so an admin
cannot see another member's dogs at all. That is a separate migration with its own privacy
implications and belongs in its own plan, not bolted onto the role foundation.

## Next plan

Plan 2 — **Puppy Listings** — depends on the `breeder` role this plan creates. It must resolve one open question first: listing inquiries cannot ride `matches` (dog↔dog, `dog_a_id < dog_b_id`, and `messages.match_id` is NOT NULL), so it needs either a nullable parent discriminator on `messages` plus a CHECK that exactly one parent is set, or its own thread table. That decision belongs at the top of Plan 2.
