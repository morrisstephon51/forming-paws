# Admin dashboard — design

**Date:** 2026-09-12
**Status:** approved in conversation, awaiting written-spec review
**Branch:** `feat/admin-dashboard` (off `origin/main` at `0e9a1ce`)

---

## 1. Why

The admin console has six working pages (users, dogs, review queue, reports,
messages, audit log) and no home. Nothing tells an admin where the platform
stands or what needs doing without opening every page.

Measured against production on 2026-09-12, the real state of the platform is
also invisible from inside the product, and easy to misread from raw tables:

| | All accounts | Test accounts | **Real** |
|---|---|---|---|
| Accounts | 50 | 37 | **13** |
| Confirmed email | 13 | 2 | **11 (85%)** |
| Ever signed in | 12 | 2 | **10** |
| Added a dog | 8 | 2 | **6** |

37 of 50 accounts come from the e2e suite, which signs up
`e2e-test-<timestamp>@gmail.com` against production on every run. Counted raw,
they make activation look like a 74% leak; with them removed it is 85%. A
dashboard that does not exclude them consistently would be actively
misleading, so exclusion is a first-class part of this design, not a detail.

## 2. Decisions

| Question | Decision |
|---|---|
| What "separate" means | The home page of the existing console at `/admin`. Same login, same `admin` role gate. Not a subdomain, not a second app. |
| Which insights | **Needs attention**, **Activation funnel** (with weekly signups), **Engagement**. Site traffic is out of scope. |
| How figures are computed | One security-definer SQL function, `admin_dashboard_stats()`, that checks the admin role itself and returns everything in one call. |

## 3. Database: migration `0033_admin_dashboard_stats.sql`

`0033` is the next free number on `main` (last is
`0032_sync_owners_email_on_auth_change.sql`). Re-check with
`ls supabase/migrations | tail` immediately before creating the file; this
repo has collided on migration numbers three times.

### 3.1 `public.is_test_account(p_email text) returns boolean`

The single test-account rule. Plain `language sql`, `immutable`, not security
definer.

```sql
select coalesce(p_email, '') like 'e2e-%'
    or coalesce(p_email, '') like 'formingpaws.qa%';
```

`e2e-%` covers both the fixture owners (`e2e-fixture-owner…`) and the per-run
signups (`e2e-test-…`). Grants: `revoke all … from public, anon`;
`grant execute … to authenticated`. Anon needs no execute grant, because the
security-definer functions that call it run with their owner's privileges.

### 3.2 `public.community_stats()` uses the shared rule

Replace its two inline `not like 'e2e-%' and not like 'formingpaws.qa%'`
clauses with `not public.is_test_account(o.email)`. Output is unchanged.

The live definition was read with `pg_get_functiondef` on 2026-09-12 and is
identical to the one in `0028_admin_dog_management.sql`, so the
`create or replace` drops nothing. **Re-read the live definition immediately
before applying** and stop if it has changed since. `create or replace`
preserves existing grants, so its current anon + authenticated execute
(intentional: it backs public site figures) stays as it is.

### 3.3 `public.admin_dashboard_stats() returns json`

`language plpgsql`, `stable`, `security definer`, `set search_path = public`.

First statement:

```sql
if not public.has_role('admin') then
  raise exception 'admin role required' using errcode = '42501';
end if;
```

`has_role` reads `auth.uid()` from the request JWT, so it identifies the real
caller from inside a security-definer function (the pattern `grant_role`
already relies on). Grants: `revoke all … from public`,
`revoke all … from anon`, `grant execute … to authenticated`. The anon revoke
is explicit because of the default-ACL grant that migration 0029 had to close.

Returns counts and timestamps only. **No names, emails or message bodies.**

#### JSON shape

```json
{
  "meta": {
    "generated_at": "timestamptz",
    "test_accounts_excluded": 0
  },
  "attention": {
    "docs_pending": 0,
    "oldest_pending_uploaded_at": "timestamptz | null",
    "reports_open": 0,
    "contact_unhandled": 0,
    "dogs_removed": 0
  },
  "funnel": {
    "signed_up": 0,
    "confirmed": 0,
    "signed_in": 0,
    "added_dog": 0,
    "verified_dog": 0,
    "matched": 0
  },
  "signups_by_week": [ { "week_start": "date", "signups": 0 } ],
  "engagement": {
    "interests":            { "total": 0, "last_30d": 0 },
    "matches":              { "total": 0, "last_30d": 0 },
    "messages":             { "total": 0, "last_30d": 0 },
    "active_conversations": { "last_30d": 0 },
    "litters":              { "total": 0, "last_30d": 0 },
    "puppy_inquiries":      { "total": 0, "last_30d": 0 }
  }
}
```

#### Figure definitions

"Real user" means a row in `auth.users` where
`not public.is_test_account(auth.users.email)`. `auth.users.email` is the
source of truth (0032 keeps `owners.email` in sync with it). A "live dog" is a
row in `dogs` with `removed_at is null`.

**Needs attention: NOT filtered for test accounts.** These are work queues,
and each count links to the page that works that queue. Those pages show every
row, so the counts must match them or the numbers disagree the moment an admin
clicks through.

