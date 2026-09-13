# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin console a home page at `/admin` showing what needs attention, the real activation funnel, weekly signups and engagement.

**Architecture:** One admin-only security-definer SQL function, `admin_dashboard_stats()`, returns every figure as JSON in a single call, excluding test accounts through one shared rule, `is_test_account()`. A thin server page gates on the admin role, calls the function and hands the JSON to presentational components that are tested in isolation. No chart library: bars are plain CSS.

**Tech Stack:** Next.js 15 App Router (server components), React 19, Tailwind 3.4, Supabase Postgres (plpgsql), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-12-admin-dashboard-design.md`

## Global Constraints

- Work in the worktree `~/forming-paws-openfile` on branch `feat/admin-dashboard`. Run every command from that directory.
- The migration is `0033`. Re-check with `ls supabase/migrations | tail -3` immediately before creating it; this repo has collided on migration numbers three times.
- No new npm dependencies. No chart library.
- Never run `prettier --write`. There is no Prettier config; style is hand-maintained: single quotes, no semicolons, 2-space indent.
- Rendered copy contains no em dashes (commit `b0e960f`). Use `n/a` for an undefined percentage. Code comments may use them.
- zsh does not word-split unquoted variables. Never write `for x in $VAR`; use `printf '%s\n' a b | while IFS= read -r x`.
- Funnel, signups and engagement exclude test accounts via `is_test_account`. Needs-attention counts do NOT, so they match the pages they link to.
- `admin_dashboard_stats()` returns counts and timestamps only: no names, emails or message bodies.
- Chart marks use `bg-brand`. All text uses `text-ink`, `text-ink-soft` or `text-ivory` on an ink tooltip, never the brand green.
- Bars are at most 24px thick, have a 4px rounded data-end and a square baseline end, and are separated by a 2px gap, never a border. Every chart has a table view; tooltips show on hover **and** keyboard focus and are never the only way to read a value.
- **Any action against the production database requires an explicit go-ahead from Stefan first**, including a rolled-back dry run. Task 7 marks each stop.
- Kill stale servers on ports 3000 and 3100 before builds and e2e. Rebuild after any e2e run: Playwright starts `next dev`, which clobbers the production `.next` output.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/0033_admin_dashboard_stats.sql` | create | `is_test_account`, `community_stats` restated on it, `admin_dashboard_stats` |
| `supabase/tests/0033_admin_dashboard_stats_assertions.sql` | create | Rolled-back SQL assertions for all three functions |
| `lib/admin/dashboard.ts` | create | `DashboardStats` type, `FUNNEL_STEPS`, pure formatting helpers |
| `tests/unit/fixtures/dashboard-stats.ts` | create | One shared, plainly fake `DashboardStats` fixture |
| `components/admin/FunnelTable.tsx` | create | The funnel as a real `<table>` with a CSS bar per row |
| `components/admin/SignupColumns.tsx` | create | 8 CSS columns, focus/hover tooltips, `<details>` table twin |
| `components/admin/DashboardView.tsx` | create | Composes header, needs attention, funnel, signups, engagement, error state |
| `app/admin/page.tsx` | create | Role gate, RPC call, renders `DashboardView` |
| `app/admin/layout.tsx` | modify | Adds `Overview` as the first nav item |
| `tests/unit/admin-dashboard.test.ts` | create | Helper tests |
| `tests/unit/admin-dashboard-charts.test.tsx` | create | `FunnelTable` and `SignupColumns` tests |
| `tests/unit/admin-dashboard-view.test.tsx` | create | `DashboardView` tests |
| `tests/unit/admin-overview-page.test.tsx` | create | Page gate, success and error tests |

---

### Task 1: Migration 0033 and its SQL assertions

There is no local database (`.env.local` has no `DATABASE_URL`), so these files cannot be run in this task. Their red/green run happens in Task 7, inside a rolled-back transaction, with a negative control that proves the harness reports failures. This task writes both files completely and checks them statically.

**Files:**
- Create: `supabase/tests/0033_admin_dashboard_stats_assertions.sql`
- Create: `supabase/migrations/0033_admin_dashboard_stats.sql`

**Interfaces:**
- Consumes (already live in production): `public.has_role(text) returns boolean`, `public.grant_role(uuid, text)`, `public.dog_is_baseline_verified(uuid) returns boolean`, tables `auth.users`, `public.owners`, `public.dogs`, `public.health_documents`, `public.match_reports`, `public.contact_messages`, `public.dog_interests`, `public.matches`, `public.messages`, `public.litters`, `public.puppy_inquiries`, `public.breeds`.
- Produces: `public.is_test_account(p_email text) returns boolean`; `public.admin_dashboard_stats() returns json` with exactly the shape of the `DashboardStats` type in Task 2.

- [ ] **Step 1: Confirm the migration number is free**

Run: `ls supabase/migrations | tail -3`
Expected: the last line is `0032_sync_owners_email_on_auth_change.sql`. If anything numbered `0033` already exists, stop and report it.

- [ ] **Step 2: Write the assertions file**

Create `supabase/tests/0033_admin_dashboard_stats_assertions.sql`:

