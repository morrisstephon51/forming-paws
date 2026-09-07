# Admin Console Completion — Design

**Date:** 2026-09-07
**Branch:** `feat/admin-console-role-system`
**Status:** approved, ready for planning

## Goal

Make the already-written admin console runnable, then add the one capability its
own plan deliberately deferred: admin management of any member's dogs.

Two things stand between ~2,100 lines of tested code and a working console:
migrations `0026_role_system` and `0027_audit_log` were written but never
applied. Every `/admin/*` page calls `has_role` and reads `user_roles` and
`audit_log`, none of which exist in the database. The console currently throws
on load.

## Verified production state — 2026-09-07

Project `wyzcnkdonbdykidmcxvx` is the only Forming Paws database. There is no
staging, no local stack, no `DATABASE_URL`. It is production.

| Fact | Value |
|---|---|
| `roles`, `user_roles`, `audit_log` | **do not exist** |
| `has_role`, `has_any_role`, `grant_role`, `revoke_role` | **do not exist** |
| `public.is_admin()` | exists, reads `owners.is_admin` |
| owners | 46 |
| owners with `is_admin = true` | 1 |
| dogs | 20 |
| health_documents | 8 |
| matches / messages / litters | 1 / 7 / 0 |

Counts have grown since the 2026-08-26 plan was written (36 → 46 owners). The
migrations remain unapplied; nothing has partially landed.

## Correction to the 2026-08-26 plan

That plan's "Deliberately not in this plan" section states admin dog management
is blocked because:

> `dogs_select_own` currently restricts SELECT to `owner_id = auth.uid()`, so an
> admin cannot see another member's dogs at all.

**This is false in production.** A `dogs_select_admin` policy with
`qual: is_admin()` already exists. RLS policies for the same command are OR'd,
so admins can already read every dog. Because 0026 redefines `is_admin()` to
resolve through `has_role('admin')`, that policy begins honouring console-granted
admins with no further edit.

What is genuinely missing is only UPDATE and DELETE. The migration this needs is
therefore far smaller than the plan assumed.

## Part A — Land the role system

Rehearse on a temporary Supabase branch before touching production, because the
first real execution of this DDL should not be on live data.

1. Create a Supabase branch (schema copy).
2. Apply `0026_role_system.sql`, then `0027_audit_log.sql`.
3. Run `supabase/tests/0026_role_system_assertions.sql`.
4. Run `supabase/tests/0027_audit_log_assertions.sql` — **does not yet exist,
   written as part of this work.** 0027's append-only posture is currently
   asserted nowhere.
5. Confirm the pre-existing admin still passes `is_admin()` after the
   redefinition, and that all 9 policies calling it still resolve.
6. Apply both to production. Delete the branch.

The ordering inside 0026 is load-bearing and must not be reordered: the backfill
of existing admins into `user_roles` happens **before** `is_admin()` is
redefined. Reversed, the single live admin loses access at the moment the
function is replaced.

## Part B — Migration 0028, admin dog management

### Schema

```sql
alter table public.dogs
  add column removed_at timestamptz,
  add column removed_by uuid references public.owners(id);
```

Soft delete, not hard. Production foreign keys cascade from `dogs` into
`dog_photos`, `health_documents`, `dog_interests`, `matches`, and
`puppy_inquiries`. A hard admin delete would silently destroy the verified vet
records that back the platform's health-gating claim, plus every message thread
the dog appeared in, irreversibly and with no verified backup.

### Three enforcement layers

No single layer covers every read path, so all three are required.

| Layer | Change | Covers |
|---|---|---|
| RLS | `dogs_select_own` gains `and removed_at is null` | Direct `from('dogs')` reads only — see the view caveat below |
| RLS | new `dogs_update_admin` gated on `is_admin()` | The actually-missing capability |
| SQL functions | explicit `removed_at is null` filter in `browse_dogs`, `browse_puppies`, and **both** subqueries of `community_stats` | These are `security definer` and **bypass RLS entirely** — verified via `pg_proc.prosecdef` |

**No `dogs_delete_admin` policy is added.** Granting admins DELETE would reintroduce
exactly the cascade this design exists to prevent — a single admin misclick
destroying vet records and message threads. Removal is `removed_at`, never DELETE.
Genuine hard erasure (a legal deletion request) stays a deliberate,
out-of-band database operation, not a button in a console.

