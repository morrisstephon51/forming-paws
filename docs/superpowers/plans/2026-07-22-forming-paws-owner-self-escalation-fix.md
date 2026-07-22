# Forming Paws — Fix `owners.is_admin` Self-Escalation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a confirmed privilege-escalation hole: any signed-in owner can currently set their own `is_admin` to `true` via a direct REST call, granting themselves access to `/admin/review-queue`.

**Architecture:** A `BEFORE UPDATE` trigger on `public.owners` that blocks any change to `is_admin` when the request comes from an authenticated user session (`auth.uid()` is non-null), while still allowing the change when run as direct SQL with no JWT context (`auth.uid()` is null) — which is exactly how the spec already says admin status gets granted ("`is_admin` is set manually via SQL for Stefan's account after signup — no separate admin auth system yet").

**Tech Stack:** Supabase Postgres migration, applied via `mcp__claude_ai_Supabase__apply_migration`.

## Global Constraints

- No hosted deploy target for this repo right now (see plan `2026-07-05-forming-paws-foundation-and-profiles.md`, Task 11) — verify locally / via direct Supabase calls, not a deployed environment.
- Must not break the existing "grant admin via SQL" operational path, since there's no admin-management UI yet.

---

### Task 1: Block `is_admin` self-modification via RLS-session updates

**Files:**
- Create: `supabase/migrations/0011_prevent_owner_self_admin_escalation.sql`

**Context — confirmed exploit (2026-07-22):** `owners_update_own` (migration 0001) is `for update using (auth.uid() = id)` with no `with check`. Postgres defaults the `with check` to the same expression when omitted, which only constrains *which row* can be touched (must be your own), not *which columns* change within it. Verified live: signed in as a non-admin fixture owner, then:

```bash
curl -X PATCH "https://wyzcnkdonbdykidmcxvx.supabase.co/rest/v1/owners?id=eq.<self>" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <that owner's access token>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"is_admin": true}'
```

returned `{"is_admin": true, ...}` — the update succeeded. (Reverted immediately after confirming.) This grants the attacker access to `/admin/review-queue`, letting them approve/reject their own or anyone's health documents.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0011_prevent_owner_self_admin_escalation.sql

-- auth.uid() is null when a statement runs without a JWT context (e.g. direct
-- SQL via the Supabase MCP execute_sql tool or the dashboard SQL editor,
-- which run as the postgres/service role) and non-null for any request that
-- came in through PostgREST with a user's access token. This lets the
-- existing "grant admin via SQL" operational path (per the Phase 2 spec)
-- keep working while blocking the same change over the authenticated REST
-- API.
create or replace function public.prevent_owner_self_admin_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'is_admin cannot be changed by the owner themselves';
  end if;
  return new;
end;
$$;

create trigger owners_prevent_self_admin_escalation
  before update on public.owners
  for each row execute function public.prevent_owner_self_admin_escalation();
```

- [ ] **Step 2: Apply the migration via the Supabase MCP tool**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "wyzcnkdonbdykidmcxvx"`, `name: "prevent_owner_self_admin_escalation"`, and the SQL from Step 1.
Expected: success, no error.

- [ ] **Step 3: Verify the exploit is now blocked**

Run (using the same fixture owner credentials from `.env.local`):

```bash
cd ~/forming-paws
ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
EMAIL=$(grep E2E_FIXTURE_EMAIL .env.local | cut -d= -f2)
PASSWORD=$(grep E2E_FIXTURE_PASSWORD .env.local | cut -d= -f2)
TOKEN=$(curl -s "https://wyzcnkdonbdykidmcxvx.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
MY_ID=$(curl -s "https://wyzcnkdonbdykidmcxvx.supabase.co/auth/v1/user" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -w "\nHTTP %{http_code}\n" -X PATCH "https://wyzcnkdonbdykidmcxvx.supabase.co/rest/v1/owners?id=eq.$MY_ID" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"is_admin": true}'
```

Expected: a non-2xx HTTP status (likely 400) with an error body mentioning "is_admin cannot be changed by the owner themselves" — NOT the row echoed back with `is_admin: true`.

- [ ] **Step 4: Verify a normal, non-`is_admin` self-update still works (no regression)**

Reuse `$TOKEN`/`$MY_ID` from Step 3:

```bash
curl -s -w "\nHTTP %{http_code}\n" -X PATCH "https://wyzcnkdonbdykidmcxvx.supabase.co/rest/v1/owners?id=eq.$MY_ID" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"display_name": "E2E Fixture Owner"}'
```

Expected: HTTP 200/201 with the row echoed back — confirms the trigger only blocks `is_admin` changes, not ordinary self-updates (this also matters for Task 1 of the browse-and-matching plan, which updates `location_point`/`location_label` on the owner's own row).

- [ ] **Step 5: Verify the SQL-grant path still works (no regression on the documented admin-provisioning flow)**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: "wyzcnkdonbdykidmcxvx"` and:

```sql
update public.owners set is_admin = true where id = '<some test owner id>';
```

Expected: success — direct SQL (no JWT/`auth.uid()`) is unaffected by the trigger. Revert afterward if the target wasn't meant to stay an admin:

```sql
update public.owners set is_admin = false where id = '<same test owner id>';
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0011_prevent_owner_self_admin_escalation.sql
git commit -m "Block owners from self-escalating is_admin via the authenticated REST path"
```

---

## Self-Review Notes

**Spec coverage:** this is a standalone security fix, not part of the original Phase 2 spec — it was found while designing the browse-and-matching plan (`2026-07-22-forming-paws-browse-and-matching.md`) and deliberately kept separate since it's unrelated to that feature's scope.

**Why a trigger and not a `with check`:** a `with check (auth.uid() = id and is_admin = (select is_admin from owners where id = auth.uid()))`-style policy would work too, but a self-referential subquery inside `with check` re-evaluates against the row being written, not cleanly against the pre-update value in all Postgres/PostgREST versions this project might run against — a `before update` trigger comparing `old`/`new` directly is the more standard, unambiguous way to protect a specific column across an update, and mirrors this codebase's existing convention of using `security definer` trigger functions for privileged operations (`handle_new_user` in migration 0001).

**No automated test added:** this fix isn't reachable through any page in the app (no UI ever sets `is_admin`), so it doesn't fit this codebase's two existing test patterns (Vitest pure-logic, Playwright UI-driven e2e). Steps 3–5 are manual `curl`/SQL verification instead — proportionate for a single trigger, and already demonstrated to work during plan authoring (Step 3's blocked case and the original exploit in Step 1's context were both verified live against the real project).