```sql
-- supabase/tests/0033_admin_dashboard_stats_assertions.sql
--
-- Run against a database that has migration 0033 applied. Everything happens
-- inside a transaction that ends in `rollback`, so it asserts against the real
-- functions and real data without leaving anything behind.
--
-- Each assertion is a `do $$ ... raise exception 'FAIL ...' $$`, so the script
-- fails loudly on the first broken expectation.
--
-- Callers are simulated the way 0028_admin_dog_management_assertions.sql does:
-- `set local role authenticated` plus `request.jwt.claims`, then `reset role`.
-- Two traps from that file apply here and are guarded explicitly:
--   * Shape before refusal. A missing function and a missing grant both raise
--     insufficient_privilege, so section 2 would pass against a database where
--     admin_dashboard_stats was never created. Section 0 rules that out.
--   * A real verified dog. dog_is_baseline_verified needs a verified vet_exam
--     inside 12 months AND a verified vaccination; section 7 checks the fixture
--     actually passes before asserting on funnel.verified_dog.

begin;

-- Every id and every captured number lives in a temp table GRANTed to
-- authenticated. Without the grant, checks that run as authenticated die on
-- `permission denied for table`, which reads as a script error rather than a
-- failed assertion (the bug 0027 found and fixed).
create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v)
select k, gen_random_uuid()
from unnest(array['admin', 'member', 'dog', 'test_signup', 'real_signup']) k;
grant select on t_ids to authenticated;

create temporary table t_nums (k text primary key, n bigint);
grant select, insert on t_nums to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '-0033@example.test', 'x', now(), now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('admin', 'member');

-- auth.uid() is null here, which is the SQL path grant_role allows.
select public.grant_role((select v from t_ids where k = 'admin'), 'admin');


-- ---------------------------------------------------------------------------
-- 0. Shape: both functions exist, with the grants the rest depends on.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_test_account(text)') is null then
    raise exception 'FAIL 0: public.is_test_account(text) does not exist';
  end if;
  if to_regprocedure('public.admin_dashboard_stats()') is null then
    raise exception 'FAIL 0: public.admin_dashboard_stats() does not exist';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_dashboard_stats()', 'EXECUTE') then
    raise exception 'FAIL 0: authenticated cannot execute admin_dashboard_stats';
  end if;
  if has_function_privilege('anon', 'public.admin_dashboard_stats()', 'EXECUTE') then
    raise exception 'FAIL 0: anon can execute admin_dashboard_stats';
  end if;
  if has_function_privilege('anon', 'public.is_test_account(text)', 'EXECUTE') then
    raise exception 'FAIL 0: anon can execute is_test_account';
  end if;
  raise notice 'PASS 0: functions exist with the expected grants';
end $$;


-- ---------------------------------------------------------------------------
-- 1. is_test_account truth table.
-- ---------------------------------------------------------------------------
do $$
begin
  if not public.is_test_account('e2e-fixture-owner@gmail.com') then
    raise exception 'FAIL 1: an e2e fixture owner is not treated as a test account';
  end if;
  if not public.is_test_account('e2e-test-123@gmail.com') then
    raise exception 'FAIL 1: a per-run e2e signup is not treated as a test account';
  end if;
  if not public.is_test_account('formingpaws.qa+1@x.test') then
    raise exception 'FAIL 1: a QA account is not treated as a test account';
  end if;
  if public.is_test_account('someone@example.test') then
    raise exception 'FAIL 1: a real address is treated as a test account';
  end if;
  if public.is_test_account(null) then
    raise exception 'FAIL 1: null is treated as a test account';
  end if;
  if public.is_test_account('') then
    raise exception 'FAIL 1: an empty string is treated as a test account';
  end if;
  raise notice 'PASS 1: is_test_account truth table';
end $$;


-- ---------------------------------------------------------------------------
-- 2. A signed-in member without the admin role is refused with 42501.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'member'), 'role', 'authenticated')::text, true);

do $$
begin
  begin
    perform public.admin_dashboard_stats();
    raise exception 'FAIL 2: a non-admin member received dashboard stats';
  exception
    when insufficient_privilege then
      raise notice 'PASS 2: a non-admin member is refused with 42501';
  end;
end $$;


-- ---------------------------------------------------------------------------
-- 3 and 4. An admin receives every top-level key, and exactly 8 weeks ending
-- this week. Baseline numbers are captured for sections 5 to 7.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'admin'), 'role', 'authenticated')::text, true);

do $$
declare
  s jsonb := public.admin_dashboard_stats()::jsonb;
  key text;
begin
  foreach key in array array['meta', 'attention', 'funnel', 'signups_by_week', 'engagement'] loop
    if not s ? key then
      raise exception 'FAIL 3: top-level key % is missing', key;
    end if;
  end loop;

  if jsonb_array_length(s->'signups_by_week') <> 8 then
    raise exception 'FAIL 4: expected 8 weeks, got %', jsonb_array_length(s->'signups_by_week');
  end if;
  if (s->'signups_by_week'->7->>'week_start')::date <> date_trunc('week', now())::date then
    raise exception 'FAIL 4: the last week starts %, expected %',
      s->'signups_by_week'->7->>'week_start', date_trunc('week', now())::date;
  end if;

  insert into t_nums (k, n) values
    ('signed_up',    (s->'funnel'->>'signed_up')::bigint),
    ('excluded',     (s->'meta'->>'test_accounts_excluded')::bigint),
    ('docs_pending', (s->'attention'->>'docs_pending')::bigint),
    ('verified_dog', (s->'funnel'->>'verified_dog')::bigint);

  raise notice 'PASS 3-4: every key present, 8 weeks ending this week';
end $$;

reset role;


-- ---------------------------------------------------------------------------
-- Fixture changes, as the SQL superuser: one test signup, one real signup, and
-- a dog owned by the member with a verified vet exam, a verified vaccination
-- and one document still pending review.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       case k when 'test_signup' then 'e2e-test-0033@gmail.com'
              else 'real-signup-0033@example.test' end,
       'x', null, now(), now(), '{}'::jsonb,
       jsonb_build_object('display_name', k)
from t_ids
where k in ('test_signup', 'real_signup');

do $$
begin
  if not exists (select 1 from public.breeds) then
    raise exception 'FAIL: no breeds seeded; cannot build the dog fixture';
  end if;
end $$;

insert into public.dogs (id, owner_id, name, breed_id, sex, birth_date)
select (select v from t_ids where k = 'dog'),
       (select v from t_ids where k = 'member'),
       'Assertion 0033',
       (select id from public.breeds order by id limit 1),
       'female'::public.dog_sex,
       (current_date - interval '2 years')::date;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
values
  ((select v from t_ids where k = 'dog'), 'assertions/0033/vet-exam.pdf',
   'vet_exam'::public.health_doc_type, current_date - 30, 'verified'::public.health_doc_status),
  ((select v from t_ids where k = 'dog'), 'assertions/0033/vax.pdf',
   'vaccination'::public.health_doc_type, current_date - 30, 'verified'::public.health_doc_status),
  ((select v from t_ids where k = 'dog'), 'assertions/0033/ofa.pdf',
   'ofa'::public.health_doc_type, current_date - 10, 'pending_review'::public.health_doc_status);

-- Control for 7b: if the fixture dog is not baseline-verified, the verified_dog
-- delta below could only ever pass vacuously.
do $$
begin
  if not public.dog_is_baseline_verified((select v from t_ids where k = 'dog')) then
    raise exception 'FAIL 7b control: the fixture dog is not baseline-verified';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5, 6 and 7. Deltas against the baseline, read as the admin.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from t_ids where k = 'admin'), 'role', 'authenticated')::text, true);

do $$
declare
  s jsonb := public.admin_dashboard_stats()::jsonb;
  signed_up_delta bigint;
begin
  signed_up_delta := (s->'funnel'->>'signed_up')::bigint - (select n from t_nums where k = 'signed_up');
  if signed_up_delta <> 1 then
    raise exception 'FAIL 5-6: funnel.signed_up changed by %; expected +1 (one real and one test signup were added)',
      signed_up_delta;
  end if;

  if (s->'meta'->>'test_accounts_excluded')::bigint <> (select n from t_nums where k = 'excluded') + 1 then
    raise exception 'FAIL 5: meta.test_accounts_excluded did not increase by exactly 1';
  end if;

  if (s->'attention'->>'docs_pending')::bigint <> (select n from t_nums where k = 'docs_pending') + 1 then
    raise exception 'FAIL 7: attention.docs_pending did not increase by exactly 1';
  end if;

  if (s->'funnel'->>'verified_dog')::bigint <> (select n from t_nums where k = 'verified_dog') + 1 then
    raise exception 'FAIL 7b: funnel.verified_dog did not increase by exactly 1';
  end if;

  raise notice 'PASS 5-7: test signup excluded, real signup counted, pending doc and verified dog counted';
end $$;

reset role;


-- ---------------------------------------------------------------------------
-- 8. community_stats() still matches the rule it used before 0033.
--
-- Inside one transaction the old body is already gone, so "before and after"
-- is checked against the pre-0033 inline rule itself.
-- ---------------------------------------------------------------------------
do $$
declare
  cs jsonb := public.community_stats()::jsonb;
begin
  if (cs->>'members')::bigint <> (
    select count(*) from public.owners
    where coalesce(email, '') not like 'e2e-%' and coalesce(email, '') not like 'formingpaws.qa%'
  ) then
    raise exception 'FAIL 8: community_stats members differs from the pre-0033 rule';
  end if;

  if (cs->>'dogs')::bigint <> (
    select count(*) from public.dogs d join public.owners o on o.id = d.owner_id
    where coalesce(o.email, '') not like 'e2e-%' and coalesce(o.email, '') not like 'formingpaws.qa%'
      and d.removed_at is null
  ) then
    raise exception 'FAIL 8: community_stats dogs differs from the pre-0033 rule';
  end if;

  raise notice 'PASS 8: community_stats matches the pre-0033 rule';
end $$;

rollback;
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0033_admin_dashboard_stats.sql`:

```sql
-- supabase/migrations/0033_admin_dashboard_stats.sql
--
-- The admin console's home page, /admin, reads every figure through one
-- function. Spec: docs/superpowers/specs/2026-09-12-admin-dashboard-design.md
--
--   1. is_test_account(email): the single test-account rule.
--   2. community_stats() restated to use it. Its live definition was verified
--      identical to 0028's on 2026-09-12; re-read it before applying, because
--      `create or replace` silently discards anything added since.
--   3. admin_dashboard_stats(): admin-only aggregates. No names, emails or
--      message bodies ever leave it.
--
-- Why exclusion matters: on 2026-09-12, 37 of 50 accounts were e2e signups
-- written to production on every test run. Counted raw they made activation
-- look like a 74% leak; with them removed it was 85%.


-- 1 --------------------------------------------------------------------------
create or replace function public.is_test_account(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_email, '') like 'e2e-%'
      or coalesce(p_email, '') like 'formingpaws.qa%';
$$;

-- This project's default ACL grants EXECUTE on new functions directly to anon
-- (see 0029), and `revoke ... from public` does not remove a direct grant.
-- Security-definer callers run with their owner's privileges, so anon needs
-- no grant to benefit from this function inside community_stats().
revoke all on function public.is_test_account(text) from anon, public;
grant execute on function public.is_test_account(text) to authenticated;


-- 2 --------------------------------------------------------------------------
-- Output identical to 0028's body: only the two inline exclusion clauses are
-- replaced. `verified_dogs` never filtered test accounts and still does not.
-- `create or replace` keeps the existing anon + authenticated grants, which
-- are intentional: this backs public site figures.
create or replace function public.community_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'members', (select count(*) from public.owners where not public.is_test_account(email)),
    'dogs', (select count(*) from public.dogs d join public.owners o on o.id = d.owner_id
              where not public.is_test_account(o.email)
                and d.removed_at is null),
    'verified_dogs', (select count(*) from public.dogs d
                       where d.removed_at is null and public.dog_is_baseline_verified(d.id))
  );
$$;


-- 3 --------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  -- has_role reads auth.uid() from the request JWT, so it identifies the real
  -- caller even inside security definer; grant_role relies on the same thing.
  if not public.has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  with real_users as (
    select u.id, u.email_confirmed_at, u.last_sign_in_at, u.created_at
    from auth.users u
    where not public.is_test_account(u.email)
  ),
  real_dogs as (
    select d.id, d.owner_id, d.removed_at
    from public.dogs d
    where d.owner_id in (select id from real_users)
  ),
  live_dogs as (
    select id, owner_id from real_dogs where removed_at is null
  ),
  weeks as (
    select generate_series(
      date_trunc('week', now()) - interval '7 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) as week_start
  )
  select json_build_object(
    'meta', json_build_object(
      'generated_at', now(),
      'test_accounts_excluded', (select count(*) from auth.users u where public.is_test_account(u.email))
    ),

    -- Work queues. NOT filtered for test accounts: each count links to a page
    -- that lists every row, and the two must agree.
    'attention', json_build_object(
      'docs_pending', (select count(*) from public.health_documents where status = 'pending_review'),
      'oldest_pending_uploaded_at', (select min(uploaded_at) from public.health_documents where status = 'pending_review'),
      'reports_open', (select count(*) from public.match_reports where status in ('open', 'reviewing')),
      'contact_unhandled', (select count(*) from public.contact_messages where handled_at is null),
      'dogs_removed', (select count(*) from public.dogs where removed_at is not null)
    ),

    -- Each step is computed independently over real users, not chained.
    'funnel', json_build_object(
      'signed_up', (select count(*) from real_users),
      'confirmed', (select count(*) from real_users where email_confirmed_at is not null),
      'signed_in', (select count(*) from real_users where last_sign_in_at is not null),
      'added_dog', (select count(distinct owner_id) from live_dogs),
      'verified_dog', (select count(distinct ld.owner_id) from live_dogs ld
                        where public.dog_is_baseline_verified(ld.id)),
      'matched', (select count(distinct ld.owner_id) from live_dogs ld
                   where exists (select 1 from public.matches m
                                 where m.dog_a_id = ld.id or m.dog_b_id = ld.id))
    ),

    -- Zero-filled: a week with no signups is present with 0, never omitted.
    'signups_by_week', (
      select json_agg(
               json_build_object(
                 'week_start', w.week_start::date,
                 'signups', (select count(*) from real_users ru
                             where date_trunc('week', ru.created_at) = w.week_start))
               order by w.week_start)
      from weeks w
    ),

    'engagement', json_build_object(
      'interests', json_build_object(
        'total', (select count(*) from public.dog_interests di
                  where di.expressing_dog_id in (select id from real_dogs)),
        'last_30d', (select count(*) from public.dog_interests di
                     where di.expressing_dog_id in (select id from real_dogs)
                       and di.created_at > now() - interval '30 days')
      ),
      'matches', json_build_object(
        'total', (select count(*) from public.matches m
                  where m.dog_a_id in (select id from real_dogs) or m.dog_b_id in (select id from real_dogs)),
        'last_30d', (select count(*) from public.matches m
                     where (m.dog_a_id in (select id from real_dogs) or m.dog_b_id in (select id from real_dogs))
                       and m.matched_at > now() - interval '30 days')
      ),
      'messages', json_build_object(
        'total', (select count(*) from public.messages msg
                  where msg.sender_owner_id in (select id from real_users)),
        'last_30d', (select count(*) from public.messages msg
                     where msg.sender_owner_id in (select id from real_users)
                       and msg.created_at > now() - interval '30 days')
      ),
      'active_conversations', json_build_object(
        'last_30d', (select count(distinct msg.match_id) from public.messages msg
                     where msg.sender_owner_id in (select id from real_users)
                       and msg.created_at > now() - interval '30 days')
      ),
      'litters', json_build_object(
        'total', (select count(*) from public.litters l
                  where l.breeder_id in (select id from real_users)),
        'last_30d', (select count(*) from public.litters l
                     where l.breeder_id in (select id from real_users)
                       and l.created_at > now() - interval '30 days')
      ),
      'puppy_inquiries', json_build_object(
        'total', (select count(*) from public.puppy_inquiries pi
                  where pi.buyer_id is null or pi.buyer_id in (select id from real_users)),
        'last_30d', (select count(*) from public.puppy_inquiries pi
                     where (pi.buyer_id is null or pi.buyer_id in (select id from real_users))
                       and pi.created_at > now() - interval '30 days')
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from anon, public;
grant execute on function public.admin_dashboard_stats() to authenticated;
```

- [ ] **Step 4: Check the files statically**

Run:
```bash
grep -c "revoke all on function public.admin_dashboard_stats() from anon, public" supabase/migrations/0033_admin_dashboard_stats.sql
grep -c "revoke all on function public.is_test_account(text) from anon, public" supabase/migrations/0033_admin_dashboard_stats.sql
grep -c "raise exception 'admin role required' using errcode = '42501'" supabase/migrations/0033_admin_dashboard_stats.sql
grep -cE "^(begin|rollback);$" supabase/tests/0033_admin_dashboard_stats_assertions.sql
grep -c "grant select on t_ids to authenticated" supabase/tests/0033_admin_dashboard_stats_assertions.sql
```
Expected: `1`, `1`, `1`, `2`, `1`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0033_admin_dashboard_stats.sql supabase/tests/0033_admin_dashboard_stats_assertions.sql
git commit -m "$(printf 'Add admin_dashboard_stats and a shared is_test_account rule\n\nMigration 0033 and its rolled-back assertions. Not yet run against a\ndatabase; that happens, gated, before it is applied.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Dashboard types, helpers and the shared fixture

**Files:**
- Create: `lib/admin/dashboard.ts`
- Create: `tests/unit/fixtures/dashboard-stats.ts`
- Test: `tests/unit/admin-dashboard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Tally = { total: number; last_30d: number }`
  - `type DashboardStats` (shape below, identical to the SQL JSON)
  - `const FUNNEL_STEPS: readonly { key: FunnelKey; label: string }[]` in order `signed_up, confirmed, signed_in, added_dog, verified_dog, matched`
  - `type FunnelKey = 'signed_up' | 'confirmed' | 'signed_in' | 'added_dog' | 'verified_dog' | 'matched'`
  - `pct(part: number, whole: number): string`
  - `waitingFor(iso: string | null, now: Date): string`
  - `weekLabel(weekStart: string): string`
  - `generatedLabel(iso: string): string`
  - `barPercent(value: number, max: number): number`
  - `largestDrop(funnel: DashboardStats['funnel']): FunnelKey | null`
  - `STATS: DashboardStats` exported from `tests/unit/fixtures/dashboard-stats.ts`