| Key | Definition |
|---|---|
| `docs_pending` | `health_documents` where `status = 'pending_review'` |
| `oldest_pending_uploaded_at` | `min(uploaded_at)` over the same rows; `null` when none |
| `reports_open` | `match_reports` where `status in ('open', 'reviewing')` |
| `contact_unhandled` | `contact_messages` where `handled_at is null` |
| `dogs_removed` | `dogs` where `removed_at is not null` |

**Funnel: real users only.** Each step is a count of people. The steps are
ordered as a journey, but the database does not force each to be a subset of
the one before (a fixture seeded by SQL can own a dog without ever signing
in), so they are computed independently, as the note below the table says.

| Key | Definition |
|---|---|
| `signed_up` | real users |
| `confirmed` | …with `email_confirmed_at is not null` |
| `signed_in` | …with `last_sign_in_at is not null` |
| `added_dog` | …owning at least one live dog |
| `verified_dog` | …owning at least one live dog where `dog_is_baseline_verified(dogs.id)` (a verified vet exam dated within 12 months **and** a verified vaccination) |
| `matched` | …owning at least one live dog that appears in `matches.dog_a_id` or `matches.dog_b_id` |

`confirmed`, `signed_in`, `added_dog`, `verified_dog` and `matched` are each
computed independently over real users, not chained. In practice every step is
a subset of the one before; the page computes percentages from the counts it
receives and never assumes monotonicity.

**Signups: real users only.** Exactly 8 rows, oldest first: the current
week and the 7 before it, produced with `generate_series` over
`date_trunc('week', now())` and left-joined to real users grouped by
`date_trunc('week', auth.users.created_at)`. Weeks with no signups appear with
`signups: 0` rather than being omitted.

**Engagement: real users only.** `last_30d` means `created_at` (or
`matched_at`) `> now() - interval '30 days'`.

| Key | Counts rows where |
|---|---|
| `interests` | `dog_interests.expressing_dog_id` belongs to a real user |
| `matches` | either dog belongs to a real user |
| `messages` | `messages.sender_owner_id` is a real user |
| `active_conversations.last_30d` | distinct `messages.match_id` with a real sender in the last 30 days |
| `litters` | `litters.breeder_id` is a real user |
| `puppy_inquiries` | `buyer_id` is null (anonymous inquiry) or a real user |

`meta.test_accounts_excluded` is the count of `auth.users` where
`is_test_account(email)` is true.

## 4. Application

### 4.1 Files

| File | Responsibility |
|---|---|
| `lib/admin/dashboard.ts` | The `DashboardStats` type matching §3.3, plus pure formatting helpers. No I/O. |
| `components/admin/DashboardView.tsx` | Presentational. Takes `{ stats: DashboardStats \| null, now: Date }` and renders all sections, including the error and empty states. No data fetching, so it can be tested in isolation. |
| `app/admin/page.tsx` | `requireRole('admin')`, calls `supabase.rpc('admin_dashboard_stats')`, renders `DashboardView`. On an RPC error, logs it server-side and passes `stats: null`. `metadata` uses `pageMetadata({ … index: false })` like the other admin pages. |
| `app/admin/layout.tsx` | Adds `{ href: '/admin', label: 'Overview' }` as the first `NAV` item. |

### 4.2 Helpers in `lib/admin/dashboard.ts`

| Helper | Behaviour |
|---|---|
| `pct(part, whole)` | Whole-number percent string, e.g. `"85%"`. Returns `"—"` when `whole` is 0. |
| `waitingFor(iso, now)` | `null` → `"Nothing waiting"`; under 24h → `"Waiting under a day"`; otherwise `"Waiting N days"` (floor, singular for 1). |
| `weekLabel(date)` | Short month and day of the week start, e.g. `"Sep 7"`. |
| `barPercent(value, max)` | `0–100` for a CSS width. Returns 0 when `max` is 0, never `NaN`. |

### 4.3 Page layout

Same `max-w-2xl p-8` column as every other admin page, and the site's existing
record vocabulary (`RecordLine`, `Mark`, `fp-row`, `fp-meta`). No new
dependencies and no chart library.

In order:

1. **Header.** `Overview`, then a record line: generated time, and
   `N test accounts excluded`.
2. **Needs attention.** One ruled row per queue. Each shows the count and
   links to its page (`/admin/review-queue`, `/admin/reports`,
   `/admin/messages`, `/admin/dogs`). The documents row adds
   `waitingFor(oldest_pending_uploaded_at)`. A queue at zero shows a verified
   `Mark` and `Nothing waiting` instead of a bare `0`.
3. **Activation funnel.** One row per step: label, count, percent of the
   previous step, and a horizontal CSS bar whose width is the count as a
   percent of `signed_up`. The largest drop between adjacent steps is labelled.
4. **Signups, last 8 weeks.** Eight vertical CSS bars scaled to the week
   maximum, each labelled with `weekLabel` and its exact count, so a zero
   week is visible as zero.
5. **Engagement.** Ruled rows: label, last 30 days, all time.