`dog_is_baseline_verified` is **deliberately not filtered.** It answers "does this
dog hold current verified vet and vaccination documents" for a `dog_id` the caller
already has — a property query, not a discovery surface. Filtering it would
conflate "removed" with "unverified" and misreport a removed dog's real health
status to the admin reviewing it. `community_stats` calls it in a loop over all
dogs, so the removed-dog exclusion belongs in `community_stats` itself, where it
is a counting decision rather than a claim about a dog's health.

`match_thread_summaries` is `security invoker` and needs no edit.

### The `dogs_browsable` view — a fourth RLS bypass, deliberately left unfiltered

`public.dogs_browsable` (`dogs JOIN breeds`, no filter) is owned by `postgres`
with **no `security_invoker` reloption**, so it bypasses RLS on `dogs` entirely.
It is read by `app/matches/page.tsx`, `app/matches/[id]/page.tsx`,
`app/admin/review-queue/page.tsx` and `app/dogs/[id]/page.tsx`. RLS on
`dogs_select_own` therefore does **not** cover those four call sites, and the
earlier claim in this spec that it covered "every direct app-code read" was wrong.

**The view is nonetheless not filtered.** Migration 0022 already faced this exact
decision for `deactivated_at` and recorded the reasoning:

> browse_dogs() is the discovery feed, so it filters. dogs_browsable does NOT,
> and that is not an oversight: [matches, matches/[id] and review-queue] all read
> dogs_browsable to resolve dog NAMES. Filtering the view would blank the dog's
> name in every existing conversation and in the admin queue — the same "query
> silently filtered by another table's access" failure this repo has now hit four
> times. An empty thread also reads as data loss to the owner still in it.

Filtering it would directly contradict this spec's own decision that existing
match threads survive a removal. Soft delete follows the deactivation precedent
exactly:

| Surface | Behaviour for a removed dog |
|---|---|
| `browse_dogs`, `browse_puppies`, `community_stats` | filtered — discovery and counting |
| `dogs_browsable` | **unfiltered** — names still resolve in existing threads and the review queue |
| `dogs_select_own` (RLS) | filtered — a removed dog leaves its owner's own list |
| `dogs_select_admin` (RLS) | unfiltered — admins must see and restore |
| `/dogs/[id]` | explicit page-level check: 404 for everyone but the owner and admins, mirroring what 0022 did for deactivated owners |

### Photos must stop being served, even though the view stays open

Migration 0019 deliberately coupled photo visibility to that view, so that a
filter added to `dogs_browsable` would propagate to photos automatically.
Confirmed present in production:

- `public.dog_photos.dog_photos_select_browsable` — `exists (select 1 from dogs_browsable b where b.id = dog_photos.dog_id)`
- `storage.objects.dog_photos_storage_browsable_select` — same, keyed on `storage.foldername(name)[1]`

Because the view stays unfiltered, that automatic propagation does not happen
here. Both policies therefore gain an explicit `removed_at is null` check against
`dogs` directly. Without this, a dog removed for abusive imagery keeps serving
that imagery to every signed-in member — which would make removal useless for the
moderation case it exists to serve.

The owner-scoped policies `dog_photos_select_own` and
`dog_photos_storage_owner_access` are **left untouched**, per 0019's own note that
they must keep working independently of browsability. Policies are OR'd, so
narrowing only the browsable pair is sufficient and safe.


### The restatement hazard

`browse_dogs`, `browse_puppies` and `community_stats` are all defined with
`CREATE OR REPLACE`. Migration 0028 must restate each one **in full**, preserving
every existing filter. `browse_dogs` carries a comment in its own body warning
about precisely this:

> Carried forward from 0022. This function is defined by CREATE OR REPLACE, so
> any migration that restates it and omits this line silently un-hides every
> deactivated owner's dogs from browse — a member who asked us to delete their
> account would reappear in the feed.

That comment exists because the filter has been lost this way before. The live
production definitions — not the migration files, which the 2026-08-26 plan
already establishes are not a source of truth — are the text to start from.

### Folded-in fix: `browse_puppies` deactivation leak

`browse_puppies` **lacks** the `and o.deactivated_at is null` filter that
`browse_dogs` has. Its entire owner-side predicate is `d.owner_id <> auth.uid()`.
`deactivate_own_account` only sets `owners.deactivated_at` and touches neither
`dogs` nor `litters`, so that filter is the sole mechanism hiding a deactivated
member from discovery — and the marketplace path skips it. A member who
deactivates their account keeps their puppies listed at `/marketplace`.