- [ ] **Step 1: Write the shared fixture**

Create `tests/unit/fixtures/dashboard-stats.ts`:

```ts
import type { DashboardStats } from '@/lib/admin/dashboard'

/**
 * A plainly fake DashboardStats for component and page tests.
 *
 * Chosen so each assertion has something real to bite on: the documents queue
 * is non-empty with a known oldest upload, the reports queue is empty, the
 * funnel has a TIE for largest drop (10 -> 6 and 6 -> 2 both lose 4, and the
 * earlier step must win), the peak signup week is not the current week, and
 * the weekly signups sum to funnel.signed_up.
 */
export const STATS: DashboardStats = {
  meta: { generated_at: '2026-09-12T20:04:00Z', test_accounts_excluded: 37 },
  attention: {
    docs_pending: 4,
    oldest_pending_uploaded_at: '2026-09-09T12:00:00Z',
    reports_open: 0,
    contact_unhandled: 1,
    dogs_removed: 0,
  },
  funnel: { signed_up: 13, confirmed: 11, signed_in: 10, added_dog: 6, verified_dog: 2, matched: 1 },
  signups_by_week: [
    { week_start: '2026-07-20', signups: 1 },
    { week_start: '2026-07-27', signups: 0 },
    { week_start: '2026-08-03', signups: 1 },
    { week_start: '2026-08-10', signups: 2 },
    { week_start: '2026-08-17', signups: 5 },
    { week_start: '2026-08-24', signups: 1 },
    { week_start: '2026-08-31', signups: 2 },
    { week_start: '2026-09-07', signups: 1 },
  ],
  engagement: {
    interests: { total: 3, last_30d: 1 },
    matches: { total: 1, last_30d: 1 },
    messages: { total: 7, last_30d: 5 },
    active_conversations: { last_30d: 1 },
    litters: { total: 0, last_30d: 0 },
    puppy_inquiries: { total: 0, last_30d: 0 },
  },
}
```

- [ ] **Step 2: Write the failing helper tests**

Create `tests/unit/admin-dashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  FUNNEL_STEPS,
  barPercent,
  generatedLabel,
  largestDrop,
  pct,
  waitingFor,
  weekLabel,
} from '@/lib/admin/dashboard'
import { STATS } from './fixtures/dashboard-stats'

describe('pct', () => {
  it('rounds to a whole percent', () => {
    expect(pct(11, 13)).toBe('85%')
    expect(pct(13, 13)).toBe('100%')
    expect(pct(0, 13)).toBe('0%')
  })

  it('returns n/a instead of dividing by zero', () => {
    expect(pct(3, 0)).toBe('n/a')
  })
})

describe('waitingFor', () => {
  const now = new Date('2026-09-12T20:04:00Z')

  it('says nothing is waiting when there is no pending upload', () => {
    expect(waitingFor(null, now)).toBe('Nothing waiting')
  })

  it('says under a day for anything younger than 24 hours', () => {
    expect(waitingFor('2026-09-12T08:00:00Z', now)).toBe('Waiting under a day')
  })

  it('uses the singular for exactly one day', () => {
    expect(waitingFor('2026-09-11T08:00:00Z', now)).toBe('Waiting 1 day')
  })

  it('floors to whole days', () => {
    expect(waitingFor(STATS.attention.oldest_pending_uploaded_at, now)).toBe('Waiting 3 days')
  })
})

describe('weekLabel', () => {
  it('formats a week start as a short month and day, independent of server timezone', () => {
    expect(weekLabel('2026-09-07')).toBe('Sep 7')
    expect(weekLabel('2026-08-31')).toBe('Aug 31')
  })
})

describe('generatedLabel', () => {
  it('shows the generation time in Chicago, with ordinary spaces', () => {
    expect(generatedLabel('2026-09-12T20:04:00Z')).toBe('Sep 12, 3:04 PM CDT')
  })
})

describe('barPercent', () => {
  it('scales against the maximum', () => {
    expect(barPercent(5, 10)).toBe(50)
    expect(barPercent(10, 10)).toBe(100)
  })

  it('never returns NaN or a negative width', () => {
    expect(barPercent(5, 0)).toBe(0)
    expect(barPercent(0, 0)).toBe(0)
    expect(barPercent(-1, 10)).toBe(0)
  })

  it('never exceeds 100', () => {
    expect(barPercent(12, 10)).toBe(100)
  })
})

describe('largestDrop', () => {
  it('names the step where the most people were lost, earliest step on a tie', () => {
    // 10 -> 6 (added_dog) and 6 -> 2 (verified_dog) both lose 4.
    expect(largestDrop(STATS.funnel)).toBe('added_dog')
  })

  it('returns null when nobody is lost anywhere', () => {
    expect(
      largestDrop({ signed_up: 2, confirmed: 2, signed_in: 2, added_dog: 2, verified_dog: 2, matched: 2 }),
    ).toBeNull()
  })
})

describe('FUNNEL_STEPS', () => {
  it('lists the six steps in journey order', () => {
    expect(FUNNEL_STEPS.map((s) => s.key)).toEqual([
      'signed_up',
      'confirmed',
      'signed_in',
      'added_dog',
      'verified_dog',
      'matched',
    ])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/admin-dashboard.test.ts`
Expected: FAIL, with an error that `@/lib/admin/dashboard` cannot be resolved.

- [ ] **Step 4: Write the implementation**

Create `lib/admin/dashboard.ts`:

```ts
/**
 * The admin overview's data shape and its formatting helpers.
 *
 * DashboardStats mirrors the JSON returned by public.admin_dashboard_stats()
 * (migration 0033) key for key. Everything here is pure: no I/O, no clock
 * reads except the `now` a caller passes in, so every helper is testable.
 */

export type Tally = { total: number; last_30d: number }

export type DashboardStats = {
  meta: { generated_at: string; test_accounts_excluded: number }
  attention: {
    docs_pending: number
    oldest_pending_uploaded_at: string | null
    reports_open: number
    contact_unhandled: number
    dogs_removed: number
  }
  funnel: {
    signed_up: number
    confirmed: number
    signed_in: number
    added_dog: number
    verified_dog: number
    matched: number
  }
  signups_by_week: { week_start: string; signups: number }[]
  engagement: {
    interests: Tally
    matches: Tally
    messages: Tally
    active_conversations: { last_30d: number }
    litters: Tally
    puppy_inquiries: Tally
  }
}

export type FunnelKey = keyof DashboardStats['funnel']

export const FUNNEL_STEPS: readonly { key: FunnelKey; label: string }[] = [
  { key: 'signed_up', label: 'Signed up' },
  { key: 'confirmed', label: 'Confirmed email' },
  { key: 'signed_in', label: 'Signed in' },
  { key: 'added_dog', label: 'Added a dog' },
  { key: 'verified_dog', label: 'Has a verified dog' },
  { key: 'matched', label: 'Matched' },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole-number percent. `n/a`, never an em dash: rendered copy on this site has none. */
export function pct(part: number, whole: number): string {
  if (whole === 0) return 'n/a'
  return `${Math.round((part / whole) * 100)}%`
}

export function waitingFor(iso: string | null, now: Date): string {
  if (iso === null) return 'Nothing waiting'
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
  if (days < 1) return 'Waiting under a day'
  return days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`
}

/**
 * `week_start` is a calendar date. Parsed and formatted in UTC so the label
 * never slips a day depending on the server's timezone.
 */
export function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Chicago, because that is where the platform's members are (the same anchor
 * #66 uses for birth dates). Recent ICU versions put a U+202F narrow no-break
 * space before AM/PM; it is normalised so copy and tests see ordinary spaces.
 */
export function generatedLabel(iso: string): string {
  return new Date(iso)
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short',
    })
    .replace(/ /g, ' ')
}

/** 0 to 100 for a CSS width or height. Never NaN, never negative, never over 100. */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.min(100, (value / max) * 100)
}