Load the `dataviz` skill before writing the bars. Every bar carries its exact
number as text; bar length is never the only encoding.

### 4.4 States

| State | Rendering |
|---|---|
| RPC error, or `stats` is `null` | A single record line, `Couldn't load figures`, with no partial numbers. The nav stays usable. |
| All zeros | Every section still renders with zeros, `—` percentages and zero-height bars. No section disappears. |
| Signed out | `/admin` redirects to `/login` (layout and page both call `requireRole`). |
| Signed in, not admin | Redirect to `/home`. If the function were ever called directly, it raises `42501`. |

## 5. Security

Access is enforced three times: the admin layout, the page, and the function
itself. The function returns aggregates only.

After applying the migration, verify by behaviour, not by reading SQL:

- anon `POST /rest/v1/rpc/admin_dashboard_stats` returns 404 or 401
- anon `POST /rest/v1/rpc/is_test_account` returns 404 or 401
- `/admin` returns 307 signed out
- `get_advisors(security)` shows no new ERROR-level finding

## 6. Testing

### 6.1 SQL assertions: `supabase/tests/0033_admin_dashboard_stats_assertions.sql`

Same structure as `0032_owners_email_sync_assertions.sql`: `begin`, one
`do $$ … raise exception 'FAIL: …' … $$` block per check, `rollback`.

Simulate callers the way `supabase/tests/0028_admin_dog_management_assertions.sql`
does (around lines 399–494): `set local role authenticated`, then
`select set_config('request.jwt.claims', …)` naming the caller's user id, and
`reset role` afterwards. (`0026_role_system_assertions.sql` does **not**
simulate callers; it only exercises the SQL path where `auth.uid()` is null.)

Two traps that file documents, both of which apply here:

- **Shape before refusal.** A missing function and a missing grant both raise
  `insufficient_privilege`, so "a non-admin is refused" passes vacuously
  against a database where the function was never created. Assert that
  `admin_dashboard_stats` and `is_test_account` exist, with their grants,
  before any privilege check.
- **A real verified dog.** `dog_is_baseline_verified` needs a verified
  `vet_exam` dated within 12 months **and** a verified `vaccination`. A fixture
  with only one of them never counts, and any assertion on
  `funnel.verified_dog` then passes vacuously.

0. Shape: both functions exist, `admin_dashboard_stats` is executable by
   `authenticated` and not by `anon`.
1. `is_test_account` truth table: `e2e-fixture-owner@gmail.com`,
   `e2e-test-123@gmail.com`, `formingpaws.qa+1@x.test` → true;
   `someone@example.test`, `null`, `''` → false.
2. An authenticated caller without the admin role raises `42501`.
3. An admin caller receives JSON containing `meta`, `attention`, `funnel`,
   `signups_by_week`, `engagement`.
4. `signups_by_week` has exactly 8 elements, and the last `week_start` equals
   `date_trunc('week', now())::date`.
5. Inserting an `e2e-test-…` auth user leaves `funnel.signed_up` unchanged and
   increments `meta.test_accounts_excluded` by 1.
6. Inserting a non-test auth user increments `funnel.signed_up` by 1.
7. Inserting a `pending_review` health document increments
   `attention.docs_pending` by 1.
8. `community_stats()` returns the same `members` value before and after the
   function body change (run the comparison inside the transaction).

### 6.2 Unit: `tests/unit/admin-dashboard.test.ts`

- Every helper in §4.2, including `pct(3, 0)`, `barPercent(5, 0)`,
  `waitingFor(null)` and the singular `"Waiting 1 day"`.
- `DashboardView` rendered with a fixture: counts appear, each queue links to
  the right page, a zero queue shows `Nothing waiting`, the funnel renders six
  steps, signups render eight bars.
- `DashboardView` with `stats: null` renders `Couldn't load figures` and no
  numbers.

### 6.3 Gates before merge

`tsc`, `lint`, full unit suite, production build, the platform sweep
(`scripts/verify-open-file.mjs`), and e2e compared against the current `main`
baseline measured the same day.

## 7. Rollout

1. Implement on `feat/admin-dashboard`. Nothing touches production.
2. **Stop and confirm with Stefan before applying `0033` to production.** It
   is a live database change.
3. Re-read the live `community_stats` definition (§3.2), apply `0033`, run the
   §6.1 assertions against production (rolled back), then the §5 probes.
4. Merge and deploy only after the migration is live, so the page never calls
   a function that does not exist yet.

## 8. Out of scope

| Item | Why it is not here |
|---|---|
| Site traffic | Vercel Web Analytics is not enabled on the project, and would only count visits from the day it is. |
| Trends and history | Nightly snapshot tables are unnecessary at 13 real members. They can sit on top of `admin_dashboard_stats()` later without changing it. |
| e2e suite writing to production | Every run adds an account to the live project (35 so far). Worth fixing on its own; this design only stops those accounts distorting the figures. |
| Test accounts on `/admin/users` | That page still lists all 37. `is_test_account` makes filtering it a small follow-up. |
| The four open admin-console edges | Match threads unreadable, audit gaps, removed dogs receiving interest, admins unable to view removed dogs' photos. Separate work. |