Verified latent, not active: production currently has 0 deactivated owners and
0 dogs with a `litter_id`. It becomes live the moment Plan 2 (Puppy Listings)
ships.

Because 0028 already restates this function verbatim to add the `removed_at`
filter, the fix is one additional line in the same statement. It gets its own
step and its own commit in the plan rather than riding along inside a soft-delete
change.


`dogs_select_admin` stays deliberately **unfiltered**. Admins must be able to
see and restore removed dogs; a filtered admin policy would make removal
irreversible in practice.

### Write path

`admin_remove_dog(dog_id, reason)` and `admin_restore_dog(dog_id)` are
`security definer set search_path = public`, each writing an `audit_log` row.
This mirrors the `grant_role`/`revoke_role` posture 0026 establishes: a
moderation action is never a direct authenticated-API write.

### Behavioural decisions

1. **Existing match threads survive removal.** A removed dog leaves browse and
   generates no new matches, but conversations it is already part of stay
   readable. Destroying a human conversation because a dog was hidden is worse
   than the inconsistency of a thread mentioning a hidden dog.
2. **`removed_at` is admin-only.** Owners continue to delete their own dogs
   through the existing hard-delete path. This is a moderation tool, not a new
   member-facing feature.

## Part C — `/admin/dogs`

A sixth console section, added to the `NAV` array in `app/admin/layout.tsx`
alongside Users, Review queue, Reports, Messages, and Audit log. It inherits the
layout's single `requireRole('admin')` gate; the page adds no gate of its own.

**List view.** All dogs with owner, breed, sex, birth date, verification status,
and removed state. Removed dogs are shown, visibly marked, with a restore
action — they are not filtered out of the admin's own view.

**Edit form.** Four scopes, all approved:

| Scope | Fields |
|---|---|
| Factual correction | `name`, `breed_id`, `sex`, `birth_date`, `weight_lbs` |
| Free-text moderation | `temperament_notes` — the only member-authored free text on a dog with no current moderation path |
| Marketplace | `listed_price_cents`, `litter_id` — pull a puppy from the marketplace without removing the dog |
| Ownership | `owner_id` reassignment |

Ownership reassignment requires typing the dog's name to confirm and emits its
own distinct audit event. It is the most dangerous single write in the console:
it moves a dog, its photos, and its health documents between two real people.

Every write in this section emits an `audit_log` row.

## Testing

- `0027_audit_log_assertions.sql` and `0028_admin_dog_management_assertions.sql`,
  following the `begin; … rollback;` + `do $$ … raise exception … $$` pattern
  established by `supabase/tests/0022_deactivation_assertions.sql`.
- Assertions must prove, at minimum: a removed dog is invisible to
  `browse_dogs`, `browse_puppies`, and its own owner; visible to an admin;
  restorable; and that `admin_remove_dog` writes exactly one audit row.
- Unit coverage for the new server actions, matching `tests/unit/roles.test.ts`.
- The existing 200 unit tests must stay green.

## Done when

1. `roles`, `user_roles`, and `audit_log` exist in production; all five original
   console sections load and function for the pre-existing admin.
2. An owner granted `admin` through the console sees a populated console, not an
   empty one — proving the `is_admin()` bridge reaches all 9 dependent policies.
3. An admin can correct, moderate, reprice, reassign, remove, and restore any
   member's dog from `/admin/dogs`.
4. A removed dog is absent from `browse_dogs`, `browse_puppies`,
   `community_stats`, and its owner's own dog list, and present for an admin.
   `dog_is_baseline_verified` still reports its true health status.
5. No admin action destroys a health document or a message.
5a. A deactivated owner's puppies are absent from `browse_puppies`, closing the
   pre-existing leak.
5b. A removed dog's photos are no longer served to other members from either
   `dog_photos` or the `dog-photos` storage bucket, while its name still resolves
   in existing match threads and the review queue.
6. Every console write appears at `/admin/audit-log`.
7. `npm test`, `npx tsc --noEmit`, and `npm run lint` are clean.

## Not in scope

- Dropping `owners.is_admin`. It stays as write-frozen legacy; migration 0014's
  trigger makes writing it impossible from an authenticated session anyway.
- Puppy listings (Plan 2) and its unresolved `listing_inquiries` parent question.
- Mascot standardisation and landing-page scroll work — separate specs, agreed
  to follow this one.