/** The step where the most people were lost. Earliest step wins a tie. */
export function largestDrop(funnel: DashboardStats['funnel']): FunnelKey | null {
  let best: FunnelKey | null = null
  let bestDrop = 0
  for (let i = 1; i < FUNNEL_STEPS.length; i++) {
    const drop = funnel[FUNNEL_STEPS[i - 1].key] - funnel[FUNNEL_STEPS[i].key]
    if (drop > bestDrop) {
      bestDrop = drop
      best = FUNNEL_STEPS[i].key
    }
  }
  return best
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/admin-dashboard.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/dashboard.ts tests/unit/fixtures/dashboard-stats.ts tests/unit/admin-dashboard.test.ts
git commit -m "$(printf 'Add dashboard stats types and formatting helpers\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Funnel table and signup columns

**Files:**
- Create: `components/admin/FunnelTable.tsx`
- Create: `components/admin/SignupColumns.tsx`
- Test: `tests/unit/admin-dashboard-charts.test.tsx`

**Interfaces:**
- Consumes (Task 2): `DashboardStats`, `FUNNEL_STEPS`, `barPercent`, `largestDrop`, `pct`, `weekLabel`, and `STATS` from the fixture.
- Produces:
  - `export default function FunnelTable({ funnel }: { funnel: DashboardStats['funnel'] })`
  - `export default function SignupColumns({ weeks }: { weeks: DashboardStats['signups_by_week'] })`
  - Test ids relied on by Task 4: none. Task 4 only checks section headings.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/admin-dashboard-charts.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import FunnelTable from '@/components/admin/FunnelTable'
import SignupColumns from '@/components/admin/SignupColumns'
import { STATS } from './fixtures/dashboard-stats'

describe('FunnelTable', () => {
  it('is a real table with six step rows in journey order', () => {
    render(<FunnelTable funnel={STATS.funnel} />)
    const table = screen.getByRole('table', { name: /activation funnel/i })
    const rowHeaders = within(table).getAllByRole('rowheader')
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      'Signed up',
      'Confirmed email',
      'Signed in',
      'Added a dogLargest drop',
      'Has a verified dog',
      'Matched',
    ])
  })

  it('shows each count and its share of the previous step', () => {
    render(<FunnelTable funnel={STATS.funnel} />)
    const confirmedRow = screen.getByRole('rowheader', { name: 'Confirmed email' }).closest('tr')!
    expect(within(confirmedRow).getByText('11')).toBeInTheDocument()
    expect(within(confirmedRow).getByText('85%')).toBeInTheDocument()
  })

  it('shows n/a rather than dividing by a zero previous step', () => {
    render(
      <FunnelTable
        funnel={{ signed_up: 0, confirmed: 0, signed_in: 0, added_dog: 0, verified_dog: 0, matched: 0 }}
      />,
    )
    const confirmedRow = screen.getByRole('rowheader', { name: 'Confirmed email' }).closest('tr')!
    expect(within(confirmedRow).getByText('n/a')).toBeInTheDocument()
  })

  it('sizes each bar as a share of sign-ups', () => {
    render(<FunnelTable funnel={STATS.funnel} />)
    const bars = screen.getAllByTestId('funnel-bar')
    expect(bars).toHaveLength(6)
    expect(bars[0]).toHaveStyle({ width: '100%' })
    expect(bars[5].style.width).toBe(`${(1 / 13) * 100}%`)
  })
})

describe('SignupColumns', () => {
  it('renders eight keyboard-focusable columns, each named with its week and count', () => {
    render(<SignupColumns weeks={STATS.signups_by_week} />)
    const columns = screen.getAllByTestId('signup-column')
    expect(columns).toHaveLength(8)
    for (const column of columns) expect(column).toHaveAttribute('tabindex', '0')
    expect(columns[4]).toHaveAccessibleName('Week of Aug 17: 5 signups')
    expect(columns[7]).toHaveAccessibleName('Week of Sep 7: 1 signup')
  })

  it('labels only the current week and the peak week on the cap', () => {
    render(<SignupColumns weeks={STATS.signups_by_week} />)
    const caps = screen.getAllByTestId('cap-label')
    expect(caps.map((c) => c.textContent)).toEqual(['5', '1'])
  })

  it('still labels the current week when every week is zero, and draws no peak', () => {
    const empty = STATS.signups_by_week.map((w) => ({ ...w, signups: 0 }))
    render(<SignupColumns weeks={empty} />)
    expect(screen.getAllByTestId('cap-label').map((c) => c.textContent)).toEqual(['0'])
  })

  it('has a table twin listing every week with its count', () => {
    render(<SignupColumns weeks={STATS.signups_by_week} />)
    const table = screen.getByRole('table', { name: /signups per week/i, hidden: true })
    const rows = within(table).getAllByRole('row', { hidden: true }).slice(1)
    expect(rows).toHaveLength(8)
    expect(within(rows[1]).getByText('Jul 27')).toBeInTheDocument()
    expect(within(rows[1]).getByText('0')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/admin-dashboard-charts.test.tsx`
Expected: FAIL, with errors that `@/components/admin/FunnelTable` and `@/components/admin/SignupColumns` cannot be resolved.

- [ ] **Step 3: Write `FunnelTable`**

Create `components/admin/FunnelTable.tsx`:

```tsx
import {
  FUNNEL_STEPS,
  barPercent,
  largestDrop,
  pct,
  type DashboardStats,
} from '@/lib/admin/dashboard'

/**
 * The activation funnel as a real table.
 *
 * The table is the chart: every value is visible as text in its own cell, so
 * the dataviz rule that every chart has a table view is met by construction,
 * and the bars only add shape. One series, so no legend; the section heading
 * names it. Bars are 12px thick with a 4px rounded data-end and a square end
 * at the baseline. Rows lift on hover; no value is hidden behind the hover.
 */
export default function FunnelTable({ funnel }: { funnel: DashboardStats['funnel'] }) {
  const drop = largestDrop(funnel)

  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <caption className="sr-only">Activation funnel, real members only</caption>
      <thead>
        <tr>
          <th scope="col" className="fp-meta pb-2 text-left font-normal">
            Step
          </th>
          <th scope="col" className="fp-meta pb-2 pr-4 text-right font-normal">
            People
          </th>
          <th scope="col" className="fp-meta pb-2 pr-4 text-right font-normal">
            Of previous
          </th>
          <th scope="col" className="pb-2">
            <span className="sr-only">Share of sign-ups</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {FUNNEL_STEPS.map((step, i) => {
          const value = funnel[step.key]
          const previous = i === 0 ? null : funnel[FUNNEL_STEPS[i - 1].key]
          return (
            <tr key={step.key} className="border-t border-hairline hover:bg-wash">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">
                {step.label}
                {drop === step.key ? <span className="ml-2 text-ink-soft">Largest drop</span> : null}
              </th>
              <td className="py-2 pr-4 text-right tabular-nums text-ink">{value}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">
                {previous === null ? '' : pct(value, previous)}
              </td>
              <td className="w-2/5 py-2">
                <div
                  data-testid="funnel-bar"
                  aria-hidden="true"
                  className="h-3 rounded-r bg-brand"
                  style={{ width: `${barPercent(value, funnel.signed_up)}%` }}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Write `SignupColumns`**

Create `components/admin/SignupColumns.tsx`:

```tsx
import { barPercent, weekLabel, type DashboardStats } from '@/lib/admin/dashboard'

/**
 * Weekly signups as eight columns, with a table twin.
 *
 * Columns rather than a line: these are discrete weekly counts where an empty
 * week matters, and an empty column reads as zero more plainly than a point.
 *
 * Dataviz rules applied: columns at most 24px wide (max-w-6), a 4px rounded
 * data-end on top and a square baseline, a 2px surface gap between columns
 * (gap-0.5), one series so no legend. Labels are selective: only the current
 * week and the peak week carry a cap label. Every column is focusable, and its
 * tooltip shows on hover AND focus. The hit area is the whole column slot, at
 * least 24px wide, not just the painted bar. The `<details>` table is the twin
 * that makes every value reachable without hovering.
 */
export default function SignupColumns({ weeks }: { weeks: DashboardStats['signups_by_week'] }) {
  const max = Math.max(0, ...weeks.map((w) => w.signups))
  const lastIndex = weeks.length - 1
  const peakIndex = max > 0 ? weeks.findIndex((w) => w.signups === max) : -1

  return (
    <div className="mt-4">
      <ol aria-label="Signups per week, last 8 weeks" className="flex h-40 items-end gap-0.5 pt-6">
        {weeks.map((week, i) => {
          const summary = `Week of ${weekLabel(week.week_start)}: ${week.signups} ${
            week.signups === 1 ? 'signup' : 'signups'
          }`
          const labelled = i === lastIndex || i === peakIndex
          return (
            <li
              key={week.week_start}
              data-testid="signup-column"
              tabIndex={0}
              aria-label={summary}
              className="group relative flex h-full min-w-6 flex-1 items-end justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-ivory group-hover:block group-focus-visible:block"
              >
                {summary}
              </span>
              <div
                aria-hidden="true"
                className="relative w-full max-w-6 rounded-t bg-brand group-hover:opacity-80 group-focus-visible:opacity-80"
                style={{ height: `${barPercent(week.signups, max)}%` }}
              >
                {labelled ? (
                  <span
                    data-testid="cap-label"
                    className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs tabular-nums text-ink"
                  >
                    {week.signups}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <ol aria-hidden="true" className="mt-1 flex gap-0.5">
        {weeks.map((week) => (
          <li key={week.week_start} className="min-w-6 flex-1 text-center text-xs text-ink-soft">
            {weekLabel(week.week_start)}
          </li>
        ))}
      </ol>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-soft">Show as table</summary>
        <table className="mt-2 w-full border-collapse">
          <caption className="sr-only">Signups per week</caption>
          <thead>
            <tr>
              <th scope="col" className="fp-meta pb-1 text-left font-normal">
                Week of
              </th>
              <th scope="col" className="fp-meta pb-1 text-right font-normal">
                Signups
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.week_start} className="border-t border-hairline">
                <td className="py-1 text-ink">{weekLabel(week.week_start)}</td>
                <td className="py-1 text-right tabular-nums text-ink">{week.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/admin-dashboard-charts.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add components/admin/FunnelTable.tsx components/admin/SignupColumns.tsx tests/unit/admin-dashboard-charts.test.tsx
git commit -m "$(printf 'Add the funnel table and weekly signup columns\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: DashboardView

**Files:**
- Create: `components/admin/DashboardView.tsx`
- Test: `tests/unit/admin-dashboard-view.test.tsx`

**Interfaces:**
- Consumes (Task 2): `DashboardStats`, `waitingFor`, `generatedLabel`, `STATS`. (Task 3): default exports `FunnelTable`, `SignupColumns`. Existing: `RecordLine` from `@/components/record/RecordLine` (props `status?`, `label`, `value?`, `className?`, `markLabel?`); `Mark` from `@/components/record/Mark` (props `status`, `className?`, `label?`).
- Produces: `export default function DashboardView({ stats, now }: { stats: DashboardStats | null; now: Date })`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/admin-dashboard-view.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import DashboardView from '@/components/admin/DashboardView'
import { STATS } from './fixtures/dashboard-stats'

const now = new Date('2026-09-12T20:04:00Z')

describe('DashboardView', () => {
  it('states when figures were generated and how many test accounts were excluded', () => {
    render(<DashboardView stats={STATS} now={now} />)
    expect(screen.getByText('Sep 12, 3:04 PM CDT')).toBeInTheDocument()
    expect(screen.getByText('37')).toBeInTheDocument()
  })

  it('links each queue to the page that works it', () => {
    render(<DashboardView stats={STATS} now={now} />)
    expect(screen.getByRole('link', { name: 'Documents to review' })).toHaveAttribute('href', '/admin/review-queue')
    expect(screen.getByRole('link', { name: 'Open reports' })).toHaveAttribute('href', '/admin/reports')
    expect(screen.getByRole('link', { name: 'Unhandled contact messages' })).toHaveAttribute('href', '/admin/messages')
    expect(screen.getByRole('link', { name: 'Removed dogs' })).toHaveAttribute('href', '/admin/dogs')
  })

  it('shows a non-empty queue with its count and how long the oldest item has waited', () => {
    render(<DashboardView stats={STATS} now={now} />)
    const docsRow = screen.getByRole('link', { name: 'Documents to review' }).closest('li')!
    expect(within(docsRow).getByText('4')).toBeInTheDocument()
    expect(within(docsRow).getByText('Waiting 3 days')).toBeInTheDocument()
  })

  it('shows an empty work queue as nothing waiting, and no removed dogs as none removed', () => {
    render(<DashboardView stats={STATS} now={now} />)
    const reportsRow = screen.getByRole('link', { name: 'Open reports' }).closest('li')!
    expect(within(reportsRow).getByText('Nothing waiting')).toBeInTheDocument()
    const removedRow = screen.getByRole('link', { name: 'Removed dogs' }).closest('li')!
    expect(within(removedRow).getByText('None removed')).toBeInTheDocument()
  })

  it('renders every section heading', () => {
    render(<DashboardView stats={STATS} now={now} />)
    for (const name of ['Needs attention', 'Activation funnel', 'Signups, last 8 weeks', 'Engagement']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('shows engagement for the last 30 days and all time, with n/a where there is no total', () => {
    render(<DashboardView stats={STATS} now={now} />)
    const table = screen.getByRole('table', { name: /engagement/i })
    const messagesRow = within(table).getByRole('rowheader', { name: 'Messages' }).closest('tr')!
    expect(within(messagesRow).getByText('5')).toBeInTheDocument()
    expect(within(messagesRow).getByText('7')).toBeInTheDocument()
    const activeRow = within(table).getByRole('rowheader', { name: 'Active conversations' }).closest('tr')!
    expect(within(activeRow).getByText('n/a')).toBeInTheDocument()
  })

  it('shows a single failure record and no numbers when figures could not be loaded', () => {
    render(<DashboardView stats={null} now={now} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load figures")
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).toBeNull()
    expect(screen.queryByText('13')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/admin-dashboard-view.test.tsx`
Expected: FAIL, with an error that `@/components/admin/DashboardView` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `components/admin/DashboardView.tsx`:

```tsx
import Link from 'next/link'
import RecordLine from '@/components/record/RecordLine'
import Mark from '@/components/record/Mark'
import FunnelTable from './FunnelTable'
import SignupColumns from './SignupColumns'
import { generatedLabel, waitingFor, type DashboardStats } from '@/lib/admin/dashboard'

type Queue = {
  key: string
  label: string
  href: string
  count: number
  /** Shown beside a non-zero count. */
  detail?: string
  /** Shown instead of a bare 0. */
  zeroText: string
}

/**
 * The admin overview, from an already-loaded DashboardStats.
 *
 * Presentational only, so it can be tested without a database. Needs attention
 * comes first because it is the part an admin acts on. Those counts are not
 * filtered for test accounts (see migration 0033), so they always match the
 * page each one links to.
 */
export default function DashboardView({ stats, now }: { stats: DashboardStats | null; now: Date }) {
  if (!stats) {
    return (
      <div role="alert" className="mt-6 border-y border-hairline py-5">
        <RecordLine status="none" label="Figures" value="Couldn't load figures" />
      </div>
    )
  }

  const { attention: a, engagement: e } = stats

  const queues: Queue[] = [
    {
      key: 'docs',
      label: 'Documents to review',
      href: '/admin/review-queue',
      count: a.docs_pending,
      detail: waitingFor(a.oldest_pending_uploaded_at, now),
      zeroText: 'Nothing waiting',
    },
    { key: 'reports', label: 'Open reports', href: '/admin/reports', count: a.reports_open, zeroText: 'Nothing waiting' },
    {
      key: 'contact',
      label: 'Unhandled contact messages',
      href: '/admin/messages',
      count: a.contact_unhandled,
      zeroText: 'Nothing waiting',
    },
    { key: 'removed', label: 'Removed dogs', href: '/admin/dogs', count: a.dogs_removed, zeroText: 'None removed' },
  ]

  const engagement: { label: string; last30: number; total: number | null }[] = [
    { label: 'Interest sent', last30: e.interests.last_30d, total: e.interests.total },
    { label: 'Matches', last30: e.matches.last_30d, total: e.matches.total },
    { label: 'Messages', last30: e.messages.last_30d, total: e.messages.total },
    { label: 'Active conversations', last30: e.active_conversations.last_30d, total: null },
    { label: 'Litters listed', last30: e.litters.last_30d, total: e.litters.total },
    { label: 'Puppy inquiries', last30: e.puppy_inquiries.last_30d, total: e.puppy_inquiries.total },
  ]

  return (
    <div className="mt-6">
      <div className="grid gap-x-8 gap-y-2 border-y border-hairline py-4 sm:grid-cols-2">
        <RecordLine label="Generated" value={generatedLabel(stats.meta.generated_at)} />
        <RecordLine label="Test accounts excluded" value={String(stats.meta.test_accounts_excluded)} />
      </div>

      <section aria-labelledby="attention-h" className="mt-10">
        <h2 id="attention-h" className="fp-h3">
          Needs attention
        </h2>
        <ul className="mt-4">
          {queues.map((q) => (
            <li key={q.key} className="fp-row flex items-baseline justify-between gap-4">
              <Link href={q.href} className="fp-link">
                {q.label}
              </Link>
              {q.count === 0 ? (
                <span className="flex items-baseline gap-2 text-sm text-ink-soft">
                  <Mark status="verified" label="Clear" />
                  {q.zeroText}
                </span>
              ) : (
                <span className="text-right">
                  <span className="tabular-nums text-ink">{q.count}</span>
                  {q.detail ? <span className="ml-3 text-sm text-ink-soft">{q.detail}</span> : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="funnel-h" className="mt-10">
        <h2 id="funnel-h" className="fp-h3">
          Activation funnel
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Real members only. Each step counts people, not events.</p>
        <FunnelTable funnel={stats.funnel} />
      </section>

      <section aria-labelledby="signups-h" className="mt-10">
        <h2 id="signups-h" className="fp-h3">
          Signups, last 8 weeks
        </h2>
        <SignupColumns weeks={stats.signups_by_week} />
      </section>

      <section aria-labelledby="engagement-h" className="mt-10">
        <h2 id="engagement-h" className="fp-h3">
          Engagement
        </h2>
        <table className="mt-4 w-full border-collapse text-sm">
          <caption className="sr-only">Engagement, real members only</caption>
          <thead>
            <tr>
              <th scope="col" className="fp-meta pb-2 text-left font-normal">
                Activity
              </th>
              <th scope="col" className="fp-meta pb-2 text-right font-normal">
                Last 30 days
              </th>
              <th scope="col" className="fp-meta pb-2 text-right font-normal">
                All time
              </th>
            </tr>
          </thead>
          <tbody>
            {engagement.map((row) => (
              <tr key={row.label} className="border-t border-hairline">
                <th scope="row" className="py-2 text-left font-normal text-ink">
                  {row.label}
                </th>
                <td className="py-2 text-right tabular-nums text-ink">{row.last30}</td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {row.total === null ? 'n/a' : row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/admin-dashboard-view.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/DashboardView.tsx tests/unit/admin-dashboard-view.test.tsx
git commit -m "$(printf 'Add the admin overview view\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: The `/admin` page and nav entry

**Files:**
- Create: `app/admin/page.tsx`
- Modify: `app/admin/layout.tsx` (the `NAV` array)
- Test: `tests/unit/admin-overview-page.test.tsx`

**Interfaces:**
- Consumes (Task 2): `DashboardStats`, `STATS`. (Task 4): default export `DashboardView`. Existing: `requireRole(role: string)` from `@/lib/auth/roles` (calls `supabase.auth.getUser()`, then `supabase.rpc('has_any_role', { role_names })`, and `redirect('/login')` or `redirect('/home')`); `createClient()` from `@/lib/supabase/server`; `pageMetadata({ title, description, path, index })` from `@/lib/seo`.
- Produces: `export default async function AdminOverviewPage()`; `export const metadata`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/admin-overview-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { STATS } from './fixtures/dashboard-stats'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  isAdmin: true,
  rpcResult: { data: null as unknown, error: null as { message: string } | null },
  rpcCalls: [] as string[],
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mocks.redirect(path)
    throw new Error('NEXT_REDIRECT')
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    rpc: async (fn: string) => {
      mocks.rpcCalls.push(fn)
      if (fn === 'has_any_role') return { data: mocks.isAdmin, error: null }
      if (fn === 'admin_dashboard_stats') return mocks.rpcResult
      throw new Error(`unexpected rpc ${fn}`)
    },
  }),
}))

import AdminOverviewPage from '@/app/admin/page'

beforeEach(() => {
  mocks.redirect.mockClear()
  mocks.isAdmin = true
  mocks.rpcResult = { data: STATS, error: null }
  mocks.rpcCalls = []
})

describe('/admin overview page', () => {
  it('renders the dashboard for an admin from a single stats call', async () => {
    render(await AdminOverviewPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument()
    expect(mocks.rpcCalls.filter((fn) => fn === 'admin_dashboard_stats')).toHaveLength(1)
  })

  it('sends a signed-in non-admin home without ever asking for stats', async () => {
    mocks.isAdmin = false
    await expect(AdminOverviewPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/home')
    expect(mocks.rpcCalls).not.toContain('admin_dashboard_stats')
  })

  it('shows the failure record, and logs the error, when the stats call fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rpcResult = { data: null, error: { message: 'boom' } }
    render(await AdminOverviewPage())
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load figures")
    expect(log).toHaveBeenCalledWith('admin_dashboard_stats failed:', 'boom')
    log.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/admin-overview-page.test.tsx`
Expected: FAIL, with an error that `@/app/admin/page` cannot be resolved.

- [ ] **Step 3: Write the page**

Create `app/admin/page.tsx`:

```tsx
import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { pageMetadata } from '@/lib/seo'
import DashboardView from '@/components/admin/DashboardView'
import type { DashboardStats } from '@/lib/admin/dashboard'

export const metadata = pageMetadata({
  title: 'Overview',
  description: 'Where the platform stands and what needs doing.',
  path: '/admin',
  index: false,
})

/**
 * The admin console's home.
 *
 * The role is enforced three times: by the admin layout, here, and inside
 * admin_dashboard_stats() itself, so a route reached outside the layout is
 * still protected and a direct RPC call is refused by the database.
 */
export default async function AdminOverviewPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) console.error('admin_dashboard_stats failed:', error.message)
  const stats = error || !data ? null : (data as DashboardStats)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Overview</h1>
      <DashboardView stats={stats} now={new Date()} />
    </main>
  )
}
```

- [ ] **Step 4: Add the nav entry**

In `app/admin/layout.tsx`, replace:

```tsx
const NAV = [
  { href: '/admin/users', label: 'Users' },
```

with:

```tsx
const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/admin-overview-page.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx app/admin/layout.tsx tests/unit/admin-overview-page.test.tsx
git commit -m "$(printf 'Give the admin console a home at /admin\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: Local verification gates

Nothing here touches production.

**Files:** none created. If a gate fails, fix it in the task that owns the file and re-run this task from Step 1.

**Interfaces:**
- Consumes: everything from Tasks 1 to 5.
- Produces: a branch that has passed every gate.

- [ ] **Step 1: Clear stale servers**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; lsof -ti:3100 | xargs kill -9 2>/dev/null; echo cleared`
Expected: `cleared`

- [ ] **Step 2: Types and lint**

Run: `npx tsc --noEmit && echo TSC_OK && npm run lint`
Expected: `TSC_OK`, then eslint exits with no errors.

- [ ] **Step 3: Full unit suite**

Run: `npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: every test file passes. The count is the previous total plus 32 (14 + 8 + 7 + 3).

- [ ] **Step 4: Production build**

Run: `rm -rf .next && npm run build 2>&1 | grep -E "✓ Compiled|✓ Generating|/admin |Error"`
Expected: `✓ Compiled successfully`, `✓ Generating static pages`, a line for `ƒ /admin`, and no `Error`.

- [ ] **Step 5: Signed-out gate and public-site sweep**

Run:
```bash
(PORT=3100 npm start > /tmp/prod.log 2>&1 &); sleep 9
curl -s -o /dev/null -w "/admin %{http_code}\n" http://localhost:3100/admin
node scripts/verify-open-file.mjs 2>&1 | tail -1
```
Expected: `/admin 307`, then `55/55 page+width combinations passed.` (or whatever total the sweep currently reports, all passing).

- [ ] **Step 6: E2E against a same-day baseline**

Run the branch, then current `main` in a throwaway worktree, so the comparison is like for like:
```bash
lsof -ti:3100 | xargs kill -9 2>/dev/null; lsof -ti:3000 | xargs kill -9 2>/dev/null
npx playwright test --reporter=list > /tmp/e2e-branch.txt 2>&1; grep -E "passed|failed" /tmp/e2e-branch.txt | tail -2
git worktree add --detach /tmp/fp-e2e-base origin/main
ln -s "$PWD/node_modules" /tmp/fp-e2e-base/node_modules && cp .env.local /tmp/fp-e2e-base/
(cd /tmp/fp-e2e-base && npx playwright test --reporter=list > /tmp/e2e-base.txt 2>&1); grep -E "passed|failed" /tmp/e2e-base.txt | tail -2
rm /tmp/fp-e2e-base/node_modules && git worktree remove --force /tmp/fp-e2e-base
grep "✘" /tmp/e2e-branch.txt; echo ---; grep "✘" /tmp/e2e-base.txt
```
Expected: the set of failing specs on the branch is the same as, or a subset of, the set on `main`. If the branch has an extra failure, run that spec alone 3 times (`npx playwright test <spec>:<line> --reporter=line`). `navigation-chrome.spec.ts:31` is a known parallel-auth flake that passes in isolation. Any other extra failure is a regression to fix before continuing.

- [ ] **Step 7: Rebuild after e2e**

Playwright's `next dev` overwrote `.next`, so any later production check needs a fresh build.

Run: `rm -rf .next && npm run build 2>&1 | grep -E "✓ Compiled|Error"`
Expected: `✓ Compiled successfully`.

---

### Task 7: Production rollout (gated)

Every step that touches the production database or deploys is preceded by a **STOP**. Do not continue past a STOP without an explicit yes from Stefan in the conversation. Project id: `wyzcnkdonbdykidmcxvx`.

**Files:** none created locally.

**Interfaces:**
- Consumes: the migration and assertions from Task 1; the verified branch from Task 6.
- Produces: `0033` live in production, and `feat/admin-dashboard` merged and deployed.

- [ ] **Step 1: STOP. Ask for a rolled-back dry run on production**

Ask Stefan: "May I run migration 0033 plus its assertions against production inside a transaction that rolls back? Nothing will persist, and I'll prove that afterwards."

- [ ] **Step 2: Re-read the live `community_stats` and record its current output**

Run with the Supabase `execute_sql` tool:
```sql
select pg_get_functiondef('public.community_stats()'::regprocedure) as definition,
       public.community_stats() as output;
```
Expected: the body is exactly the 0028 body (inline `not like 'e2e-%'` / `not like 'formingpaws.qa%'` clauses on `members` and `dogs`, unfiltered `verified_dogs`). If it differs in any other way, stop and report the difference. Record `output` for Step 9.

- [ ] **Step 3: Build the dry-run script**

Run:
```bash
python3 - <<'PY'
mig = open('supabase/migrations/0033_admin_dashboard_stats.sql').read()
tests = open('supabase/tests/0033_admin_dashboard_stats_assertions.sql').read()
body = '\n'.join(l for l in tests.splitlines() if l.strip() not in ('begin;', 'rollback;'))
open('/tmp/0033-dryrun.sql', 'w').write('begin;\n' + mig + '\n' + body + '\nrollback;\n')
open('/tmp/0033-negative.sql', 'w').write(
    ('begin;\n' + mig + '\n' + body + '\nrollback;\n').replace(
        "jsonb_array_length(s->'signups_by_week') <> 8", "jsonb_array_length(s->'signups_by_week') <> 9"))
print('written')
PY
grep -c "<> 9" /tmp/0033-negative.sql
```
Expected: `written`, then `1`.

- [ ] **Step 4: Run the dry run**

Run `execute_sql` with the full contents of `/tmp/0033-dryrun.sql`.
Expected: success, with no error. Any `FAIL` exception is a real failure: stop and fix the migration or the assertions in Task 1.

- [ ] **Step 5: Run the negative control**

Run `execute_sql` with the full contents of `/tmp/0033-negative.sql`.
Expected: an error whose message contains `FAIL 4: expected 8 weeks`. If this succeeds instead, the harness is not reporting failures and Step 4's success means nothing: stop and investigate.

- [ ] **Step 6: Prove the dry runs left nothing behind**

Run with `execute_sql`:
```sql
select to_regprocedure('public.admin_dashboard_stats()') as dashboard_fn,
       to_regprocedure('public.is_test_account(text)') as helper_fn;
```
Expected: both `null`. If either is not null, the transaction did not roll back: report it to Stefan immediately, before doing anything else.

- [ ] **Step 7: STOP. Ask to apply 0033 to production**

Ask Stefan: "The dry run passed, the negative control failed as it should, and nothing persisted. May I apply migration 0033 to production?"

- [ ] **Step 8: Apply and re-assert**

Apply with the Supabase `apply_migration` tool, name `admin_dashboard_stats`, query = the full contents of `supabase/migrations/0033_admin_dashboard_stats.sql`.

Then run `execute_sql` with the full contents of `supabase/tests/0033_admin_dashboard_stats_assertions.sql` (it has its own `begin` and `rollback`).
Expected: the migration applies without error, then the assertions succeed.

- [ ] **Step 9: Probe by behaviour**

Run:
```bash
URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2- | tr -d '"')
ANON=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2- | tr -d '"')
printf '%s\n' admin_dashboard_stats is_test_account | while IFS= read -r fn; do
  printf "%-24s %s\n" "$fn" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/rest/v1/rpc/$fn" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{}')"
done
curl -s -X POST "$URL/rest/v1/rpc/community_stats" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{}'; echo
```
Expected: both functions return `404` or `401`. `community_stats` returns the same JSON recorded in Step 2.

Then run `get_advisors` with type `security`.
Expected: no ERROR-level finding that was not already present (the pre-existing ones are `dogs_browsable` security definer view and `spatial_ref_sys` RLS).

- [ ] **Step 10: STOP. Ask to merge and deploy**

Ask Stefan: "0033 is live and verified. May I merge feat/admin-dashboard to main and deploy?"

- [ ] **Step 11: Merge, push and verify the deploy**

Run:
```bash
git fetch origin --quiet
git merge-base --is-ancestor origin/main HEAD && echo FAST_FORWARD || echo MAIN_MOVED
```
If `MAIN_MOVED`, run `git merge --no-edit origin/main`, then repeat Task 6 Steps 2 to 4 before pushing.

Then:
```bash
git push origin HEAD:main
until curl -s -o /dev/null -w "%{http_code}" https://theplugai.xyz/admin | grep -q 307; do sleep 15; done
curl -s -o /dev/null -w "live /admin %{http_code}\n" https://theplugai.xyz/admin
node scripts/verify-open-file.mjs https://theplugai.xyz 2>&1 | tail -1
```
Expected: the push succeeds, `live /admin 307`, and the sweep passes against production.
